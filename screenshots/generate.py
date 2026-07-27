#!/usr/bin/env python3
"""Regenerate the README screenshots from mock data against the real dashboard.html.

The five shots (pre-round player list, a live round, the prealarm warning, a
best-of-three final, and the settings panel) are rendered from the mock scenarios below
through the *actual* `dashboard.html` render path — so they stay truthful whenever the UI
changes. Edit the scenarios here (player pool, scores, clock state, next-round / updated
times) and re-run.

Usage:  python3 screenshots/generate.py
Needs:  `google-chrome` on PATH (override with $CHROME) and Pillow (`pip install pillow`).

How it works: each scenario replaces dashboard.html's poll bootstrap with `start(MOCK)`,
injects `font-size:16px` for a denser 1080p view, screenshots headless at 1920x1080, then
crops the ~87px blank strip headless leaves below the (smaller) layout viewport. The
settings shot stubs `window.open` so `openSettings()` takes the in-page overlay fallback
(headless can't show the detached popup), then crops to the panel plus a strip of the
dimmed dashboard around it.
"""
import os, re, json, random, datetime, subprocess, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = open(os.path.join(ROOT, "dashboard.html"), encoding="utf-8").read()
BOOT = "poll();\nsetInterval(poll, Math.max(30, CONFIG.pollSeconds) * 1000);"
HEAD_INJ = "<style>html{font-size:16px!important}</style>"
CHROME = os.environ.get("CHROME", "google-chrome")
W, H = 1920, 1080
random.seed(42)

PLAYERS = [
    "Nilam Mohamed Sadurdeen", "Pangare Prashant", "Cristiani Gianluca", "Krüger Tobias", "Kumar Ish",
    "Vanderlan Ayesh Nilan", "Gallo Nicolò", "Thavarajasingam Nisanthan", "Deshpande Swapnil", "Krishnan Raja",
    "Sanakal Amar", "Sasinski Jakub", "Chavda Natvarsingh", "Hassan Mehedi", "Kulkarni Yogesh",
    "Nelehthi Wipul Priyantha", "Dubois Pierre", "Swamy Sampath", "Kowalski Longin", "Sieger Kevin",
    "Wannuka Fernando Anjula", "Lusardi Frédéric", "Narkar Chandan", "Cano Lucien", "Nowakowski Jakub",
    "Wurst Heiko", "Dix Raphel", "Novák Karel", "Girault Patrice", "Meyer Josef", "Vethanayagam Antonio",
    "Hürlimann Lorenzo", "Pidial Yoann", "Lerouge Benoit", "Welikumbura Wasantha", "Pushpala Kalyan",
    "Weerawarnakula Haritha", "Cano Tifenn", "Stroebe Sarah", "Peter Wolfgang", "Bednář Matěj",
    "Chatelain Mathieu", "Ubhayathunga Amitha", "Kugathas Selvarasha", "Fehr Frank", "Günes Mürsel",
    "Fernando Anuradha", "Polchow Dirk",
]


def standings(names, played=True):
    out = []
    for i, p in enumerate(names):
        if played:
            out.append({"rank": i + 1, "players": [p], "pts": max(0, round((len(names) - i) / len(names) * 15)),
                        "bch": 60 - i, "net": (len(names) - 2 * i) * 3})
        else:
            out.append({"rank": i + 1, "players": [p], "pts": "", "bch": "", "net": ""})
    return out


def matches(n, finished_frac):
    ms = []
    for b in range(n):
        a, c = PLAYERS[(b * 2) % len(PLAYERS)], PLAYERS[(b * 2 + 1) % len(PLAYERS)]
        if random.random() < finished_frac:
            lo = random.randint(3, 22)
            s1, s2, w = (25, lo, 1) if random.random() < 0.5 else (lo, 25, 2)
            ms.append({"board": b + 1, "side1": [a], "side2": [c], "score1": s1, "score2": s2,
                       "finished": True, "winner": w, "phantom": False})
        else:
            ms.append({"board": b + 1, "side1": [a], "side2": [c], "score1": random.randint(0, 20),
                       "score2": random.randint(0, 20), "finished": False, "winner": 0, "phantom": False})
    return ms


def clock(mode, remaining_min):
    dur = 54.0
    elapsed = int((dur - remaining_min) * 60)
    started = (datetime.datetime.utcnow() - datetime.timedelta(seconds=elapsed)).isoformat() + "Z"
    return {"mode": mode, "durationMin": dur, "prealarmMin": 5.0, "startedAtISO": started, "elapsedSec": elapsed}


def event(round_n):
    return {"name": "28th Eurocup Singles", "type": "singles", "currentRound": round_n,
            "totalRounds": 8, "location": "Prague", "club": "", "system": "Swiss"}


def harness(data, next_manual=None, next_iso=None, extra_js=""):
    pre = ""
    if next_manual is not None:
        pre += "NEXT.manual=" + json.dumps(next_manual) + ";"
        if next_iso is not None:  # keep the manual override from being wiped when the clock ticks
            pre += ("NEXT.roundISO=" + json.dumps(next_iso) +
                    ";NEXT.endMs=new Date('" + next_iso + "').getTime()+54*60000;NEXT.savedMs=Date.now();")
    js = pre + "\nconst MOCK=" + json.dumps(data) + ";\nstart(MOCK);\n" + extra_js
    # count=1: "</head>" also occurs inside openSettings' document.write string, and
    # anything injected there — worst of all a probe's own "</script>" — corrupts it.
    return SRC.replace("</head>", HEAD_INJ + "</head>", 1).replace(BOOT, js)


# Generic badge standing in for a club emblem, so the settings shot shows the emblem
# state an operator actually sees mid-tournament (clubs named, one resolved) instead of
# the transient "Looking up the club emblem…".
EMBLEM_SVG = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
              "<circle cx='32' cy='32' r='30' fill='%23f7f4ec'/>"
              "<rect x='14' y='14' width='36' height='36' rx='4' fill='%230b1e33'/>"
              "<circle cx='32' cy='32' r='7' fill='%23f7f4ec'/><circle cx='19' cy='19' r='3' fill='%23f7f4ec'/>"
              "<circle cx='45' cy='19' r='3' fill='%23f7f4ec'/><circle cx='19' cy='45' r='3' fill='%23f7f4ec'/>"
              "<circle cx='45' cy='45' r='3' fill='%23f7f4ec'/></svg>")


def settings_js(clk):
    """Open the settings panel over the live-round backdrop, every field populated the
    way a real tournament populates it: the next-round hint fed from the running clock,
    both clubs resolved, and a message on the ticker (which also pre-fills the textarea)."""
    return (
        # Headless can't render the detached popup — force the in-page overlay fallback.
        "window.open=()=>null;"
        + "NEXT.endMs=new Date(" + json.dumps(clk["startedAtISO"]) + ").getTime()"
        + "+" + str(clk["durationMin"]) + "*60000;NEXT.savedMs=Date.now();"
        + "EMBLEM={url:CONFIG.targetUrl,tried:true,"
        + "host:{src:" + json.dumps(EMBLEM_SVG) + ",title:'Czech Carrom Association'},"
        + "owner:{src:" + json.dumps(EMBLEM_SVG) + ",title:'European Carrom Confederation'},"
        + "hostName:'Czech Carrom Association',ownerName:'European Carrom Confederation'};"
        + "applyLogo();"
        + "setMessage('Please clear your boards promptly — lunch follows this round.');"
        + "openSettings();"
    )


def run_chrome(args):
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
                    f"--window-size={W},{H}", "--force-device-scale-factor=1"] + args,
                   check=True, capture_output=True)


def inner_height(html):
    """Headless renders in a viewport shorter than the window; measure it so we can crop
    the blank strip the screenshot leaves below the layout."""
    probe = "<script>addEventListener('load',()=>setTimeout(()=>document.title='IH'+innerHeight,400))</script>"
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "probe.html")
        open(p, "w", encoding="utf-8").write(html.replace("</head>", probe + "</head>", 1))
        r = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox",
                            f"--window-size={W},{H}", "--force-device-scale-factor=1",
                            "--virtual-time-budget=1500", "--dump-dom", f"file://{p}"],
                           capture_output=True, text=True)
    m = re.search(r"IH(\d+)", r.stdout)
    return int(m.group(1)) if m else H


def panel_rect(html):
    """Bounding box of the overlay-hosted settings panel, probed like inner_height."""
    probe = ("<script>addEventListener('load',()=>setTimeout(()=>{"
             "const r=document.querySelector('#settingsOverlay .sset').getBoundingClientRect();"
             "document.title='PR'+JSON.stringify([r.left,r.top,r.right,r.bottom].map(Math.round))"
             "},600))</script>")
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "probe.html")
        open(p, "w", encoding="utf-8").write(html.replace("</head>", probe + "</head>", 1))
        r = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox",
                            f"--window-size={W},{H}", "--force-device-scale-factor=1",
                            "--virtual-time-budget=2000", "--dump-dom", f"file://{p}"],
                           capture_output=True, text=True)
    m = re.search(r"PR\[(-?\d+),(-?\d+),(-?\d+),(-?\d+)\]", r.stdout)
    return tuple(int(g) for g in m.groups()) if m else None


PANEL_PAD = 56  # dimmed dashboard visible around the panel, so the overlay context reads


def shoot(name, html, crop_h, box=None):
    with tempfile.TemporaryDirectory() as d:
        hp = os.path.join(d, "h.html")
        open(hp, "w", encoding="utf-8").write(html)
        out = os.path.join(HERE, name + ".png")
        run_chrome([f"--screenshot={out}", "--virtual-time-budget=2500", f"file://{hp}"])
    im = Image.open(out)
    if box:
        left, top, right, bottom = box
        im.crop((max(0, left - PANEL_PAD), max(0, top - PANEL_PAD),
                 min(im.width, right + PANEL_PAD),
                 min(crop_h, im.height, bottom + PANEL_PAD))).save(out)
    else:
        im.crop((0, 0, im.width, min(crop_h, im.height))).save(out)
    print("wrote", os.path.relpath(out, ROOT), "->", Image.open(out).size)


def build_shots():
    A, B = ["Dubois Pierre"], ["Vanderlan Ayesh Nilan"]
    rest = [p for p in PLAYERS if p not in ("Dubois Pierre", "Vanderlan Ayesh Nilan")]
    # Prealarm is not a state of its own: the clock is still "running" and the corridor
    # state is still "running" — the amber header is derived from the remaining seconds
    # falling under prealarmMin. Inventing a "prealarm" state here would hide the live
    # dot on every unfinished board, since that badge keys off state === "running".
    c_run, c_pre = clock("running", 24.6), clock("running", 1.6)
    live = {"event": event(6), "clock": c_run, "matches": matches(30, 0.45), "standings": standings(PLAYERS),
            "state": "running", "updatedISO": "2026-07-18T10:56:00Z"}
    return [
        # (filename, harness html, ...)
        ("01-players", harness(
            {"event": event(None), "clock": None, "matches": [], "standings": standings(PLAYERS, played=False),
             "state": "pre", "updatedISO": "2026-07-18T06:50:00Z"}, next_manual="9:00")),
        ("02-round-live", harness(live, next_manual="~13:30", next_iso=c_run["startedAtISO"])),
        ("03-round-prealarm", harness(
            {"event": event(6), "clock": c_pre, "matches": matches(30, 0.82), "standings": standings(PLAYERS),
             "state": "running", "updatedISO": "2026-07-18T11:18:00Z"}, next_manual="~13:30", next_iso=c_pre["startedAtISO"])),
        ("04-final", harness(
            {"event": event(16), "clock": None,
             "matches": [{"board": 1, "side1": A, "side2": B, "score1": 25, "score2": 3, "finished": True, "winner": 1, "phantom": False}],
             "standings": standings(["Dubois Pierre", "Vanderlan Ayesh Nilan"] + rest), "state": "final",
             "finals": {"kindLabel": "Best of three games", "games": 3, "need": 2, "firstTurn": 14, "currentGame": 3,
                        "pairings": [{"a": A, "b": B, "rank": 1,
                                      "games": [{"a": 19, "b": 14, "finished": True, "live": False, "winner": 1},
                                                {"a": 12, "b": 16, "finished": True, "live": False, "winner": 2},
                                                {"a": 25, "b": 3, "finished": True, "live": False, "winner": 1}],
                                      "wins": {"a": 2, "b": 1}, "decided": True, "winnerSide": "a"}]},
             "updatedISO": "2026-07-18T15:57:00Z"})),
        # The operator's settings panel, over the same live round. The manual next-round
        # field stays empty on purpose — that's its designed state (see the hint).
        ("05-settings", harness(live, extra_js=settings_js(c_run))),
    ]


def main():
    shots = build_shots()
    crop_h = inner_height(shots[1][1])  # measure once from the live-round layout
    print("layout viewport height:", crop_h)
    for name, html in shots:
        box = None
        if name == "05-settings":
            box = panel_rect(html)
            if not box:
                raise SystemExit("settings panel not found — the overlay didn't open")
        shoot(name, html, crop_h, box=box)


if __name__ == "__main__":
    main()
