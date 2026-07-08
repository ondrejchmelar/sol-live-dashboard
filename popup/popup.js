import { exportDebugBundle } from '../src/export.js';

const $ = (id) => document.getElementById(id);

async function refresh() {
  const r = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
  if (!r) return;
  const { config, status, data } = r;

  $('state').textContent = status.state;
  $('state').className = 'pill ' + status.state;
  $('msg').textContent = status.message || '';
  $('count').textContent = data?.standings?.length ?? 0;
  $('target').textContent = config.targetUrl || '(set in Options)';
  $('pub').textContent = config.publish?.enabled
    ? `on — ${status.publish?.state || 'idle'}${status.publish?.message ? ' (' + status.publish.message + ')' : ''}`
    : 'off';
  $('lastok').textContent = status.lastOkAt ? 'ok ' + new Date(status.lastOkAt).toLocaleTimeString() : '';

  const on = !!config.polling;
  $('toggle').textContent = on ? 'Stop polling' : 'Start polling';
  $('toggle').dataset.on = on ? '1' : '0';

  // Can't poll without a target URL — block Start and Poll now, and say why.
  const hasUrl = !!(config.targetUrl && config.targetUrl.trim());
  $('toggle').disabled = !hasUrl && !on;
  $('now').disabled = !hasUrl;
  if (!hasUrl) {
    $('msg').textContent = 'Set a SoL URL in Options to start.';
  }
}

$('toggle').addEventListener('click', async () => {
  const on = $('toggle').dataset.on === '1';
  await chrome.runtime.sendMessage({ type: on ? 'STOP' : 'START' });
  setTimeout(refresh, 400);
});
$('now').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'POLL_NOW' });
  setTimeout(refresh, 400);
});
$('dash').addEventListener('click', () =>
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') })
);
$('opts').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('export').addEventListener('click', exportDebugBundle);

refresh();
