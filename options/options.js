import { exportDebugBundle } from '../src/export.js';

const $ = (id) => document.getElementById(id);

async function getConfig() {
  const { config } = await chrome.storage.local.get('config');
  return config || {};
}

async function load() {
  const c = await getConfig();
  const p = c.publish || {};
  $('targetUrl').value = c.targetUrl || '';
  $('idtourney').value = c.idtourney || '';
  $('totalRounds').value = c.totalRounds || 8;
  $('pollSeconds').value = c.pollSeconds || 30;
  $('debug').checked = !!c.debug;
  $('pubEnabled').checked = !!p.enabled;
  $('pubOwner').value = p.owner || '';
  $('pubRepo').value = p.repo || '';
  $('pubBranch').value = p.branch || 'main';
  $('pubPath').value = p.path || 'data.json';
  $('pubToken').value = p.token || '';
  renderStats();
}

async function renderStats() {
  const { logs, debug, data } = await chrome.storage.local.get(['logs', 'debug', 'data']);
  const r = debug?.lastResponse;
  const lines = [
    `log entries:   ${logs?.length || 0}`,
    `last response: ${r ? `${r.status} · ${fmtBytes(r.bytes)} · ${r.elapsedMs}ms · ${r.anubis ? 'ANUBIS' : r.contentType || '?'}${r.truncated ? ' · (stored truncated)' : ''}` : '—'}`,
    `last response at: ${r ? new Date(r.at).toLocaleString() : '—'}`,
    `last parsed:   ${debug?.lastParsed ? `${debug.lastParsed.status} · ${debug.lastParsed.count} rows · tables=${debug.lastParsed.diag?.tablesFound ?? '?'}` : '—'}`,
    `current data:  ${data ? `${data.standings?.length || 0} players · ${data.tournament || '—'}` : '—'}`,
    debug?.lastError ? `last error:    ${debug.lastError.message}` : ''
  ].filter(Boolean);
  $('debugStats').textContent = lines.join('\n');
}

function fmtBytes(n) {
  if (n == null) return '?';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

$('save').addEventListener('click', async () => {
  const cur = await getConfig();
  const next = {
    ...cur,
    targetUrl: $('targetUrl').value.trim(),
    idtourney: $('idtourney').value.trim(),
    totalRounds: Math.max(1, Number($('totalRounds').value) || 8),
    pollSeconds: Math.max(30, Number($('pollSeconds').value) || 30),
    debug: $('debug').checked,
    publish: {
      enabled: $('pubEnabled').checked,
      owner: $('pubOwner').value.trim(),
      repo: $('pubRepo').value.trim(),
      branch: $('pubBranch').value.trim() || 'main',
      path: $('pubPath').value.trim() || 'data.json',
      token: $('pubToken').value.trim()
    }
  };
  await chrome.storage.local.set({ config: next });
  $('saved').textContent = 'Saved ✓';
  setTimeout(() => ($('saved').textContent = ''), 1500);
});

$('export').addEventListener('click', exportDebugBundle);

$('clearLogs').addEventListener('click', async () => {
  await chrome.storage.local.remove(['logs', 'debug']);
  renderStats();
});

// Keep the stats fresh as polls land while Options is open.
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && (ch.logs || ch.debug || ch.data)) renderStats();
});

load();
