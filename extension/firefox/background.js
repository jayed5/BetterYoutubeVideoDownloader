// Firefox MV2 background script - forwards download requests to the bridge.
const BRIDGE = 'http://127.0.0.1:8765';

browser.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== 'download' || !message.url) return;

  const lang = message.lang === 'pl' ? 'pl' : 'en';
  const fallbackStarted = lang === 'pl' ? 'Rozpoczęto pobieranie.' : 'Download started.';
  const fallbackConnect = lang === 'pl'
    ? 'Nie można połączyć się z lokalnym yt-dlp bridge.'
    : 'Cannot connect to the local yt-dlp bridge.';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  return fetch(BRIDGE + '/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: message.url, lang: lang }),
    signal: controller.signal
  }).then(async (response) => {
    clearTimeout(timer);
    let data = null;
    try { data = await response.json(); } catch (_) {}

    if (response.ok && data && data.ok) {
      return { ok: true, message: data.message || fallbackStarted };
    }
    return {
      ok: false,
      error: (data && data.error) || ('HTTP ' + response.status)
    };
  }).catch((error) => {
    clearTimeout(timer);
    const reason = error && error.name === 'AbortError' ? ' (timeout)' : (error && error.message ? ' (' + error.message + ')' : '');
    return { ok: false, error: fallbackConnect + reason };
  });
});
