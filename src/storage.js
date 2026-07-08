// Thin wrappers over chrome.storage.local with defaults applied on read.
// Three keys: "config" (user settings), "data" (latest standings), "status" (poll state).

export const DEFAULT_CONFIG = {
  targetUrl: '',          // SoL standings/ranking URL, e.g. https://sol5.metapensiero.it/lit/tourney/<guid>
  idtourney: '',          // integer tourney id for the countdown/timer (auto-detected when the clock runs)
  totalRounds: 8,         // target number of rounds (SoL/Swiss doesn't expose it) — shown as "Round n / N"
  pollSeconds: 60,        // clamped to >= 30 by the alarm scheduler
  polling: false,         // whether the background poller is active
  debug: false,           // verbose logging (persist debug-level lines too)
  publish: {
    enabled: false,       // OFF until you fill in the GitHub fields below
    owner: '',
    repo: '',
    branch: 'main',
    path: 'data.json',
    token: ''             // fine-grained PAT with Contents: read+write on the repo; stored locally only
  }
};

const DEFAULT_STATUS = {
  state: 'idle',          // idle | ok | anubis | error
  message: '',
  lastPollAt: 0,
  lastOkAt: 0,
  publish: { state: 'idle', message: '', at: 0 }
};

export async function getConfig() {
  const { config } = await chrome.storage.local.get('config');
  return {
    ...DEFAULT_CONFIG,
    ...(config || {}),
    publish: { ...DEFAULT_CONFIG.publish, ...((config && config.publish) || {}) }
  };
}

export async function setConfig(patch) {
  const cur = await getConfig();
  const next = {
    ...cur,
    ...patch,
    publish: { ...cur.publish, ...((patch && patch.publish) || {}) }
  };
  await chrome.storage.local.set({ config: next });
  return next;
}

export async function getData() {
  const { data } = await chrome.storage.local.get('data');
  return data || null;
}

export async function setData(data) {
  await chrome.storage.local.set({ data });
}

export async function getStatus() {
  const { status } = await chrome.storage.local.get('status');
  return {
    ...DEFAULT_STATUS,
    ...(status || {}),
    publish: { ...DEFAULT_STATUS.publish, ...((status && status.publish) || {}) }
  };
}

export async function setStatus(status) {
  await chrome.storage.local.set({ status });
}
