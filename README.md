# SoL Live Dashboard (MV3)

A Chrome MV3 extension that turns your **already-authenticated browser session**
into a live tournament dashboard for [Scarry On-Line](https://sol5.metapensiero.it/).

The key idea: the extension polls the SoL standings page *from your own browser*,
so **Anubis is solved natively** — no proof-of-work solver, no server, no CORS or
tunnels. Run it on your laptop during an event. Local-only by default, with an
optional switch to publish `data.json` to GitHub for a public GitHub Pages view.

## How it works

```
chrome.alarms (>=30s)
   -> background.js fetches the SoL URL  (session cookie + Anubis clearance ride along)
   -> offscreen.html parses the HTML     (DOMParser isn't available in a service worker)
   -> chrome.storage.local  { data, status }
        -> dashboard/  renders locally (live, client-side ticking clock)
        -> publisher.js  PUTs data.json to GitHub  (only if enabled)
             -> gh-pages/  public dashboard reads data.json
```

## Install (unpacked)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick this folder.
2. Click the toolbar icon → **Options**:
   - Set the **SoL standings URL** (e.g. `https://sol5.metapensiero.it/lit/tourney/<guid>`).
   - Leave **publishing disabled** for now.
3. **Open that SoL URL once in a normal tab** so the browser solves Anubis and stores
   the clearance cookie.
4. Popup → **Start polling** → **Open dashboard**.

## Status states

- **ok** — parsed standings stored and rendered.
- **anubis** — the clearance expired; re-open the SoL page in a tab to re-solve, then **Poll now**.
- **error** — see the message in the popup (bad URL, HTTP error, parser issue).

## Adapt the parser

`src/parser.js` uses generic heuristics (pick the table that looks like a ranking,
map columns by header name). Once you can see your real SoL ranking markup, tighten
`pickRankingTable()` and the header key lists. The data shape it emits:

```json
{
  "tournament": "…", "round": 5, "updatedAt": "ISO", "sourceUrl": "…",
  "standings": [{ "rank": 1, "player": "…", "wins": 5, "points": 42, "spread": 120, "raw": [] }]
}
```

The local dashboard and the GH Pages dashboard consume this identical shape.

## Going public later (GitHub Pages)

1. Create a repo; put the contents of `gh-pages/` at its root (or `/docs`) and enable Pages.
2. Create a **fine-grained PAT** scoped to that repo with **Contents: read & write**.
3. Options → enable publishing, fill owner / repo / branch / path (`data.json`) / token, **Save**.

Each successful poll then commits `data.json`; the Pages dashboard re-fetches it every 20s.
The token lives only in this browser's local extension storage — it is never committed.

## Live timer & matches (multi-fetch)

Each poll fetches up to three SoL pages from your cleared browser session:

1. **Ranking page** (the configured lit URL) → standings, event meta, current turn,
   `prized` flag, and the integer `idtourney` (when the clock link is present).
2. **Current turn** (`?turn=<n>`) → the live boards/matches.
3. **Countdown** (`/tourney/countdown?idtourney=<n>`, public) → the round clock:
   `new Countdown('c1', duration, prealarm, elapsed|false, …)`.

`idtourney` is auto-detected once the clock is running; before that, set it in Options
(you can read it from the pre/countdown URL, e.g. `…?idtourney=1198`). Steps 2 and 3 are
best-effort — if one fails or isn't available yet, the rest of the dashboard still updates.

Handled tournament states (shown in the footer): **before first round**, **round prepared**,
**round running** → **prealarm** → **round over**, **between rounds**, next round, and
**final results** (clock hidden, prizes). When there are no live boards or no clock, those
panels hide and standings span full width.

## Debugging

Every poll is logged (console + a rolling buffer), and the **last raw SoL response**
plus the parse result are stored. Two ways to look:

- **Live console:** `chrome://extensions` → the extension → **service worker** → DevTools.
  Lines are tagged `[SoL <scope>] …` (fetch, parse, publish, poll, control).
- **Export bundle:** popup → **Export debug** (or Options → **Export debug bundle**).
  Downloads a JSON with `logs`, `debug.lastResponse` (the real HTML, capped ~500 KB),
  `debug.lastParsed`, `data`, `status`, and config. **The GitHub token is redacted.**
  Share that file to diagnose parser/fetch issues against real data.

Options shows a quick stat line (last response size/status, rows parsed, tables found),
a **Clear logs & debug** button, and a **Verbose logging** toggle for debug-level lines.

Tip for the first run: hit **Poll now**, then **Export debug** — even if the parser
mis-maps columns, the raw HTML in the bundle is enough to fix `src/parser.js`.

## Notes & limits

- Poll interval floor is **30s** (`chrome.alarms` minimum for unpacked extensions).
  The client-side "updated Xs ago" clock keeps the display feeling live regardless.
- Polling stops if the laptop sleeps or the browser closes — fine for a staffed
  dashboard; use a server only if you need 24/7 hands-off.
- Players never install anything; this is a dashboard-operator tool.
- **Firefox:** Firefox MV3 lacks `chrome.offscreen`. To port, move parsing into the
  background script (Firefox event pages have DOM access) instead of the offscreen doc.
