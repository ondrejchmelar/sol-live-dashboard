// Parse the SoL running-round countdown page into a clock object for the dashboard.
//
// The page embeds an inline constructor call:
//   new Countdown('c1', <durationMin>, <prealarmMin>, <elapsedMs>|false, <isowner>)
//
// We fetch the countdown each poll, so `elapsed` (server-computed ms) gives a drift-free
// start time; the dashboard ticks smoothly between polls.
//
// The pre-round "Preparing…" timer (new PreCountdown) is handled separately: it carries no
// server anchor, so we read its duration/prealarm from the tourney page's pre_countdown link
// and anchor it locally (see extractPreCountdown in parser.js and runPoll in background.js).

export function parseCountdown(html) {
  const m = html.match(
    /new\s+Countdown\(\s*['"][^'"]*['"]\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*(false|[\d.]+)/i
  );
  if (!m) return null;

  const durationMin = parseFloat(m[1]);
  const prealarmMin = parseFloat(m[2]);
  // 4th arg is elapsed time in MILLISECONDS since the round clock started
  // (confirmed: it increments ~1000 per real second), or `false` if not started.
  const elapsedMs = m[3] === 'false' ? null : parseFloat(m[3]);
  if (elapsedMs == null) {
    // Round prepared, clock not yet started.
    return { mode: 'ready', durationMin, prealarmMin, startedAtISO: null, elapsedSec: null };
  }
  const startedAtISO = new Date(Date.now() - elapsedMs).toISOString();
  const over = elapsedMs >= durationMin * 60 * 1000;
  return {
    mode: over ? 'over' : 'running',
    durationMin,
    prealarmMin,
    startedAtISO,
    elapsedSec: Math.round(elapsedMs / 1000)
  };
}
