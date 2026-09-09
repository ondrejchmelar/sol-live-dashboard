# SoL Live Dashboard — project context

A live **Scarry On-Line (SoL)** carrom tournament dashboard for a venue/corridor screen: navy header, big centred
clock, standings + live boards. It polls SoL public "lit" pages, clears the **Anubis** anti-bot gate, parses
**standings + boards + the round countdown**, and renders a projector-friendly corridor view.

- Upstream SoL: `https://sol5.metapensiero.it` — SoL v5 by Lele Gaifax (<https://gitlab.com/metapensiero/SoL>).
- Repo: `git@github.com:ondrejchmelar/sol-live-dashboard.git` (owner ondrejchmelar, chmelar.o@gmail.com).
- Target: one large 4K screen, ~10 h unattended.

## One file — `dashboard.html`

**`dashboard.html` is the whole deliverable**, and the only shipped file. One self-contained page: an in-browser
Anubis proof-of-work solver + SoL scraper + the dashboard, no extension and no server. It runs from `file://` or a
plain web host, but because SoL sends no CORS headers a normal tab can't read its responses — so it must be launched
in a throwaway Chrome with web security disabled (see "Running"). Verified end-to-end against live SoL (solver
cleared Anubis, full field parsed).

Configuration is by query string, so there are **no per-tournament copies of the file** — the two Eurocup 2026
screens are just links to one hosted copy with `?url=` set (singles `a61d1300…`, doubles `5de8f12a…`; both listed in
the README). Deployed to `carrom.cz/dashboard/` by FTP.

`CONFIG.targetUrl` **defaults to empty on purpose** — it used to hardcode the Eurocup singles GUID, which meant a
bare launch silently showed someone else's tournament. With it empty, `poll()` opens `#urlPrompt` instead: an
on-screen field for operators who don't want to hand-edit a query string. Submitting it sets `?url=` and reloads,
so the address bar ends up identical to the typed form and the result is bookmarkable — which is why the prompt
navigates rather than just assigning `CONFIG.targetUrl` in place. Baking a URL into `CONFIG` still skips both.

A Chrome extension used to live here as a fallback for Anubis changes (it ran Anubis's own JS in a hidden tab), with
the parsers in `src/*` as its source of truth and `dashboard.html` inlining ported copies. It was removed in July
2026 — the in-page solver has been reliable, and two copies of the parsers were a maintenance tax. The inlined code
is now the only copy; there is nothing left to keep in sync. Git history (before `main` at the cleanup commit) has
the extension, `src/*` and the old `gh-pages/` publish target if any of it is ever wanted back.

## Running / building

Everything that touches the live site must run **locally** (a personal git/SSH and a browser that can reach SoL). The
Claude Code web sandbox is firewalled from `sol5.metapensiero.it` and can't push to the repo. This environment's Bash
sandbox seccomp is broken — run Bash with `dangerouslyDisableSandbox: true`.

**The local CLI *can* reach SoL**, so live bytes are capturable without a browser: port the Anubis solve to a script
(GET the page, read the `#anubis_challenge` JSON, brute-force `sha256hex(randomData + nonce)` for `difficulty`
leading zeros — 4 today, ~15 ms in Python — then GET `pass-challenge` to bank the cookie). Headless Chrome with
`--disable-web-security --user-data-dir=…` also runs the real dashboard end to end against live SoL, which is the
strongest available test.

Launch it (Linux; macOS/Windows equivalents in the file's header comment):

```
google-chrome --disable-web-security --user-data-dir="/tmp/sol-dash" \
  "file:///ABS/PATH/dashboard.html?url=https://sol5.metapensiero.it/lit/tourney/<GUID>"
```

- `--user-data-dir` is **required** — Chrome ignores `--disable-web-security` on your normal profile.
- Firefox has no equivalent flag; use Chrome / Chromium / Edge / Brave.
- Config via query string or by editing `CONFIG` in the file: `?url=<lit URL>&poll=<sec>&rounds=<N>&idt=<idtourney>`.
- Anubis sets `techaro.lol-anubis-auth` (JWT, EdDSA, 7-day exp). SoL issues it `SameSite=None; Secure`, so it rides
  our cross-site fetches under `--disable-web-security` with no extra setup.

## SoL specifics (verified against real traffic — the valuable, non-re-derivable part)

### URLs & identifiers
- Public tournament page: `/lit/tourney/{guid}` — `{guid}` is a random type-1 UUID with dashes stripped.
- Per-turn view: `/lit/tourney/{guid}?turn=N` — round N's boards (`table.matches`) plus the ranking.
- Round countdown (public, no login): `/tourney/countdown?idtourney=<INT>`.
- Pre-round timer: `/tourney/pre_countdown?idtourney=<INT>&duration=<min>&prealarm=<min>`.
- **`idtourney`** is an integer PK, distinct from the guid and not derivable from it. It appears on the lit page only
  inside a countdown-style link — the `countdown` link while the clock runs, or the `pre_countdown` ("Preparing…")
  link while a round is being prepared. Auto-detect it and **cache it per tournament URL** so a previous tournament's
  id can't leak into a new one; manual `idt=` override is the fallback.

### Ranking table (`table.ranking`)
- Header **"Team"** ⇒ doubles, **"Player"** ⇒ singles. Names are **"Surname Firstname"** (Czech order); doubles
  competitors joined by ` and `. When **prized**, a prize/total column appears — **verified** against the finished
  28th Eurocup Singles: `<th class="center aligned sortedby total-header">Prize</th>` plus one
  `<td class="right aligned sortedby total">` per row. Both the `td.total` and the "Prize" header check match.

### Club emblems (`/lit/club/{guid}`, `/lit/emblem/{hash}.{ext}`)
- A tourney names **two** clubs in its details table: **"Club"** owns the championship, **"Hosted by"** actually runs
  the event. The `<img id="emblem">` inside `<div id="club_emblem">` on the *tourney* page is the **championship
  owner's** — on Eurocup 2026 it's the European Carrom Confederation, while the organiser is the Czech Carrom
  Association. So the organiser's emblem is only reachable by following the "Hosted by" link to `/lit/club/{guid}`,
  whose page carries its own `<img id="emblem" src="/lit/emblem/{hash}.{ext}" title="{club name}">`.
- Emblem **extensions vary** (`.bmp` for ECC, `.png` for CCA) — SoL serves whatever the club uploaded, so never
  assume PNG and never assume a sane aspect ratio; that's why the header emblem has an operator off-switch.

### Matches table (`table.matches`, `?turn=N`)
- **August 2026 restructure** (verified against a live turn export, "24th Carrom Eurocup Singles"): each match is now
  **two `<tr>`**, not one. The first carries `td.rank[rowspan=2]` (the board/match number — despite the name, this
  is *not* a player ranking) plus competitor1; the second carries competitor2, or a lone `td.phantom`/`td.phantom`
  pair on a bye. Confirmed against upstream (`gitlab.com/metapensiero/SoL`, `src/sol/views/lit/tourney.mako`,
  `matches_row()`).
- Competitor **name and score share one class** (`competitor1`/`competitor2`) across two `<td>`s in the same `<tr>` —
  the one containing an `<a>` is the name, the other (`right aligned`) is the score. Pick by presence of `<a>`, not
  position.
- **The finished signal moved from the `<tr>` to the score `<td>`**: `td.competitor1.partial-score` /
  `td.competitor2.partial-score` (both, since they share one `scored` flag server-side) = match NOT final — covers
  not-started and a running live score (upstream substitutes `partial_score1`/`partial_score2` for the shown value
  when unscored, so the number is real, not always 0). Its absence = finalized. `tr.partial-score` is now only used
  by the separate "training boards" championship layout — don't key off it for the standard singles/doubles table.
- `.winner` on a competitor cell / score cell marks the leader on finalized matches.

### Countdown page (`/tourney/countdown?idtourney=N`)
Inline `<body onload>`: `new Countdown('c1', <durationMin>, <prealarmMin>, <elapsedMs>|false, <isowner>)`.
- 4th arg is **elapsed MILLISECONDS** (increments ~1000/real-second), or `false` if the clock hasn't started (`ready`).
- `over` when `elapsedMs >= durationMin*60*1000`. Compute `startedAtISO = now − elapsedMs`.

### Pre-round page (`/tourney/pre_countdown`)
Renders `new PreCountdown('c1', dur, pre)` with **no elapsed / no server anchor** — it just starts fresh from `dur` on
load, and `dur`/`pre` live only in the request URL. So the true remaining time is **not knowable** from SoL. We use
the `pre_countdown` *link* on the tourney page only to **label** the state ("Preparing the first round") — we do
**not** render a live pre-round timer (any number would be fabricated). See `extractPreCountdown` + the `prepare` state.

### Anubis (anti-bot PoW gate)
- Clearance is **origin-wide** (one solve clears lit + turn + countdown). A challenge page has no `<table>`; detect via
  `/anubis|not a bot|proof[- ]of[- ]work/i` + absence of `<table>`.
- PoW: find `nonce` such that `sha256hex(randomData + nonce)` has `difficulty` leading-zero hex chars; submit to
  `/.within.website/x/cmd/anubis/api/pass-challenge?…` to get the auth cookie. Done in-page by `solvePoW`.

## Corridor data shape (single source of truth — `buildCorridor`)

```js
{
  event: { name, type: "doubles"|"singles", currentRound, totalRounds, location, club, system },
  clock: { mode: "running"|"ready"|"over", durationMin, prealarmMin, startedAtISO, elapsedSec } | null,
  matches: [ { board, side1:[names], side2:[names], score1, score2, finished, winner:0|1|2, phantom } ],
  standings: [ { rank, players:[names], pts, bch, net } ],
  state: "running"|"ready"|"over"|"prepare"|"pre"|"idle"|"final",
  updatedISO
}
```

`state` is `prepare` when there's no clock but a `pre_countdown` link is present; `pre` before the first round with no
such link; `idle` when a turn exists but no clock. `adapt.js` also flips a `ready` clock → `over` when its boards are
already scored (so "Round ended" holds until new pairings are drawn).

## Behaviour to preserve (don't regress)

- **Layout:** standings always visible — except while round 1 is still in play (`showStandings`), when the ranking
  would only echo seeding and the matches take the full width. Matches column-major; match-column count = as many
  as fit beside the standings panel (`MATCH_MIN_COL`, per event type — 5 singles / 3 doubles at 4K), capped at one
  column per ~6 boards so small rounds don't over-spread. Standings panel beside matches has a fixed per-type width
  (`STAND_PANEL_REM`); the no-matches player list uses per-type `STAND_MIN_COL`.
  All three are tuned so the longest expected names fit unclipped at 4K — singles "WEERAWARNAKULA Haritha" (368px at
  the 1.35rem font cap), doubles "BANKOVIC Aleksandar/PAVLOVIC Aleksandar" (596px); longer names may ellipsize.
  Fonts rem-based (`html{font-size:20px}`) so browser zoom scales everything.
  `[`/`]`/`\` (and the settings panel's own **Columns** −/Auto/+ row, `#setColsOut`/`#setColsPct`/`#setColsIn`, wired
  straight to `adjustCols`/`setColsOverride`) let an operator step or reset a manual `COLS_OVERRIDE`
  (`solDash.cols`, 1–10) on top of this auto-fit — `matchColumns`/`standingsCols` return it verbatim when set,
  falling back to the renamed `autoMatchColumns`/`autoStandingsCols` otherwise. It has no effect on the finals
  panel (always one column) and, like `ZOOM`, triggers `renderMatches`/`renderStandings`/`layoutPanels` and its
  own readout sync (`syncColsReadout`, mirroring `syncZoomReadout`) on change.
- **Header emblem:** `resolveEmblem()` resolves **both** clubs — `EMBLEM.host` (the "Hosted by"
  organiser) and `EMBLEM.owner` (the championship club, free from the tourney page's own `#emblem`, so still just
  **one** fetch, for the host). Fires after the first render and must never block or delay it. Cached per tournament
  URL: successes persisted, a miss remembered for the session only so a transient failure doesn't disable it
  permanently. One setting, `EMBLEM_MODE` ∈ `host|owner|off`, chooses; `emblemPick()` falls back to the other club
  when the chosen one has no emblem. Priority: `&logo=` → chosen club → other club → bundled board icon. `off`
  exists because emblem formats and aspect ratios are arbitrary (see the SoL notes) — keep the operator's off-switch,
  and keep `syncEmblemUI()` naming the real clubs in the dropdown ("Hosting club — Czech Carrom Association"), since
  the bare roles are meaningless to an operator.
  **The cache load shape-checks (`"host" in e || "owner" in e`), not just the URL** — an entry written by the earlier
  single-emblem build has `{src,title,tried:true}`, and matching on URL alone made `resolveEmblem` skip forever and
  strand the header on the board icon. Any future change to the cached shape needs the same guard.
- **Settings panel:** the **single** editor for every operator setting — message, next-round time,
  break, total rounds, zoom, columns, QR toggle, emblem toggle. Four ways in, all `openSettings()`: the logo (`#logoBtn`, gear badge on
  hover), the Space key, the clock's next-round block, and the "Round n / N" subtitle. There are deliberately **no
  per-setting dialogs any more**; don't reintroduce one. It opens in a **detached `window.open`** so the operator can
  drag it off the projector and type unseen, falling back to `#settingsOverlay` when the popup is blocked — so every
  lookup goes through the *host* document (`settingsHost()`), never the global `document`, and the form lives in
  `<template id="settingsTpl">` with its CSS in `<style id="setCss">`, whose text is copied into the popup verbatim.
  That CSS is scoped to `.sset`, carries its own custom properties, and sizes in `em` off a 16px base **on purpose**:
  the panel must not ride the zoomed rem base, or screen zoom would resize the operator's own controls. `body>.sset`
  fills the popup and `fitSettingsWindow()` grows the window to the form's `scrollWidth/Height`, measured against
  `inner*` because browser chrome varies — that's what keeps a scrollbar out of it.
  **"Next round start" is deliberately not pre-filled** with the auto estimate — pre-filling would silently freeze
  it into a manual override the first time anyone pressed Apply after editing an unrelated field; the estimate goes
  in the hint text instead.
- **Zoom:** browser zoom's steps are too coarse for a
  corridor screen and can't be driven from JS, so the footer carries a hover-only `− 100% +` control (`.zoomctl`,
  absolutely centred; `setZoom`/`applyZoom`) that scales the **rem base** in 5% steps, 50–200%, persisted in
  `solDash.zoom`. Because the px width thresholds are *not* rem, `matchColumns`, `standingsCols` and the
  `STAND_PANEL_REM`→px conversion multiply by `ZOOM` (and autoscroll by `ZOOM`, so drift stays perceptually equal) —
  keep any new px-based width threshold scaled the same way, or it won't re-flow when zoomed.
- **Names:** surname bold caps, first name regular; doubles on one slash-separated line, ellipsis-truncated.
- **Clock states:** running → "In progress"; prealarm; over → "Round ended" in red, holds until new pairings are
  drawn; ready → "Round prepared". `prepare`/`pre` show only a header label, **no timer bar**.
- **Standings rank pills:** snug, digits centred, **right-aligned** so every pill's right edge lines up and the gap to
  the name is constant for 1–3 digit ranks (`col.cg-r` sized to hold a 3-digit pill without overflow). 100+ players
  are expected.
- **Manual scrolling:** the wheel (and touch drag) nudge the same `pos` the autoscroll drives, rather than making
  `.sclip` natively scrollable — going native would give up the GPU-composited transform below. A manual scroll holds
  the automatic drift off for `SCROLL_MANUAL_MS` (10 s), then it resumes from wherever the operator left it.
- **Performance (a hard-won fix — see the CSS comments):** never use smooth `infinite` CSS animations. The pulsing
  "live"/prealarm indicators use **discrete `step-end`** keyframes (the "live" dot is an eased multi-stop breathing
  curve on `step-end`), and autoscroll drives a **GPU `transform: translateY`** throttled to ~20fps (`SCROLL_FRAME_MS`)
  rather than `scrollTop`. Together these took the dashboard from ~1 CPU core to a fraction of one on weak integrated
  GPUs. Smooth interpolation or per-frame scroll writes will bring the core back.
- **No demo fallback:** with no live data show an empty board; on an Anubis challenge show "Reconnecting to SoL…".
- **Footer connection badge** (`#connbadge`, `CONN_STATES`, driven only by `applyStatus`): green *Live* once data
  renders, amber *Connecting* before the first poll and during an Anubis solve, orange *Offline* on a failed poll,
  hidden entirely while the URL prompt is up. It was previously hardcoded green "LIVE" in the markup and never
  updated, so it claimed a working SoL connection in every one of those states. `start()` — not `poll()` — sets the
  `ok` state, because rendering real data *is* the live signal; that also keeps the mock-driven screenshots honest
  without the harness having to fake a status. The badge is only rewritten when the state actually changes, and the
  dot element is never replaced, or the blink would restart on every poll.

## Dev workflow / gotchas

- Validate JS with `node --check`. `dashboard.html` is large (inline CSS + a base64 logo) — edit specific ranges,
  don't Read it whole.
- To verify rendering without the live site: build a harness that inlines a mock data object and calls `start(mock)`
  in place of the boot block, then screenshot with headless Chrome (`--headless=new --screenshot`, or `--dump-dom`
  reading `document.title` for computed-style probes).
- **README screenshots** (`screenshots/*.png`) are generated from mock data against the real `dashboard.html` by
  `screenshots/generate.py` (needs `google-chrome` + Pillow), so they stay truthful. Whenever a change alters the
  dashboard's appearance — layout, header/clock, standings, matches, or the finals panel — **re-run
  `python3 screenshots/generate.py`** and commit the updated PNGs. The mock scenarios (player pool, scores, clock
  states, next-round/updated times) live in that script; edit them there, not by hand-editing images.
  The harness freezes CSS animations (`animation-play-state:paused` at delay 0) so every blink lands on keyframe 0%
  instead of whatever phase the run reached — without it the PNGs churn on every regeneration. The two
  running-clock shots (`02`, `03`) still drift, because their countdown ticks between page build and capture;
  `git checkout` those when only the digits moved, so the diff shows real changes.
  Overlay shots (settings, URL prompt) are cropped to their panel via `PANEL_SEL` + `panel_rect`; the settings one
  stubs `window.open` so the panel takes its in-page fallback, since headless can't capture the detached popup.
  **Injections into the page must use `.replace(…, 1)`** — `</head>` also appears inside `openSettings`' own
  `document.write` string, and a probe carrying `</script>` injected there truncates the app's main script.
- Never push without the user reviewing the diff. Deploying to `carrom.cz` is a manual FTP copy of the HTML files.

## Known limitations / TODO

- ~~`final`/`prized` unverified~~ — **done**: verified against the finished 28th Eurocup Singles (see the ranking
  table notes). The decided best-of-three final and the prized ranking both render correctly from live bytes.
- Pre-round shows a label only; a live pre-round countdown is impossible without a server anchor from SoL.
- The in-page Anubis solver is the single point of failure if Anubis changes its puzzle — there is no fallback in the
  repo any more (see the extension note at the top). Symptom: stuck on "Reconnecting to SoL…".
