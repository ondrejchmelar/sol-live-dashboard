// Parse SoL countdown / pre_countdown pages into a clock object for the dashboard.
//
// The pages embed an inline constructor call:
//   running/ready:  new Countdown('c1', <durationMin>, <prealarmMin>, <elapsedSec>|false, <isowner>)
//   between rounds: new PreCountdown('c1', <durationMin>, <prealarmMin>)
//
// We fetch the countdown each poll, so `elapsed` (server-computed seconds) gives a
// drift-free start time; the dashboard ticks smoothly between polls.

export function parseCountdown(html) {
  let m = html.match(
    /new\s+Countdown\(\s*['"][^'"]*['"]\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*(false|[\d.]+)/i
  );
  if (m) {
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

  m = html.match(/new\s+PreCountdown\(\s*['"][^'"]*['"]\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) {
    // Pre-round break timer; no server anchor, so anchor it at fetch time.
    return {
      mode: 'prepare',
      durationMin: parseFloat(m[1]),
      prealarmMin: parseFloat(m[2]),
      startedAtISO: new Date().toISOString()
    };
  }

  return null;
}
