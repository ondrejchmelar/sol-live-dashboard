// Public dashboard: polls data.json (cache-busted) and re-renders. The "updated
// Xs ago" clock ticks client-side so it stays live between fetches.

const el = (id) => document.getElementById(id);
let lastUpdatedMs = 0;

// Self-contained autoscroll (this folder deploys on its own, so no shared import):
// creep down, pause at the bottom, reverse, pause at the top, repeat. Stops on
// real interaction; the toggle button re-arms it. Mirrors SoL's own behavior.
const scroller = (() => {
  const STEP = 6;
  const EVERY = 90;
  const END_PAUSE = 1000;
  let interval = null;
  let autoTried = false;
  const button = () => document.getElementById('autoscroll');
  const setPressed = (on) => button()?.setAttribute('aria-pressed', on ? 'true' : 'false');

  function start() {
    if (interval) return;
    let scrollBy = STEP;
    let prevY = null;
    interval = setInterval(() => {
      if (scrollBy !== 0 && prevY === window.pageYOffset) {
        const old = scrollBy;
        scrollBy = 0;
        setTimeout(() => {
          scrollBy = -old;
          prevY -= STEP;
        }, END_PAUSE);
      }
      prevY = window.pageYOffset;
      if (scrollBy) window.scrollBy({ top: scrollBy, behavior: 'smooth' });
    }, EVERY);
    setPressed(true);
  }
  function stop() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    setPressed(false);
  }
  ['mousedown', 'keydown', 'touchstart', 'wheel'].forEach((ev) =>
    window.addEventListener(
      ev,
      (e) => {
        if (!interval) return;
        if (e.target?.closest?.('#autoscroll')) return;
        stop();
      },
      { passive: true }
    )
  );
  button()?.addEventListener('click', () => (interval ? stop() : start()));

  return {
    autoEnableIfOverflow() {
      if (autoTried || interval) return;
      if (document.body.scrollHeight > window.innerHeight + 4) {
        autoTried = true;
        start();
      }
    }
  };
})();

async function fetchData() {
  try {
    const resp = await fetch('data.json?t=' + Date.now(), { cache: 'no-store' });
    if (!resp.ok) return;
    render(await resp.json());
  } catch {
    /* keep showing last good data on transient errors */
  }
}

function render(data) {
  if (!data) return;
  el('tournament').textContent = data.tournament || 'Tournament';
  el('round').textContent = data.round != null ? 'Round ' + data.round : '';
  lastUpdatedMs = data.updatedAt ? Date.parse(data.updatedAt) : 0;

  const headers = data.headers || [];
  const cls = (c) =>
    c === data.rankIndex ? 'rank' : c === data.playerIndex ? 'player' : data.numericCols?.[c] ? 'num' : '';

  const htr = document.createElement('tr');
  headers.forEach((h, c) => {
    const th = document.createElement('th');
    th.textContent = h;
    th.className = cls(c);
    htr.appendChild(th);
  });
  const thead = el('thead');
  thead.innerHTML = '';
  thead.appendChild(htr);

  const tb = el('tbody');
  tb.innerHTML = '';
  for (const s of data.standings || []) {
    const tr = document.createElement('tr');
    (s.cells || []).forEach((v, c) => {
      const cell = document.createElement('td');
      cell.className = cls(c);
      cell.textContent = v;
      tr.appendChild(cell);
    });
    tb.appendChild(tr);
  }
  scroller.autoEnableIfOverflow();
}

function tick() {
  if (!lastUpdatedMs) return;
  const secs = Math.max(0, Math.round((Date.now() - lastUpdatedMs) / 1000));
  el('ago').textContent =
    'updated ' + (secs < 60 ? secs + 's' : Math.floor(secs / 60) + 'm ' + (secs % 60) + 's') + ' ago';
}

fetchData();
setInterval(fetchData, 20000); // re-fetch every 20s
setInterval(tick, 1000);
