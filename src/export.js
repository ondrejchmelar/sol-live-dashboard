// Builds and downloads a debug bundle: everything in local storage (logs, debug
// diagnostics with the last raw SoL response, latest parsed data, status, and
// config). The GitHub token is redacted. Importable as a module by pages.

export async function exportDebugBundle() {
  const all = await chrome.storage.local.get(null);
  if (all.config?.publish?.token) {
    all.config = { ...all.config, publish: { ...all.config.publish, token: '***redacted***' } };
  }
  const bundle = {
    exportedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    userAgent: navigator.userAgent,
    ...all
  };

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sol-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
