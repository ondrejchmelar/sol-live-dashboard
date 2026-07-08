// Logging that survives across service-worker restarts and can be exported.
//
//  - Every call also goes to the console (open the service worker's DevTools).
//  - info/warn/error are persisted to a rolling buffer in storage ("logs").
//  - debug is console-only unless config.debug (verbose) is on.
//  - setDebug() stashes rich diagnostics (last raw response, last parse) under
//    the "debug" key so the Export button can hand you/Claude real data.
//
// Single writer by design: only the background service worker logs. Token-like
// fields are redacted before anything is stored or exported.

const LOG_KEY = 'logs';
const LOG_CAP = 300; // keep the most recent N persisted entries
let verbose = false;

export function setVerbose(v) {
  verbose = !!v;
}

function redactKey(k) {
  return /token|authorization|secret|password/i.test(k);
}

function safe(data) {
  if (data === undefined) return undefined;
  try {
    const s = JSON.stringify(data, (k, v) => (redactKey(k) && v ? '***redacted***' : v));
    return s.length > 4000 ? s.slice(0, 4000) + '…(truncated)' : s;
  } catch {
    return String(data);
  }
}

async function log(level, scope, message, data) {
  const t = Date.now();
  const consoleFn = console[level] || console.log;
  consoleFn(`[SoL ${scope}] ${message}`, data ?? '');

  if (level === 'debug' && !verbose) return; // console-only unless verbose

  try {
    const { logs } = await chrome.storage.local.get(LOG_KEY);
    const arr = logs || [];
    arr.push({ t, level, scope, message, data: safe(data) });
    if (arr.length > LOG_CAP) arr.splice(0, arr.length - LOG_CAP);
    await chrome.storage.local.set({ [LOG_KEY]: arr });
  } catch (e) {
    console.warn('[SoL logger] persist failed', e);
  }
}

export const logger = {
  debug: (scope, msg, data) => log('debug', scope, msg, data),
  info: (scope, msg, data) => log('info', scope, msg, data),
  warn: (scope, msg, data) => log('warn', scope, msg, data),
  error: (scope, msg, data) => log('error', scope, msg, data)
};

// Merge-patch the "debug" diagnostics object (lastResponse / lastParsed / lastError).
export async function setDebug(patch) {
  try {
    const { debug } = await chrome.storage.local.get('debug');
    await chrome.storage.local.set({ debug: { ...(debug || {}), ...patch } });
  } catch (e) {
    console.warn('[SoL logger] setDebug failed', e);
  }
}
