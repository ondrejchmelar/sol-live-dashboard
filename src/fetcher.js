// Fetches the target page from the service worker. Because the request goes to
// the SoL origin (granted via host_permissions) with credentials, the browser's
// existing session cookie AND Anubis clearance cookie ride along automatically.
//
// If the Anubis clearance has expired, SoL returns the challenge page instead of
// data. We detect that heuristically so the UI can tell the operator to re-open
// the page in a normal tab (which re-solves Anubis natively).
//
// Returns rich metadata (timing, content-type, size, redirect, final URL) so the
// background poller can log it and stash the raw response for debugging.

const ANUBIS_MARKERS = [
  /anubis/i,
  /making sure you[’']?re not a bot/i,
  /proof[- ]of[- ]work/i
];

export async function fetchTarget(url) {
  const started = performance.now();
  const resp = await fetch(url, {
    credentials: 'include',
    redirect: 'follow',
    cache: 'no-store', // critical: the countdown URL is identical each round; never serve a stale clock
    headers: { Accept: 'text/html,application/xhtml+xml' }
  });
  const html = await resp.text();
  const elapsedMs = Math.round(performance.now() - started);
  // A real standings page has a <table>; the Anubis interstitial does not.
  const anubis = ANUBIS_MARKERS.some((re) => re.test(html.slice(0, 4000))) && !/<table/i.test(html);

  return {
    ok: resp.ok,
    httpStatus: resp.status,
    html,
    anubis,
    contentType: resp.headers.get('content-type') || '',
    bytes: html.length,
    elapsedMs,
    redirected: resp.redirected,
    finalUrl: resp.url
  };
}
