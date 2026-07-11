// Assemble the dashboard's corridor shape from the parsed pieces:
//   { event, clock, matches, standings, state, updatedISO }
// Runs in the background service worker (no DOM).

export function buildCorridor(rank, matches, clock) {
  const headers = (rank.headers || []).map((h) =>
    String(h).toLowerCase().replace(/[^a-z0-9]/g, '')
  );
  const colOf = (...names) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const ptsI = colOf('pts', 'points', 'score');
  const bchI = colOf('bch', 'byes', 'bye', 'buchholz');
  const netI = colOf('net', 'spread', 'diff');
  const type = rank.type || 'singles';
  const splitNames = (name) =>
    type === 'doubles'
      ? String(name || '').split(/\s+and\s+|\s*\/\s*|\s*&\s*/i).map((s) => s.trim()).filter(Boolean)
      : [name];

  const standings = (rank.standings || []).map((s) => ({
    rank: s.rank,
    players: splitNames(s.player),
    pts: numFrom(s.cells, ptsI),
    bch: numFrom(s.cells, bchI),
    net: numFrom(s.cells, netI)
  }));

  // Final results: the clock is meaningless once prized.
  let effectiveClock = rank.prized ? null : clock || null;

  // A "ready" clock (not started) but with already-played boards means the round
  // just ended and we're waiting for the next pairings to be drawn — keep showing
  // "round ended", not "round prepared". A genuinely fresh round is all 0:0.
  if (effectiveClock && effectiveClock.mode === 'ready') {
    const anyScored = (matches || []).some(
      (m) => !m.phantom && (m.finished || m.score1 !== 0 || m.score2 !== 0)
    );
    if (anyScored) effectiveClock = { ...effectiveClock, mode: 'over' };
  }

  // First-round / between-round detection: when no clock is up but the tourney page carries a
  // "Preparing…" (pre_countdown) link, label it as preparing. We can't show a live timer — the
  // pre_countdown page has no server anchor and its duration lives only in that link's URL.
  const state = rank.prized
    ? 'final'
    : effectiveClock
      ? effectiveClock.mode // running | ready | over
      : rank.preCountdown
        ? 'prepare'
        : rank.currentTurn
          ? 'idle'
          : 'pre';

  return {
    event: {
      name: rank.tournament || 'Tournament',
      type,
      currentRound: rank.currentTurn,
      totalRounds: rank.totalRounds != null ? rank.totalRounds : null,
      location: rank.details?.location || '',
      club: rank.details?.club || '',
      system: rank.details?.system || ''
    },
    clock: effectiveClock,
    matches: matches || [],
    standings,
    state,
    updatedISO: new Date().toISOString()
  };
}

function numFrom(cells, i) {
  if (i < 0 || !cells) return '';
  const v = cells[i];
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : v != null ? v : '';
}
