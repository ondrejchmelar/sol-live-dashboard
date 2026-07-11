# SoL Live Dashboard

A single HTML file that shows a **live [Scarry On-Line](https://sol5.metapensiero.it/) carrom tournament** on a big
screen — navy header, a large round clock, live boards, and standings. It reads SoL's public tournament pages
directly (clearing the Anubis anti-bot gate in the page itself), so there is **no server, no build, and nothing for
players to install**. Point it at your tournament and put it on a TV.

This README is about **getting it running for your own tournament**. For how the code works, see `CLAUDE.md`.

---

## The one catch: it needs a special Chrome launch

SoL doesn't send CORS headers, so a normal browser tab isn't allowed to *read* SoL's pages from another origin — and
it can't even see the Anubis challenge to solve it. The fix is to open the dashboard in a **throwaway Chrome started
with web security disabled and its own profile directory**. This is safe because that Chrome is disposable and used
only for the dashboard. Every deployment method below ends with this same launch step.

You need Chrome, Chromium, Edge, or Brave. **Firefox has no equivalent flag and will not work.**

---

## Step 1 — Find your tournament URL

Open your tournament's public page on SoL. The address looks like:

```
https://sol5.metapensiero.it/lit/tourney/<GUID>
```

`<GUID>` is the long hex string in the URL. Copy the whole URL — that's all the dashboard needs. Singles vs doubles is
detected automatically, so the same file works for either.

## Step 2 — Get the dashboard file

Download `standalone.html` from this repo (the single file is the whole app). Save it anywhere, e.g.
`~/sol/standalone.html`.

## Step 3 — Launch it

Replace the path and the `url=` with yours. The `--user-data-dir` is **required** (Chrome ignores
`--disable-web-security` on your normal profile) — point it at any empty throwaway folder.

**Linux**
```
google-chrome --disable-web-security --user-data-dir="/tmp/sol-kiosk" \
  --kiosk "file:///home/you/sol/standalone.html?url=https://sol5.metapensiero.it/lit/tourney/<GUID>"
```

**macOS**
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --disable-web-security --user-data-dir="/tmp/sol-kiosk" \
  --kiosk "file:///Users/you/sol/standalone.html?url=https://sol5.metapensiero.it/lit/tourney/<GUID>"
```

**Windows** (one line)
```
chrome.exe --disable-web-security --user-data-dir="%TEMP%\sol-kiosk" --kiosk "file:///C:/Users/you/sol/standalone.html?url=https://sol5.metapensiero.it/lit/tourney/<GUID>"
```

It opens fullscreen ("Waiting for SoL…"), solves Anubis in the page, and within a few seconds shows your tournament.
`--kiosk` gives fullscreen with no toolbars; drop it while testing if you want the address bar. Exit with `Alt+F4`
(or `Cmd+Q` on macOS).

---

## Options

Append these to the `?url=…` query string (`&` between them):

- `poll=<seconds>` — how often to refresh (default `60`, minimum `30`).
- `rounds=<N>` — total rounds, shown as "Round n / N" (Swiss events don't expose this; default `8`).
- `idt=<idtourney>` — the integer timer id. Normally auto-detected while the round clock runs; only set this if the
  clock never appears. You can read it from a countdown URL, e.g. `…?idtourney=1201`.

Example: `standalone.html?url=…/lit/tourney/<GUID>&poll=30&rounds=9`

---

## Deployment options

All three end with the **Step 3 launch** — hosting only changes *where the file lives*, not the need for the special
Chrome (the page still fetches SoL cross-origin).

### A. Local file (simplest)
Keep `standalone.html` on the display machine and launch it as in Step 3. Nothing else to set up.

### B. Bake your URL into the file (nice for kiosks)
So you don't have to pass `?url=` every time, copy the file and hard-code your tournament once:

1. Copy `standalone.html` to e.g. `mytourney.html`.
2. Open it in a text editor, find `CONFIG` near the top, and set `targetUrl` to your `…/lit/tourney/<GUID>` URL.
3. Launch it without a query string:
   `google-chrome --disable-web-security --user-data-dir="/tmp/sol-kiosk" --kiosk "file:///path/mytourney.html"`

(The shipped `standalone-singles.html` / `standalone-doubles.html` are exactly this — copies with a specific
tournament baked in.)

### C. Host on a web server
Upload `standalone.html` (or your baked copy) to any static host — e.g. `https://yoursite/dashboard/mytourney.html`
— by FTP or however you publish that site. Then on the display machine launch Chrome pointing at the **hosted URL**
instead of a `file://` path:

```
google-chrome --disable-web-security --user-data-dir="/tmp/sol-kiosk" \
  --kiosk "https://yoursite/dashboard/mytourney.html"
```

Hosting is convenient for updating the file centrally and for several screens, but each screen still runs its own
throwaway Chrome with the flags — visiting the URL in a normal browser will not work (CORS).

---

## Running it unattended (kiosk tips)

- **Auto-start on boot:** put the launch command in the OS autostart (a `.desktop` autostart entry or systemd user
  service on Linux, a Startup shortcut on Windows). A fresh `--user-data-dir` each boot is fine.
- **Keep the screen awake:** disable sleep/screensaver on the display machine.
- **Weak/laptop GPUs:** the dashboard is tuned to stay light on CPU (discrete-step pulsing, GPU-composited scrolling),
  so it runs comfortably unattended for hours.
- The Anubis clearance cookie lasts ~7 days, and the page re-solves automatically if it expires, so a long run is fine.

---

## If the dashboard can't get past Anubis

The in-page Anubis solver works today, but Anubis is third-party anti-bot software and an update could change its
puzzle. If the dashboard gets stuck on "Reconnecting to SoL…", use the **Chrome extension** in this repo as a
fallback: it runs Anubis's own code in a real browser tab, so it can't break on Anubis logic changes.

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this repo folder.
2. Extension **Options** → set your `…/lit/tourney/<GUID>` URL.
3. Open that SoL URL once in a normal tab so the browser solves Anubis.
4. Extension popup → **Start polling** → **Open dashboard**.

Same dashboard, same data — just a different way through the gate.

---

## Notes & limits

- **One field per file.** Singles and doubles are separate SoL tournaments; run one dashboard per tournament URL.
- **Pre-round timer.** While a round is being *prepared*, SoL exposes no way to know how much break time remains, so
  the header just says "Preparing the …round" without a countdown. A live clock appears once the round starts.
- **Firefox is not supported** — it has no `--disable-web-security` equivalent.
- This is an operator/display tool; players never install anything.
