// SoL "lit" page parsers. Runs in the OFFSCREEN document (service workers have
// no DOMParser).
//
//  parseTourney(html)  -> ranking page: standings (raw cells) + meta
//      { status, tournament, type, currentTurn, totalRounds, prized, idtourney,
//        headers, rankIndex, playerIndex, details, standings:[{rank,player,cells}], _diag }
//
//  parseMatches(html)  -> a turn's boards: [{ board, side1[], side2[], score1,
//        score2, finished, winner, phantom }]
//
// Markup confirmed against a real ranking page; the matches markup is best-effort
// from the SoL source and is refined from captured turn pages.

export function parseTourney(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tablesFound = doc.querySelectorAll('table').length;

  if (isAnubis(doc)) return emptyTourney('anubis', '', tablesFound);

  const tournament = cleanText(doc.querySelector('h1.title, h1, title')?.textContent) || 'Tournament';
  const table = doc.querySelector('table.ranking') || pickRankingTable(doc);
  const details = parseDetails(doc);
  const idtourney = extractIdTourney(doc);
  const preCountdown = extractPreCountdown(doc);
  const currentTurn = detectCurrentTurn(doc);

  if (!table) {
    // Before the first round there is no ranking table yet — still surface the prep timer.
    const t = emptyTourney('empty', tournament, tablesFound);
    t.idtourney = idtourney;
    t.preCountdown = preCountdown;
    t.currentTurn = currentTurn;
    t.details = details;
    return t;
  }

  const headers = readHeaders(table);
  const rankIndex = findHeader(headers, ['#', 'rank', 'pos', 'place'], 0);
  const playerIndex = findHeader(headers, ['team', 'player', 'name', 'competitor'], 1);
  const prized =
    headers.map(normalize).some((h) => /prize|premio|prijs|preis/.test(h)) ||
    !!table.querySelector('td.total, th.total');

  const bodyRows = [...table.querySelectorAll('tbody tr')];
  const rows = bodyRows.length ? bodyRows : [...table.querySelectorAll('tr')].slice(1);
  const standings = rows
    .map((tr, i) => {
      const cells = [...tr.querySelectorAll('td, th')].map((c) => cleanText(c.textContent));
      if (!cells.length) return null;
      const rank = num(cells[rankIndex]);
      return { rank: rank != null ? rank : i + 1, player: cells[playerIndex] || '', cells };
    })
    .filter(Boolean);

  const playerHdr = String(headers[playerIndex] || '').toLowerCase();
  const type = /team|doubl|pair|čtyř|ctyr/.test(playerHdr) ? 'doubles' : 'singles';

  return {
    status: 'ok',
    tournament,
    type,
    currentTurn,
    totalRounds: null, // Swiss events have no fixed total
    prized,
    idtourney,
    preCountdown,
    headers,
    rankIndex,
    playerIndex,
    details,
    standings,
    _diag: { tablesFound, rowsParsed: standings.length, idtourney, currentTurn, prized, type }
  };
}

export function parseMatches(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (isAnubis(doc)) return [];

  const table = doc.querySelector('table.matches') || doc.querySelector('table.boards');
  if (!table) return [];

  const bodyRows = [...table.querySelectorAll('tbody tr')];
  const rows = bodyRows.length ? bodyRows : [...table.querySelectorAll('tr')].slice(1);

  return rows
    .map((tr, i) => {
      const pick = (sel) => {
        const el = tr.querySelector(sel);
        return el ? cleanText(el.textContent) : '';
      };
      let c1 = pick('.competitor1, .player1, td.competitor1, th.competitor1');
      let c2 = pick('.competitor2, .player2, td.competitor2, th.competitor2');
      let s1 = pick('.score1');
      let s2 = pick('.score2');

      // Fallback when the row doesn't use the named classes: infer from cells.
      if (!c1 && !c2) {
        const cells = [...tr.querySelectorAll('td, th')].map((c) => cleanText(c.textContent));
        const names = cells.filter((v) => /[a-zčďěňřšťůžá-ž]/i.test(v) && !/^\d+$/.test(v));
        const nums = cells.filter((v) => /^-?\d+$/.test(v));
        c1 = names[0] || '';
        c2 = names[1] || '';
        if (s1 === '') s1 = nums[0] ?? '';
        if (s2 === '') s2 = nums[1] ?? '';
      }

      if (!c1 && !c2) return null;
      const boardTxt = pick('.round-number, .board, td.round-number');
      const board = num(boardTxt) ?? i + 1;
      const n1 = num(s1);
      const n2 = num(s2);
      // SoL keeps class "partial-score" on any match whose result isn't final —
      // including a board with a running score entered via the QR form (e.g. 5:4).
      // Its ABSENCE is the authoritative "this match is finished" signal; a
      // finalized match also gains a ".winner" element.
      const isPartial = tr.classList && tr.classList.contains('partial-score');
      const hasScores = n1 != null && n2 != null;
      const finished = !isPartial && hasScores;
      const phantom = /phantom|^—|\bbye\b/i.test(c1 + ' ' + c2) || !c1 || !c2;
      return {
        board,
        side1: splitNames(c1),
        side2: splitNames(c2),
        score1: n1 != null ? n1 : 0,
        score2: n2 != null ? n2 : 0,
        finished,
        winner: finished ? (n1 > n2 ? 1 : n2 > n1 ? 2 : 0) : 0,
        phantom
      };
    })
    .filter(Boolean);
}

/* ---------- helpers ---------- */

function pickRankingTable(doc) {
  const tables = [...doc.querySelectorAll('table')];
  let best = null;
  let bestScore = -1;
  for (const t of tables) {
    const head = (t.querySelector('tr')?.textContent || '').toLowerCase();
    let score = t.querySelectorAll('tr').length;
    if (/team|player|name|competitor/.test(head)) score += 100;
    if (/pts|points|score|net/.test(head)) score += 100;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

function readHeaders(table) {
  const headRow = table.querySelector('thead tr') || table.querySelector('tr');
  return headRow ? [...headRow.querySelectorAll('th, td')].map((c) => cleanText(c.textContent)) : [];
}

function findHeader(headers, keys, fallback) {
  const norm = headers.map(normalize);
  for (const k of keys) {
    const i = norm.indexOf(k);
    if (i !== -1) return i;
  }
  return fallback;
}

// Current turn = the "black" (selected) round button, else the highest turn number.
function detectCurrentTurn(doc) {
  const black = doc.querySelector('a.black[href*="turn="], a.button.black[href*="turn="]');
  if (black) {
    const m = black.getAttribute('href').match(/turn=(\d+)/);
    if (m) return Number(m[1]);
  }
  let max = null;
  for (const a of doc.querySelectorAll('a[href*="turn="]')) {
    const m = a.getAttribute('href').match(/turn=(\d+)/);
    if (m) {
      const n = Number(m[1]);
      if (max == null || n > max) max = n;
    }
  }
  return max;
}

function extractIdTourney(doc) {
  // Any link carrying idtourney= — the running-round countdown link, or the
  // "Preparing the … round" pre-countdown link — reveals the timer id.
  const a = doc.querySelector('a[href*="idtourney="]') || doc.querySelector('a[href*="countdown"]');
  if (a) {
    const m = (a.getAttribute('href') || '').match(/idtourney=(\d+)/);
    if (m) return m[1];
  }
  return null;
}

// While a round is being prepared, the tourney page links to the pre-round timer:
//   /tourney/pre_countdown?idtourney=…&duration=<min>&prealarm=<min>
// That page has NO server anchor (new PreCountdown(dur, pre) starts at page load), so we read
// duration/prealarm from this link and anchor the countdown locally (see background.js).
function extractPreCountdown(doc) {
  const a = doc.querySelector('a[href*="pre_countdown"]');
  if (!a) return null;
  const href = a.getAttribute('href') || '';
  const dm = href.match(/[?&]duration=([\d.]+)/);
  if (!dm) return null;
  const pm = href.match(/[?&]prealarm=([\d.]+)/);
  return { durationMin: parseFloat(dm[1]), prealarmMin: pm ? parseFloat(pm[1]) : 0 };
}

// SoL details are in <table class="... definition table"> with label/value rows.
function parseDetails(doc) {
  const out = {};
  for (const t of doc.querySelectorAll('table.definition')) {
    for (const tr of t.querySelectorAll('tr')) {
      const tds = tr.querySelectorAll('td');
      if (tds.length >= 2) {
        const k = normalize(tds[0].textContent);
        const v = cleanText(tds[1].textContent);
        if (k && v && !out[k]) out[k] = v;
      }
    }
  }
  return out;
}

function isAnubis(doc) {
  const t = (doc.title + ' ' + (doc.body?.textContent || '')).slice(0, 2000).toLowerCase();
  return /anubis|not a bot|proof[- ]of[- ]work/.test(t) && !doc.querySelector('table');
}

function emptyTourney(status, tournament, tablesFound) {
  return {
    status,
    tournament,
    type: 'singles',
    currentTurn: null,
    totalRounds: null,
    prized: false,
    idtourney: null,
    preCountdown: null,
    headers: [],
    rankIndex: 0,
    playerIndex: 1,
    details: {},
    standings: [],
    _diag: { tablesFound }
  };
}

function splitNames(name) {
  return String(name || '')
    .split(/\s+and\s+|\s*\/\s*|\s*&\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}
function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9+#/]/g, '').trim();
}
function cleanText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}
function num(s) {
  if (s == null || s === '') return null;
  const n = parseFloat(String(s).replace(',', '.').replace(/[^\d.+-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
