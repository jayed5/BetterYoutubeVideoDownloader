# Changelog

All notable changes to this project will be documented in this format.

## [6.0.0] - 2026-10-04

### Added
- **All**: English/Polish language switch, **English by default**
- **Userscript**: language toggle via the userscript manager menu (`Language / Język: EN ⇄ PL`), saved with `GM_getValue`/`GM_setValue`
- **Extensions**: popup with an English/Polski toggle and live bridge status (running, yt-dlp/ffmpeg detected, download folder, active downloads)
- **Extensions**: language stored in `storage.sync`, applied to open YouTube tabs instantly via `storage.onChanged`
- **Bridge**: `/health` endpoint reporting version, tools and active downloads
- **Bridge**: CLI options `--port` and `--dir`
- **Bridge**: downloads run in the background — the HTTP response returns immediately, so the browser never times out
- **Bridge**: duplicate-download guard (the same URL cannot run twice at once)
- **Bridge**: `bridge.log` and `bridge.pid` files for easier diagnostics

### Fixed
- **Userscript**: retry timer used the same interval forever — now a proper capped exponential backoff (50ms→2s)
- **Userscript/Extensions**: toast/append could crash at `document_start` when `document.body` was still missing
- **Userscript**: duplicate userscript-menu registrations
- **Bridge**: blocked a request while yt-dlp ran — concurrent downloads and instant responses now work
- **Bridge**: POST body length is capped (10 KB) and malformed JSON returns a clear 400
- **Bridge**: accepts `music.youtube.com`, `m.youtube.com` and `www.youtu.be`; rejects other hosts
- **Bridge (Windows installer)**: copied local `bridge.py`/`start-hidden.vbs` instead of fetching a dead placeholder GitHub URL
- **Bridge (Windows installer)**: kills the previous bridge (via `bridge.pid`) so reinstalling no longer fails on a busy port
- **Bridge (Windows uninstaller)**: PATH cleanup actually removes the entry; bridge is stopped by pid/command line

### Changed
- **All**: all UI strings and error messages localized (EN/PL)
- **Extensions**: popup opens from the toolbar icon; language persists across devices (storage.sync)
- **Extensions**: simplified permissions (no unused `downloads`/`scripting`)
- **Extensions**: content script shared between Chrome (chrome.*) and Firefox (browser.*)

## [5.0.0] - 2026-10-04

### Added
- **Userscript**: Persistent retry with exponential backoff (50→200ms)
- **Userscript**: `ensureButtonExists()` watchdog every 500ms
- **Userscript**: YouTube SPA events (`yt-navigate-finish`, `yt-page-data-updated`, `yt-page-type-changed`)
- **Userscript**: History API hooks (`pushState`, `replaceState`, `popstate`)
- **Userscript**: MutationObserver for DOM changes
- **Userscript**: 34+ selectors for video page, 17+ for Shorts
- **Userscript**: Status toast notifications (bottom-right)
- **Userscript**: Dark mode support (`html[dark]`, `ytd-app[dark]`)
- **Chrome MV3**: Full parity with userscript v5.0.0
- **Firefox MV2**: Full parity with userscript v5.0.0
- **Bridge**: Windows auto-installer (`install.bat`)
- **Bridge**: Python HTTP server with async support

### Fixed
- **Userscript**: Button disappearing on SPA navigation
- **Userscript**: Multiple buttons appearing
- **Userscript**: Shorts support (new YouTube structure)
- **Chrome MV3**: `document.head/body` null at `document_start`
- **Chrome MV3**: Service worker async messaging

### Changed
- **All**: Minimum delay 300-400ms after navigation for DOM settle
- **Bridge**: Returns `{ok: true, message}` instead of raw response

## [4.0.0] - 2026-10-04

### Added
- Persistent retry until success
- More selectors for watch page and Shorts
- Exponential backoff for retries

### Fixed
- Button not appearing on Shorts

## [3.1.0] - 2026-10-04

### Fixed
- Duplicate buttons (now removes all instances)
- Race conditions in button creation

## [3.0.0] - 2026-10-04

### Added
- Shorts support with dedicated selectors
- YouTube SPA navigation events
- History API hooks
- MutationObserver for DOM changes

## [2.0.0] - 2026-10-04

### Added
- Multiple fallback selectors
- Dark mode support
- Status toast notifications

## [1.0.0] - 2026-10-04

### Added
- Initial release
- Basic download button for watch pages
- Local bridge communication
- Firefox MV2 extension
- Chrome MV3 extension
- Violentmonkey userscript