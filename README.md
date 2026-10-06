<div align="center">

# ▶️ YouTube yt-dlp Downloader

**One click on YouTube → the video lands in your Downloads folder.**

[![Version](https://img.shields.io/badge/version-6.0.0-blue)](#-changelog)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)](#-requirements)
[![Bridge](https://img.shields.io/badge/bridge-127.0.0.1%3A8765-orange)](bridge/README.md)
[![i18n](https://img.shields.io/badge/i18n-English%20%2F%20Polski-purple)](#-language--język)

*Chrome · Edge · Firefox · Tampermonkey · Violentmonkey*

[Features](#-features) · [Quick Start](#-quick-start) · [Language](#-language--język) · [Architecture](#-architecture) · [Configuration](#-configuration) · [Troubleshooting](#-troubleshooting) · [FAQ](#-faq)

</div>

---

## ✨ Features

|  |  |
|---|---|
| ⬇ **One-click download** | Button injected next to the like/dislike row on watch pages, Shorts and Live streams |
| ⚡ **Instant UI** | Downloads run in the background on the bridge — the button never blocks or times out |
| 🌐 **EN / PL interface** | Switch anytime; English is the default. Applies live to open tabs |
| 🩺 **Health monitoring** | Extension popup shows bridge status, detected tools, download folder and active downloads |
| 🔁 **Battle-tested injection** | YouTube SPA navigation, Shorts DOM, late hydration — exponential-backoff retry + watchdog |
| 🧩 **3 front-ends, 1 engine** | Chrome MV3, Firefox MV2 and a userscript — all feature-identical |
| 🔒 **Local-only** | The bridge binds to `127.0.0.1` and accepts YouTube URLs only |

## 📦 Requirements

| Component | Notes |
|---|---|
| Python 3.8+ | runs the bridge |
| yt-dlp | `pip install yt-dlp` — or let `install.bat` fetch a standalone exe |
| ffmpeg | required for merging video+audio; `install.bat` downloads it (Windows) |
| Chrome/Edge 88+, Firefox 102+ or any userscript manager | front-end |

## 🚀 Quick Start

### 1 — Start the bridge

<details open>
<summary><b>Windows (automatic)</b></summary>

```cmd
cd bridge
install.bat
```

The installer: copies the bridge to `%LOCALAPPDATA%\yt-dlp-bridge\`, downloads `yt-dlp.exe` + `ffmpeg.exe`, adds the folder to your user PATH, registers an autostart shortcut and verifies the bridge is alive.

</details>

<details>
<summary>Linux / macOS / manual (any OS)</summary>

```bash
pip install yt-dlp
# ffmpeg:  sudo apt install ffmpeg   |   brew install ffmpeg
python bridge/bridge.py
```

</details>

**Verify** — open <http://127.0.0.1:8765/health>:
```json
{ "ok": true, "status": "ok", "version": "6.0.0", "yt_dlp": true, "ffmpeg": true, "active_downloads": 0 }
```

### 2 — Install a front-end

| Platform | Steps |
|---|---|
| **Chrome / Edge** | `chrome://extensions` → *Developer mode* → *Load unpacked* → select `extension/chrome/` |
| **Firefox** | `about:addons` → ⚙ gear icon → *Install Add-on From File…* → select [`extension/firefox/youtube-yt-dlp-firefox-mv2-6.0.0.xpi`](extension/firefox/youtube-yt-dlp-firefox-mv2-6.0.0.xpi) — a signed build installs permanently, like any regular add-on |
| **Userscript** | Install [`userscript/youtube-yt-dlp-downloader.user.js`](userscript/youtube-yt-dlp-downloader.user.js) in Tampermonkey/Violentmonkey |

<details>
<summary>Signing your own build of the Firefox add-on</summary>

Firefox only installs add-ons permanently when they are signed. To sign your own build: package the contents of `extension/firefox/` as a zip, submit it on [addons.mozilla.org](https://addons.mozilla.org/developers/) (Developer Hub → *Submit a New Add-on* → choose **unlisted**) and download the signed `.xpi`. Install it as described above. For quick development without signing you can still load it temporarily via `about:debugging`, but that expires on restart.

</details>

### 3 — Download something

Open any YouTube video or Short → click **⬇ Download** next to the like button → file appears in `~/Downloads/yt-dlp/`.

## 🌐 Language / Język

| Front-end | How to switch | Default |
|---|---|---|
| Extension | Toolbar icon → popup → **English / Polski** | English |
| Userscript | Userscript-manager menu → **Language / Język: EN ⇄ PL** | English |

Changing the language applies **instantly to all open YouTube tabs** (extension) and is remembered across sessions and devices (`storage.sync`).

## 🏗 Architecture

```
┌────────────────────────────┐         ┌─────────────────────────────────┐
│  Browser (YouTube tab)     │  HTTP   │  Bridge (localhost:8765)        │
│                            │ ──────► │                                 │
│  content.js  ───────────►  │  POST   │  validates URL ──► spawns       │
│   button + toast           │ /download│  (whitelist)     yt-dlp async  │
│                            │         │                      │          │
│  popup.js  ──────────────► │  GET    │  duplicate guard           ▼    │
│   status / language        │ /health │  log + pid        ~/Downloads/yt-dlp
└────────────────────────────┘         └─────────────────────────────────┘
```

- **content.js** injects the button, survives YouTube's SPA navigation, sends `{url, lang}` to the background script.
- **background.js** forwards the request to the bridge (15 s timeout, no page-side CORS).
- **bridge.py** validates the URL against a YouTube host whitelist, deduplicates concurrent requests, spawns yt-dlp in a worker thread and logs to `bridge.log`.

Repository layout:

```
├── bridge/                 # Python bridge + Windows installer
│   ├── bridge.py           #   HTTP server (async downloads, /health, --port/--dir)
│   ├── install.bat         #   one-click Windows setup
│   ├── uninstall.bat
│   └── README.md           #   API + CLI reference
├── extension/
│   ├── chrome/             # Manifest V3 (load unpacked or use the zip)
│   └── firefox/            # Manifest V2 (.xpi)
├── userscript/             # Tampermonkey / Violentmonkey / Greasemonkey
├── CHANGELOG.md
└── LICENSE
```

## ⚙ Configuration

### Bridge (CLI)

```bash
python bridge/bridge.py [--port 8765] [--dir "~/Downloads/yt-dlp"]
```

| Flag | Default | Description |
|---|---|---|
| `--port` | `8765` | HTTP port (the front-ends hardcode `http://127.0.0.1:8765`) |
| `--dir` | `~/Downloads/yt-dlp` | download target folder |

### HTTP API

| Endpoint | Method | Body / Response |
|---|---|---|
| `/download` | `POST` | `{"url": "https://www.youtube.com/watch?v=…", "lang": "en"\|"pl"}` → `{"ok": true, "message": "…"}` — returns immediately; download continues in the background |
| `/health` | `GET` | `{"ok", "status", "version", "yt_dlp", "ffmpeg", "download_dir", "active_downloads"}` |

Only YouTube hosts are accepted: `youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be`, `www.youtu.be`.

### Downloaded files

Template: `%(title).200s [%(id)s].%(ext)s` → `Rick Astley - Never Gonna Give You Up [dQw4w9WgXcQ].mp4` — best video+audio merged to MP4.

## 🛠 Troubleshooting

| Symptom | Cause → Fix |
|---|---|
| Popup: **Bridge: Not running** | Bridge isn't started → `bridge/install.bat` or `python bridge/bridge.py` |
| **ffmpeg not found** | Install ffmpeg, then restart the bridge |
| Button missing | Reload the tab; the script retries automatically for ~7 s — if it still fails, YouTube's DOM changed, check the console |
| *This video is already downloading* | The same URL is in progress — intentional dedupe, not a bug |
| Download fails / 0-byte file | Check `bridge/bridge.log` (or `%LOCALAPPDATA%\yt-dlp-bridge\bridge.log`) for yt-dlp's output; usually an outdated yt-dlp → `pip install -U yt-dlp` |
| Port busy | A bridge is already running (see `bridge.pid`) — kill it or use `--port`, then update `BRIDGE` in the content script |
| yt-dlp shows "Sign in to confirm you're age" | Some videos need cookies → not supported by design (keep the bridge credential-free) |

## ❓ FAQ

**Does this upload anything to the internet?**
No. The URL goes from your browser to `127.0.0.1` only; yt-dlp talks to YouTube directly.

**MP3?**
Not yet — v6.0.0 downloads the best MP4. Quality/audio-only presets are on the roadmap.

**Multiple downloads at once?**
Yes — concurrent downloads are supported and counted in `/health`.

**Is this legal?**
Downloading YouTube content may violate YouTube's Terms of Service and copyright law depending on content and jurisdiction. Use at your own responsibility, for content you own or that is licensed appropriately.

## 📜 Changelog

See [CHANGELOG.md](CHANGELOG.md). **6.0.0** — EN/PL language system (EN default), background downloads with instant responses, `/health` endpoint, hardened retry logic, fixed Windows installer.


## 📄 License

[MIT](LICENSE)
