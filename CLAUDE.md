# SoL Live Dashboard — project context

A live **Scarry On-Line (SoL)** carrom tournament dashboard for a venue/corridor screen: navy header, big centred
clock, standings + live boards. It polls SoL public "lit" pages, clears the **Anubis** anti-bot gate, parses
**standings + boards + the round countdown**, and renders a projector-friendly corridor view.

- Upstream SoL: `https://sol5.metapensiero.it` — SoL v5 by Lele Gaifax (<https://gitlab.com/metapensiero/SoL>).
- Repo: `git@github.com:ondrejchmelar/sol-live-dashboard.git` (owner ondrejchmelar, chmelar.o@gmail.com).
- Target: one large 4K screen, ~10 h unattended.

## Two implementations — standalone is primary

1. **`standalone.html` — the primary deliverable.** One self-contained file: an in-browser Anubis proof-of-work
   solver + SoL scraper + the dashboard, no extension and no server. It runs from `file://` or a plain web host, but
   because SoL sends no CORS headers a normal tab can't read its responses — so it must be launched in a throwaway
   Chrome with web security disabled (see "Running"). Verified end-to-end (solver cleared Anubis, full field parsed).
   - `standalone-singles.html` / `standalone-doubles.html` — byte-identical copies of `standalone.html` with a
     tournament URL baked into `CONFIG.targetUrl` (singles `a61d1300…`, doubles `5de8f12a…`). Regenerate with
     `cp standalone.html standalone-<x>.html` then re-bake the doubles guid. Deployed to `carrom.cz/dashboard/` by FTP.

2. **The Chrome extension — the fallback** for when the standalone's in-page PoW solver can't clear Anubis (e.g. an
   Anubis version bump changes the algorithm). The extension runs Anubis's *own* JS in a real hidden tab, so it can't
   break on Anubis logic changes. Same parsers, same dashboard. Files: `manifest.json`, `background.js` (service
   worker poll loop), `offscreen.*` (DOMParser host), `src/*`, `dashboard/*`, `popup/*`, `options/*`.

The `src/*` modules (`parser.js`, `adapt.js`, `countdown.js`, `fetcher.js`, `storage.js`, `logger.js`) are the
extension's source of truth; **`standalone.html` inlines ported copies of the same logic.** Keep them in sync when
you touch parsing/adapting behaviour.

## Running / building

Everything that touches the live site must run **locally** (a personal git/SSH and a browser that can reach SoL). The
Claude Code web sandbox is firewalled from `sol5.metapensiero.it` and can't push to the repo. This environment's Bash
sandbox seccomp is broken — run Bash with `dangerouslyDisableSandbox: true`.

Launch the standalone (Linux; macOS/Windows equivalents in the file's header comment):

```
google-chrome --disable-web-security --user-data-dir="/tmp/sol-kiosk" \
  --kiosk "file:///ABS/PATH/standalone.html?url=https://sol5.metapensiero.it/lit/tourney/<GUID>"
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
  competitors joined by ` and `. When **prized**, a prize/total column appears (`td.total` / header "Prize") — the
  `final` state marker (not yet verified against real prized bytes).

### Matches table (`table.matches`, `?turn=N`)
- **`<tr class="partial-score">` = the match is NOT final** (covers 0:0 not-started and a running QR score). Its
  **absence = finalized** — this is the authoritative "finished" signal; rely on the class, not the score value.
- `.winner` on a competitor cell / score span marks the leader on finalized matches. Board number = the `td.rank` cell.

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
  `/.within.website/x/cmd/anubis/api/pass-challenge?…` to get the auth cookie. The standalone does this in-page
  (`solvePoW`); the extension instead runs Anubis's own JS in a hidden tab.

## Corridor data shape (single source of truth — `buildCorridor` in src/adapt.js)

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

- **Layout:** standings always visible. Matches column-major; match-column count by board count (**<15→1, 15–29→2,
  30+→3**); standings is the extra column. Fonts rem-based (`html{font-size:20px}`) so browser zoom scales everything.
- **Names:** surname bold caps, first name regular; doubles on one slash-separated line, ellipsis-truncated.
- **Clock states:** running → "In progress"; prealarm; over → "Round ended" in red, holds until new pairings are
  drawn; ready → "Round prepared". `prepare`/`pre` show only a header label, **no timer bar**.
- **Standings rank pills:** snug, digits centred, **right-aligned** so every pill's right edge lines up and the gap to
  the name is constant for 1–3 digit ranks (`col.cg-r` sized to hold a 3-digit pill without overflow). 100+ players
  are expected.
- **Performance (a hard-won fix — see the CSS comments):** never use smooth `infinite` CSS animations. The pulsing
  "live"/prealarm indicators use **discrete `step-end`** keyframes (the "live" dot is an eased multi-stop breathing
  curve on `step-end`), and autoscroll drives a **GPU `transform: translateY`** throttled to ~20fps (`SCROLL_FRAME_MS`)
  rather than `scrollTop`. Together these took the dashboard from ~1 CPU core to a fraction of one on weak integrated
  GPUs. Smooth interpolation or per-frame scroll writes will bring the core back.
- **No demo fallback:** with no live data show an empty board; on an Anubis challenge show "Reconnecting to SoL…".

## Dev workflow / gotchas

- Validate JS with `node --check`. `standalone.html` and `dashboard/dashboard.html` are large (inline CSS + a base64
  logo) — edit specific ranges, don't Read them whole.
- To verify rendering without the live site: build a harness that inlines a mock data object and calls `start(mock)`
  in place of the boot block, then screenshot with headless Chrome (`--headless=new --screenshot`, or `--dump-dom`
  reading `document.title` for computed-style probes).
- After editing `standalone.html`, regenerate the two distributable copies and re-bake the doubles guid.
- Never push without the user reviewing the diff. Deploying to `carrom.cz` is a manual FTP copy of the HTML files.

## Known limitations / TODO

- `final`/`prized` state is unverified against real prized bytes — capture the lit HTML when a tournament finishes.
- Pre-round shows a label only; a live pre-round countdown is impossible without a server anchor from SoL.
- `gh-pages/` is an old, simple `data.json` dashboard, not the corridor design — only relevant if publish is used.
- The standalone's in-page Anubis solver is the weak point if Anubis changes; the extension is the fallback then.
