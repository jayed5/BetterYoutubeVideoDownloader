(function () {
  'use strict';

  // Works in both Chrome (chrome.*) and Firefox (browser.*)
  const IS_FIREFOX = typeof browser !== 'undefined' && !!browser && !!browser.runtime;
  const runtime = IS_FIREFOX
    ? browser
    : (typeof chrome !== 'undefined' ? chrome : null);

  const BRIDGE = 'http://127.0.0.1:8765';
  const BTN_ID = 'vm-ytdlp-download';
  const STYLE_ID = 'vm-ytdlp-style';
  const STATUS_ID = 'vm-ytdlp-status';
  const RETRY_DELAYS = [50, 100, 200, 300, 500, 800, 1200, 1600, 2000];

  // ---------------------------------------------------------------- i18n --
  const I18N = {
    en: {
      button: '⬇ Download',
      busy: '⏳ Downloading…',
      tooltip: 'Download with yt-dlp',
      starting: 'Starting yt-dlp…',
      started: 'Download started — check the yt-dlp folder in Downloads.',
      error: 'Error: ',
      connect: 'Cannot connect to the local yt-dlp bridge.',
      invalidResponse: 'Invalid response from the local bridge.',
      bridgeError: 'Bridge error.'
    },
    pl: {
      button: '⬇ Pobierz',
      busy: '⏳ Pobieranie…',
      tooltip: 'Pobierz przez yt-dlp',
      starting: 'Uruchamiam yt-dlp…',
      started: 'Rozpoczęto pobieranie — sprawdź folder yt-dlp w Pobranych.',
      error: 'Błąd: ',
      connect: 'Nie można połączyć się z lokalnym yt-dlp bridge.',
      invalidResponse: 'Nieprawidłowa odpowiedź lokalnego bridge.',
      bridgeError: 'Błąd bridge.'
    }
  };

  let lang = 'en';

  function t(key) {
    const dict = I18N[lang] || I18N.en;
    return dict[key] !== undefined ? dict[key] : I18N.en[key];
  }

  function setLang(value) {
    lang = I18N[value] ? value : 'en';
    updateButtonLabels();
  }

  function loadLang() {
    try {
      runtime.storage.sync.get({ lang: 'en' }, (res) => {
        if (res && res.lang) setLang(res.lang);
      });
      if (runtime.storage.onChanged && runtime.storage.onChanged.addListener) {
        runtime.storage.onChanged.addListener((changes, area) => {
          if (area === 'sync' && changes.lang) setLang(changes.lang.newValue);
        });
      }
    } catch (_) { /* keep default */ }
  }

  // ---------------------------------------------------------------- dom ----
  let currentUrl = location.href;
  let retryTimer = null;
  let obsTimer = null;

  function whenDomReady(fn) {
    let tries = 0;
    const tick = () => {
      if (document.head && document.body) { fn(); return; }
      if (++tries > 600) return;
      setTimeout(tick, 50);
    };
    tick();
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BTN_ID} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 36px;
        padding: 0 16px;
        margin-left: 8px;
        border: 0;
        border-radius: 18px;
        background: #f2f2f2;
        color: #0f0f0f;
        font: 500 14px "Roboto", Arial, sans-serif;
        cursor: pointer;
        transition: background 0.15s;
        white-space: nowrap;
      }
      #${BTN_ID}:hover { background: #d9d9d9; }
      #${BTN_ID}:disabled { opacity: .6; cursor: wait; }
      html[dark] #${BTN_ID},
      ytd-app[dark] #${BTN_ID} {
        background: #272727;
        color: #fff;
      }
      html[dark] #${BTN_ID}:hover,
      ytd-app[dark] #${BTN_ID}:hover { background: #3f3f3f; }

      #${STATUS_ID} {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 999999;
        max-width: 360px;
        padding: 12px 16px;
        border-radius: 10px;
        background: rgba(15,15,15,.95);
        color: white;
        font: 14px "Roboto", Arial, sans-serif;
        box-shadow: 0 4px 20px rgba(0,0,0,.35);
        animation: vm-ytdlp-slide 0.3s ease;
      }
      @keyframes vm-ytdlp-slide {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  function status(message, timeout) {
    let box = document.getElementById(STATUS_ID);
    if (!box) {
      if (!document.body) return;
      box = document.createElement('div');
      box.id = STATUS_ID;
      document.body.appendChild(box);
    }
    box.textContent = message;
    clearTimeout(box._timer);
    if (timeout) {
      box._timer = setTimeout(() => box.remove(), timeout);
    }
  }

  function request(path, data) {
    return new Promise((resolve, reject) => {
      const payload = { type: 'download', url: data.url, lang: lang };

      if (IS_FIREFOX) {
        runtime.runtime.sendMessage(payload)
          .then((res) => {
            if (res && res.ok) resolve(res);
            else reject(new Error((res && res.error) || t('bridgeError')));
          })
          .catch((err) => {
            reject(new Error(t('connect') + (err && err.message ? ' (' + err.message + ')' : '')));
          });
      } else {
        runtime.runtime.sendMessage(payload, (res) => {
          const lastError = runtime.runtime.lastError;
          if (lastError) {
            reject(new Error(t('connect')));
            return;
          }
          if (res && res.ok) resolve(res);
          else reject(new Error((res && res.error) || t('bridgeError')));
        });
      }
    });
  }

  function currentVideoUrl() {
    const url = new URL(location.href);
    return url.origin + url.pathname + url.search;
  }

  function isVideoPage() {
    const path = location.pathname;
    return path.startsWith('/watch') ||
           path.startsWith('/shorts/') ||
           path.startsWith('/live/') ||
           path.startsWith('/live') ||
           path.startsWith('/embed/');
  }

  function findTarget() {
    const isShorts = location.pathname.startsWith('/shorts/');

    const selectors = isShorts ? [
      'ytd-reel-video-renderer #actions',
      'ytd-reel-video-renderer #button-container',
      'ytd-shorts-video-renderer #actions',
      'ytd-shorts-video-renderer #button-container',
      'ytd-shorts #actions',
      'ytd-shorts #button-container',
      '#shorts-player #actions',
      '#shorts-player #button-container',
      'ytd-reel-player-overlay-renderer #actions',
      'ytd-reel-player-overlay-renderer #button-container',
      'ytd-reel-video-renderer ytd-button-renderer',
      'ytd-shorts-video-renderer ytd-button-renderer',
      '#shorts-player ytd-button-renderer',
      '#top-level-buttons-computed',
      '#top-level-buttons',
      'ytd-menu-renderer #top-level-buttons-computed',
      '#menu',
      '#menu-container',
    ] : [
      '#top-level-buttons-computed',
      '#top-level-buttons',
      'ytd-menu-renderer #top-level-buttons-computed',
      'ytd-menu-renderer #top-level-buttons',
      '#actions #top-level-buttons-computed',
      '#actions #top-level-buttons',
      'ytd-watch-metadata #menu',
      '#menu-container #top-level-buttons',
      'ytd-watch-metadata #top-level-buttons-computed',
      'ytd-watch-metadata ytd-menu-renderer #top-level-buttons',
      'ytd-watch-flexy #top-level-buttons',
      '#info-contents #top-level-buttons',
      '#info #top-level-buttons',
      'ytd-video-secondary-info-renderer #top-level-buttons',
      'ytm-video-action-renderer',
      '.slim-video-information-actions',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function removeAllButtons() {
    document.querySelectorAll('#' + BTN_ID).forEach(btn => btn.remove());
  }

  function updateButtonLabels() {
    document.querySelectorAll('#' + BTN_ID).forEach(btn => {
      if (!btn.disabled) btn.textContent = t('button');
      btn.title = t('tooltip');
    });
  }

  function buildButton() {
    const button = document.createElement('button');
    button.id = BTN_ID;
    button.type = 'button';
    button.textContent = t('button');
    button.title = t('tooltip');

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = t('busy');
      status(t('starting'));

      try {
        const result = await request('/download', { url: currentVideoUrl() });
        status(result.message || t('started'), 5000);
      } catch (e) {
        status(t('error') + e.message, 7000);
      } finally {
        button.disabled = false;
        button.textContent = t('button');
      }
    });

    return button;
  }

  function tryCreate() {
    if (document.getElementById(BTN_ID)) return true;
    const target = findTarget();
    if (!target) return false;
    if (!isVideoPage()) return false;
    target.appendChild(buildButton());
    return true;
  }

  function scheduleCreate() {
    if (retryTimer) return;
    let i = 0;
    const attempt = () => {
      retryTimer = null;
      if (!isVideoPage()) return;
      if (tryCreate()) return;
      if (i < RETRY_DELAYS.length) {
        retryTimer = setTimeout(attempt, RETRY_DELAYS[i++]);
      }
    };
    attempt();
  }

  function createButton() {
    if (!isVideoPage()) {
      removeAllButtons();
      return;
    }
    scheduleCreate();
  }

  function onUrlChange() {
    if (location.href === currentUrl) return;
    currentUrl = location.href;
    removeAllButtons();
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    // Wait for the DOM to settle after SPA navigation
    setTimeout(createButton, 300);
  }

  function ensureButtonExists() {
    if (isVideoPage() && !document.getElementById(BTN_ID) && !retryTimer) {
      scheduleCreate();
    }
  }

  function init() {
    loadLang();
    whenDomReady(addStyle);

    // YouTube's internal navigation events
    window.addEventListener('yt-navigate-finish', onUrlChange);
    window.addEventListener('yt-page-data-updated', onUrlChange);
    window.addEventListener('yt-page-type-changed', onUrlChange);

    // History API
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      setTimeout(onUrlChange, 100);
    };
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      setTimeout(onUrlChange, 100);
    };
    window.addEventListener('popstate', () => setTimeout(onUrlChange, 100));

    // MutationObserver - debounced, catches button removal / late containers
    const obs = new MutationObserver(() => {
      if (obsTimer) return;
      obsTimer = setTimeout(() => { obsTimer = null; ensureButtonExists(); }, 150);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    // Periodic fallback
    setInterval(ensureButtonExists, 1000);

    // Polling fallback for URL changes
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        onUrlChange();
      }
    }, 300);

    // Initial creation
    const tryInit = () => { if (isVideoPage()) createButton(); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(tryInit, 300));
    } else {
      setTimeout(tryInit, 300);
    }
  }

  init();
})();
