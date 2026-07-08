// Service worker: orchestrates polling. Because SWs have no DOM, HTML parsing is
// delegated to an offscreen document. Flow per poll:
//   fetch (cookies + Anubis clearance ride along) -> detect Anubis ->
//   parse in offscreen -> store data -> optionally publish to GitHub -> update status.
//
// Logging is woven through every step (see src/logger.js). The raw HTTP response
// and the parse result are stashed under the "debug" storage key so the Export
// button hands you (and Claude) real data to diagnose against.

import { getConfig, setConfig, getData, setData, getStatus, setStatus, DEFAULT_CONFIG } from './src/storage.js';
import { fetchTarget } from './src/fetcher.js';
import { publish } from './src/publisher.js';
import { parseCountdown } from './src/countdown.js';
import { buildCorridor } from './src/adapt.js';
import { logger, setDebug, setVerbose } from './src/logger.js';

const ALARM = 'sol-poll';
const MAX_HTML = 500000; // cap stored raw ranking HTML (~500 KB)
const MAX_AUX = 150000; // cap stored raw turn HTML
const MAX_CD = 20000; // cap stored raw countdown HTML
let busy = false; // guards against overlapping polls

chrome.runtime.onInstalled.addListener(async () => {
  const cfg = await getConfig();
  await setConfig({ ...DEFAULT_CONFIG, ...cfg }); // backfill any missing defaults
  logger.info('lifecycle', 'installed/updated');
});

chrome.runtime.onStartup.addListener(async () => {
  const cfg = await getConfig();
  if (cfg.polling) scheduleAlarm(cfg.pollSeconds);
  logger.info('lifecycle', 'startup', { polling: cfg.polling });
});

function scheduleAlarm(seconds) {
  // chrome.alarms enforces a 30s floor for unpacked extensions.
  const periodInMinutes = Math.max(30, Number(seconds) || 30) / 60;
  chrome.alarms.create(ALARM, { periodInMinutes, delayInMinutes: periodInMinutes });
  logger.debug('alarm', 'scheduled', { periodInMinutes });
}

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) runPoll('alarm');
});

// Reschedule a live poll loop when the interval changes in Options (the alarm is
// otherwise fixed at whatever it was when polling started).
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local' || !ch.config) return;
  const prev = ch.config.oldValue || {};
  const next = ch.config.newValue || {};
  if (next.polling && next.pollSeconds !== prev.pollSeconds) {
    scheduleAlarm(next.pollSeconds);
    logger.info('alarm', 'rescheduled (interval changed)', { pollSeconds: next.pollSeconds });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target === 'offscreen') return; // offscreen messages are not ours
  (async () => {
    try {
      switch (msg.type) {
        case 'START': {
          const cfg = await setConfig({ polling: true });
          scheduleAlarm(cfg.pollSeconds);
          logger.info('control', 'START');
          await runPoll('manual-start');
          sendResponse({ ok: true });
          break;
        }
        case 'STOP': {
          await setConfig({ polling: false });
          await chrome.alarms.clear(ALARM);
          logger.info('control', 'STOP');
          sendResponse({ ok: true });
          break;
        }
        case 'POLL_NOW':
          logger.info('control', 'POLL_NOW');
          await runPoll('manual');
          sendResponse({ ok: true });
          break;
        case 'GET_STATUS':
          sendResponse({ config: await getConfig(), status: await getStatus(), data: await getData() });
          break;
        default:
          sendResponse({ ok: false, error: 'unknown message type' });
      }
    } catch (e) {
      logger.error('message', 'handler failed', { type: msg.type, error: String(e.message || e) });
      try {
        sendResponse({ ok: false, error: String(e.message || e) });
      } catch {
        /* channel already closed */
      }
    }
  })();
  return true; // async sendResponse
});

async function runPoll(trigger) {
  if (busy) {
    logger.debug('poll', 'skipped (busy)', { trigger });
    return;
  }
  busy = true;
  const cfg = await getConfig();
  setVerbose(!!cfg.debug);
  const status = await getStatus();
  status.lastPollAt = Date.now();
  logger.info('poll', 'start', { trigger, url: cfg.targetUrl });

  try {
    if (!cfg.targetUrl) throw new Error('No target URL set — open Options.');

    // 1) Ranking / meta page (the configured lit URL).
    const res = await fetchTarget(cfg.targetUrl);
    logger.info('fetch', 'ranking', {
      status: res.httpStatus, ok: res.ok, bytes: res.bytes, elapsedMs: res.elapsedMs, anubis: res.anubis
    });
    await setDebug({
      lastResponse: {
        at: Date.now(), url: cfg.targetUrl, finalUrl: res.finalUrl, status: res.httpStatus,
        ok: res.ok, contentType: res.contentType, bytes: res.bytes, elapsedMs: res.elapsedMs,
        redirected: res.redirected, anubis: res.anubis,
        truncated: res.html.length > MAX_HTML, html: res.html.slice(0, MAX_HTML)
      }
    });
    if (res.anubis) return anubis(status);
    if (!res.ok) throw new Error('HTTP ' + res.httpStatus);

    const rank = await parseViaOffscreen('PARSE_TOURNEY', res.html);
    if (rank.status === 'anubis') return anubis(status);
    logger.info('parse', 'tourney', {
      tournament: rank.tournament, type: rank.type, currentTurn: rank.currentTurn,
      prized: rank.prized, idtourney: rank.idtourney, standings: rank.standings?.length, diag: rank._diag
    });

    // idtourney resolution, most-authoritative first:
    //   1) the id detected on THIS tournament's page (only present while the clock runs)
    //   2) a value learned earlier FOR THIS SAME tournament URL (survives between rounds)
    //   3) the manual Options value (last resort)
    // This prevents reusing a previous tournament's id after switching the target URL.
    const { learnedId } = await chrome.storage.local.get('learnedId');
    const manual = cfg.idtourney && cfg.idtourney.trim();
    const learnedForThis = learnedId && learnedId.url === cfg.targetUrl ? learnedId.id : null;
    const idt = rank.idtourney || learnedForThis || manual || null;
    if (rank.idtourney && (!learnedId || learnedId.id !== rank.idtourney || learnedId.url !== cfg.targetUrl)) {
      await chrome.storage.local.set({ learnedId: { url: cfg.targetUrl, id: rank.idtourney } });
      logger.info('config', 'learned idtourney', { idtourney: rank.idtourney, url: cfg.targetUrl });
    }

    // 2) Current turn's boards (live matches). Best-effort; never blocks the poll.
    let matches = [];
    if (rank.currentTurn != null) {
      try {
        const turnUrl = withTurn(cfg.targetUrl, rank.currentTurn);
        const tr = await fetchTarget(turnUrl);
        await setDebug({
          lastTurn: {
            at: Date.now(), url: turnUrl, status: tr.httpStatus, ok: tr.ok, bytes: tr.bytes,
            anubis: tr.anubis, truncated: tr.html.length > MAX_AUX, html: tr.html.slice(0, MAX_AUX)
          }
        });
        if (tr.ok && !tr.anubis) matches = await parseViaOffscreen('PARSE_MATCHES', tr.html);
        logger.info('fetch', 'turn', { turn: rank.currentTurn, matches: matches.length, anubis: tr.anubis });
      } catch (e) {
        logger.warn('matches', 'fetch/parse failed', { error: String(e.message || e) });
      }
    }

    // 3) Countdown / timer. Public page; needs the integer idtourney.
    let clock = null;
    let clockNote = null;
    if (idt) {
      try {
        const cdU = new URL('/tourney/countdown', cfg.targetUrl);
        cdU.searchParams.set('idtourney', idt);
        cdU.searchParams.set('_', Date.now()); // cache-buster: same URL every round
        const cdUrl = cdU.href;
        const cd = await fetchTarget(cdUrl);
        if (cd.anubis) clockNote = 'Countdown blocked by Anubis — open ' + cdUrl + ' in a tab once.';
        else if (!cd.ok) clockNote = 'Countdown page HTTP ' + cd.httpStatus + ' (id ' + idt + ').';
        else {
          clock = parseCountdown(cd.html);
          if (!clock) clockNote = 'Countdown format not recognised (id ' + idt + ') — see debug export.';
        }
        await setDebug({
          lastCountdown: {
            at: Date.now(), url: cdUrl, status: cd.httpStatus, ok: cd.ok, bytes: cd.bytes,
            anubis: cd.anubis, parsed: clock, truncated: cd.html.length > MAX_CD, html: cd.html.slice(0, MAX_CD)
          }
        });
        logger.info('fetch', 'countdown', { idtourney: idt, clock, anubis: cd.anubis, status: cd.httpStatus });
      } catch (e) {
        clockNote = 'Countdown fetch failed: ' + String(e.message || e);
        logger.warn('clock', 'fetch/parse failed', { error: String(e.message || e) });
      }
    } else {
      clockNote = 'No tourney id — set it in Options to show the timer before the round clock starts.';
    }

    // 4) Assemble the dashboard shape and store/publish it.
    const data = buildCorridor(rank, matches, clock);
    data.sourceUrl = cfg.targetUrl;
    data.idtourney = idt;
    // SoL doesn't expose a target round count for Swiss events — use the configured one.
    if (cfg.totalRounds) data.event.totalRounds = Number(cfg.totalRounds) || data.event.totalRounds;
    data.clockNote = data.clock ? null : rank.prized ? null : clockNote;
    await setData(data);
    await setDebug({
      lastParsed: {
        at: Date.now(), state: data.state, tournament: data.event.name, type: data.event.type,
        currentRound: data.event.currentRound, standings: data.standings.length,
        matches: data.matches.length, clock: data.clock, sampleStandings: data.standings.slice(0, 5),
        sampleMatches: data.matches.slice(0, 4)
      }
    });
    logger.info('build', 'corridor', {
      state: data.state, standings: data.standings.length, matches: data.matches.length, clock: data.clock
    });

    status.state = 'ok';
    status.message = data.standings.length ? '' : 'No standings parsed — check the ranking markup.';
    status.lastOkAt = Date.now();

    if (cfg.publish?.enabled) {
      try {
        const r = await publish(data, cfg.publish);
        status.publish = { state: 'ok', message: r.commit, at: Date.now() };
        logger.info('publish', 'pushed', { commit: r.commit });
      } catch (e) {
        status.publish = { state: 'error', message: String(e.message || e), at: Date.now() };
        logger.error('publish', 'failed', { error: String(e.message || e) });
      }
    }
  } catch (e) {
    status.state = 'error';
    status.message = String(e.message || e);
    logger.error('poll', 'failed', { error: String(e.message || e), stack: e.stack });
    await setDebug({ lastError: { at: Date.now(), where: 'runPoll', message: String(e.message || e), stack: e.stack } });
  } finally {
    await setStatus(status);
    busy = false;
    logger.debug('poll', 'end', { state: status.state });
  }
}

function anubis(status) {
  status.state = 'anubis';
  status.message = 'Anubis challenge returned. Open the SoL page in a normal tab to re-solve, then poll again.';
  logger.warn('poll', 'anubis challenge detected');
}

function withTurn(base, turn) {
  const u = new URL(base);
  u.searchParams.set('turn', turn);
  u.searchParams.set('_', Date.now()); // cache-buster: scores change within a round
  return u.href;
}

async function parseViaOffscreen(type, html) {
  await ensureOffscreen();
  const resp = await chrome.runtime.sendMessage({ target: 'offscreen', type, html });
  if (!resp || !resp.ok) throw new Error('Parse failed: ' + (resp?.error || 'no response'));
  return resp.data;
}

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument?.()) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Parse fetched SoL HTML into structured standings.'
    });
    logger.debug('offscreen', 'created');
  } catch (e) {
    if (!/single offscreen|already/i.test(String(e))) throw e; // tolerate create races
  }
}
