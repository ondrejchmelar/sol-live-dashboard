import { parseTourney, parseMatches } from './src/parser.js';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen') return;
  try {
    let data;
    if (msg.type === 'PARSE_TOURNEY') data = parseTourney(msg.html);
    else if (msg.type === 'PARSE_MATCHES') data = parseMatches(msg.html);
    else {
      sendResponse({ ok: false, error: 'unknown parse type: ' + msg.type });
      return;
    }
    sendResponse({ ok: true, data });
  } catch (e) {
    sendResponse({ ok: false, error: String(e.message || e) });
  }
  // Response is synchronous.
});
