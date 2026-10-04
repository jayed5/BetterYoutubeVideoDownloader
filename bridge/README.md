# yt-dlp HTTP Bridge

Local HTTP server that receives URLs from the browser extension / userscript and downloads the video with `yt-dlp`. Downloads run in the background, so the browser gets an instant response.

## Requirements

- **Python 3.8+**
- **yt-dlp** (`pip install yt-dlp` or standalone `yt-dlp.exe`)
- **ffmpeg** (for merging video+audio)

## Install (Windows, automatic)

```cmd
install.bat
```

The installer copies the local `bridge.py` + `start-hidden.vbs` into `%LOCALAPPDATA%\yt-dlp-bridge\`, downloads `yt-dlp.exe` and `ffmpeg.exe`, adds the folder to the user PATH, creates a Startup shortcut (hidden window at login), starts the bridge and checks `http://127.0.0.1:8765/health`.

## Run manually (Windows/Linux/macOS)

```bash
pip install yt-dlp
# apt install ffmpeg  /  brew install ffmpeg
python bridge.py
```

Options:

```bash
python bridge.py --port 8765          # default port
python bridge.py --dir "D:\My Videos" # custom download folder
```

On startup the bridge prints whether yt-dlp and ffmpeg were found, and writes `bridge.pid` next to `bridge.py`.

## API

### POST /download

```json
{ "url": "https://www.youtube.com/watch?v=...", "lang": "en" }
```

- `lang` is optional: `"en"` (default) or `"pl"` — the error/success message is returned in that language.

Response (started):
```json
{ "ok": true, "message": "Download started - the file will be saved to the yt-dlp folder in Downloads." }
```

Response (duplicate):
```json
{ "ok": true, "message": "This video is already downloading." }
```

Errors return `{ "ok": false, "error": "..." }` with a localized message (invalid URL, missing yt-dlp/ffmpeg, malformed request).

### GET /health

```json
{
  "ok": true,
  "status": "ok",
  "version": "6.0.0",
  "yt_dlp": true,
  "ffmpeg": true,
  "download_dir": "C:\\Users\\you\\Downloads\\yt-dlp",
  "active_downloads": 0
}
```

## Files

| File | Purpose |
|------|---------|
| `bridge.log` | download log (also written when started hidden via `start-hidden.vbs`) |
| `bridge.pid` | PID of the running bridge (removed on clean exit) |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "yt-dlp not found" in popup / startup banner | `pip install yt-dlp` or run `install.bat`, then restart the bridge |
| "ffmpeg not found" | install ffmpeg and restart the bridge |
| Port 8765 busy | another bridge is running (check `bridge.pid`) or start with `--port` |
| Download fails silently | check `bridge.log` for the yt-dlp output and exit code |

## Security

- The bridge listens on **127.0.0.1 only**.
- No authentication — it trusts the local machine. Do not expose port 8765 to a network.
- Only YouTube URLs are accepted.
