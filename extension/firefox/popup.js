(function () {
  'use strict';

  // Works in both Chrome (chrome.*) and Firefox (browser.*)
  const IS_FIREFOX = typeof browser !== 'undefined' && !!browser && !!browser.storage;
  const api = IS_FIREFOX ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  const BRIDGE = 'http://127.0.0.1:8765';

  const I18N = {
    en: {
      language: 'Language',
      bridge: 'Bridge',
      checking: 'Checking…',
      running: 'Running',
      notRunning: 'Not running',
      hintOk: 'Click the Download button under any YouTube video or Short.',
      hintBad: 'Start the bridge: run bridge/install.bat (Windows) or "python bridge.py".',
      tools: 'yt-dlp: {ytdlp} · ffmpeg: {ffmpeg}',
      dir: 'Folder: {dir}',
      active: 'Active downloads: {n}',
      ok: 'OK',
      missing: 'missing',
      yes: 'yes',
      no: 'no'
    },
    pl: {
      language: 'Język',
      bridge: 'Bridge',
      checking: 'Sprawdzam…',
      running: 'Działa',
      notRunning: 'Nie działa',
      hintOk: 'Kliknij przycisk Pobierz pod dowolnym filmem lub Shortem na YouTube.',
      hintBad: 'Uruchom bridge: odpal bridge/install.bat (Windows) lub "python bridge.py".',
      tools: 'yt-dlp: {ytdlp} · ffmpeg: {ffmpeg}',
      dir: 'Folder: {dir}',
      active: 'Aktywne pobierania: {n}',
      ok: 'OK',
      missing: 'brak',
      yes: 'jest',
      no: 'nie'
    }
  };

  let lang = 'en';

  function t(key, vars) {
    const dict = I18N[lang] || I18N.en;
    let text = dict[key] !== undefined ? dict[key] : I18N.en[key];
    if (vars) {
      for (const k of Object.keys(vars)) {
        text = text.split('{' + k + '}').join(String(vars[k]));
      }
    }
    return text;
  }

  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (I18N[lang][key] !== undefined) el.textContent = t(key);
    });
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');
    document.getElementById('lang-pl').classList.toggle('active', lang === 'pl');
  }

  function saveLang(value) {
    lang = I18N[value] ? value : 'en';
    try {
      api.storage.sync.set({ lang: lang });
    } catch (_) { /* ignore */ }
    applyLang();
    checkBridge();
  }

  function storageGetLang() {
    try {
      api.storage.sync.get({ lang: 'en' }, (res) => {
        if (res && res.lang) {
          lang = I18N[res.lang] ? res.lang : 'en';
          applyLang();
          checkBridge();
        }
      });
    } catch (_) {
      applyLang();
      checkBridge();
    }
  }

  async function checkBridge() {
    const dot = document.getElementById('dot');
    const textEl = document.getElementById('bridge-text');
    const detail = document.getElementById('detail');
    const hint = document.getElementById('hint');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(BRIDGE + '/health', { signal: controller.signal });
      clearTimeout(timer);
      const data = await response.json();
      if (response.ok && data && data.ok) {
        dot.className = 'dot ok';
        textEl.textContent = t('running');
        detail.textContent = [
          t('tools', {
            ytdlp: data.yt_dlp ? t('ok') : t('missing'),
            ffmpeg: data.ffmpeg ? t('ok') : t('missing')
          }),
          t('dir', { dir: data.download_dir || '' }),
          t('active', { n: data.active_downloads || 0 })
        ].join('\n');
        hint.textContent = t(data.yt_dlp ? 'hintOk' : 'hintBad');
        return;
      }
      throw new Error('bad status');
    } catch (_) {
      clearTimeout(timer);
      dot.className = 'dot bad';
      textEl.textContent = t('notRunning');
      detail.textContent = '';
      hint.textContent = t('hintBad');
    }
  }

  document.getElementById('lang-en').addEventListener('click', () => saveLang('en'));
  document.getElementById('lang-pl').addEventListener('click', () => saveLang('pl'));

  applyLang();
  storageGetLang();
})();
