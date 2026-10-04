#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YouTube yt-dlp bridge - local HTTP server that receives URLs from the
browser extension / userscript and downloads them with yt-dlp.

Listens on 127.0.0.1 only. Downloads run in the background: the HTTP
response is sent immediately, so the browser never times out.

Endpoints:
    POST /download   {"url": "...", "lang": "en"|"pl"}  -> start download
    GET  /health                                     -> {"ok": true, ...}

Usage:
    python bridge.py [--port 8765] [--dir "D:\\My Videos"]
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = "6.0.0"
HOST = "127.0.0.1"
DEFAULT_PORT = 8765
DEFAULT_DOWNLOAD_DIR = os.path.join(os.path.expanduser("~"), "Downloads", "yt-dlp")
BASE = os.path.dirname(os.path.abspath(__file__))
MAX_BODY_BYTES = 10 * 1024

ALLOWED_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
    "youtu.be", "www.youtu.be",
}

# ---------------------------------------------------------------- messages --

MESSAGES = {
    "en": {
        "started": "Download started - the file will be saved to the yt-dlp folder in Downloads.",
        "already": "This video is already downloading.",
        "invalid_url": "Invalid YouTube URL.",
        "invalid_request": "Invalid request.",
        "missing_ytdlp": "yt-dlp not found. Run install.bat (Windows) or: pip install yt-dlp - then restart the bridge.",
        "missing_ffmpeg": "ffmpeg not found. Install ffmpeg and restart the bridge.",
        "spawn_failed": "Failed to start yt-dlp: {detail}",
        "not_found": "Unknown endpoint.",
        "port_busy": "Port {port} is already in use - the bridge is probably already running.",
        "log_line": "Download finished (code {code}): {url}",
    },
    "pl": {
        "started": "Rozpoczeto pobieranie - plik trafi do folderu yt-dlp w Pobranych.",
        "already": "Ten film jest juz pobierany.",
        "invalid_url": "Nieprawidlowy URL YouTube.",
        "invalid_request": "Nieprawidlowe zadanie.",
        "missing_ytdlp": "Nie znaleziono yt-dlp. Uruchom install.bat (Windows) lub: pip install yt-dlp, potem zrestartuj bridge.",
        "missing_ffmpeg": "Nie znaleziono ffmpeg. Zainstaluj ffmpeg i zrestartuj bridge.",
        "spawn_failed": "Nie udalo sie uruchomic yt-dlp: {detail}",
        "not_found": "Nieznany adres.",
        "port_busy": "Port {port} jest zajety - bridge prawdopodobnie juz dziala.",
        "log_line": "Pobieranie zakonczone (kod {code}): {url}",
    },
}


def msg(lang, key, **kw):
    lang_map = MESSAGES.get(lang) or MESSAGES["en"]
    text = lang_map.get(key) or MESSAGES["en"].get(key, key)
    return text.format(**kw)


# ------------------------------------------------------------------ config --

DOWNLOAD_DIR = DEFAULT_DOWNLOAD_DIR
YT_DLP = None
FFMPEG = None
LOG_FILE = None
PID_FILE = None


def find_tool(*names):
    """Look for a tool next to bridge.py first, then on PATH."""
    for name in names:
        local = os.path.join(BASE, name)
        if os.path.isfile(local):
            return local
    for name in names:
        found = shutil.which(name)
        if found:
            return found
    return None


def is_valid_youtube_url(value):
    try:
        parsed = urllib.parse.urlparse(value)
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        return False
    return bool(parsed.path) and parsed.path != "/"


def open_log():
    """Append to a log file next to bridge.py; fall back to the download dir."""
    candidates = [os.path.join(BASE, "bridge.log"), os.path.join(DOWNLOAD_DIR, "bridge.log")]
    for path in candidates:
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            return open(path, "ab")
        except OSError:
            continue
    return None


# --------------------------------------------------------------- downloads --

class DownloadManager:
    """Tracks running downloads so double-clicks do not spawn duplicates."""

    def __init__(self):
        self._lock = threading.Lock()
        self._active = set()

    @property
    def active_count(self):
        with self._lock:
            return len(self._active)

    def start(self, url):
        """Returns True if a new download was started, False if already running."""
        with self._lock:
            if url in self._active:
                return False
            self._active.add(url)
        threading.Thread(target=self._run, args=(url,), daemon=True).start()
        return True

    def _run(self, url):
        log_fh = open_log()
        try:
            output = os.path.join(DOWNLOAD_DIR, "%(title).200s [%(id)s].%(ext)s")
            command = [
                YT_DLP,
                "--no-playlist",
                "-f", "bv*+ba/b",
                "--merge-output-format", "mp4",
                "--ffmpeg-location", FFMPEG,
                "--no-part",
                "-o", output,
                url,
            ]
            print("[yt-dlp] Start:", url, flush=True)
            if log_fh:
                log_fh.write(("\n=== %s %s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), url)).encode("utf-8"))
                log_fh.flush()
            try:
                proc = subprocess.Popen(
                    command,
                    stdout=log_fh if log_fh else subprocess.DEVNULL,
                    stderr=subprocess.STDOUT,
                    cwd=DOWNLOAD_DIR,
                )
                code = proc.wait()
            except Exception as exc:  # spawn failure
                print("[yt-dlp] Spawn failed:", exc, flush=True)
                if log_fh:
                    log_fh.write(("spawn failed: %s\n" % exc).encode("utf-8"))
                return
            if log_fh:
                log_fh.write(("exit code: %s\n" % code).encode("utf-8"))
                log_fh.flush()
            print(msg("en", "log_line", code=code, url=url), flush=True)
        finally:
            if log_fh:
                try:
                    log_fh.close()
                except OSError:
                    pass
            with self._lock:
                self._active.discard(url)


downloads = DownloadManager()

# ------------------------------------------------------------------ server --


class Handler(BaseHTTPRequestHandler):
    server_version = "YtDlpBridge/" + VERSION

    def log_message(self, fmt, *args):
        print("[bridge]", fmt % args, flush=True)

    def send_json(self, status, data):
        try:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def read_lang(self, data):
        lang = ""
        if isinstance(data, dict):
            lang = str(data.get("lang", "")).strip().lower()
        return lang if lang in MESSAGES else "en"

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/health":
            self.send_json(200, {
                "ok": True,
                "status": "ok",
                "version": VERSION,
                "yt_dlp": bool(YT_DLP),
                "ffmpeg": bool(FFMPEG),
                "download_dir": DOWNLOAD_DIR,
                "active_downloads": downloads.active_count,
            })
        else:
            self.send_json(404, {"ok": False, "error": msg("en", "not_found")})

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path != "/download":
            self.send_json(404, {"ok": False, "error": msg("en", "not_found")})
            return

        try:
            length = min(int(self.headers.get("Content-Length", "0") or 0), MAX_BODY_BYTES)
        except ValueError:
            length = 0
        raw = self.rfile.read(length) if length > 0 else b""
        try:
            data = json.loads(raw.decode("utf-8"))
            assert isinstance(data, dict)
        except Exception:
            self.send_json(400, {"ok": False, "error": msg("en", "invalid_request")})
            return

        lang = self.read_lang(data)
        url = str(data.get("url", "")).strip()

        if not is_valid_youtube_url(url):
            self.send_json(400, {"ok": False, "error": msg(lang, "invalid_url")})
            return
        if not YT_DLP:
            self.send_json(500, {"ok": False, "error": msg(lang, "missing_ytdlp")})
            return
        if not FFMPEG:
            self.send_json(500, {"ok": False, "error": msg(lang, "missing_ffmpeg")})
            return

        try:
            started = downloads.start(url)
        except Exception as exc:
            self.send_json(500, {"ok": False, "error": msg(lang, "spawn_failed", detail=str(exc))})
            return

        if started:
            self.send_json(200, {"ok": True, "message": msg(lang, "started")})
        else:
            self.send_json(200, {"ok": True, "message": msg(lang, "already")})


def main():
    global DOWNLOAD_DIR, YT_DLP, FFMPEG, LOG_FILE, PID_FILE

    parser = argparse.ArgumentParser(description="Local yt-dlp bridge for the YouTube downloader extension.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="port to listen on (default %d)" % DEFAULT_PORT)
    parser.add_argument("--dir", default=DEFAULT_DOWNLOAD_DIR, help="download folder (default ~/Downloads/yt-dlp)")
    args = parser.parse_args()

    DOWNLOAD_DIR = os.path.abspath(os.path.expanduser(args.dir))
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

    YT_DLP = find_tool("yt-dlp.exe", "yt-dlp")
    FFMPEG = find_tool("ffmpeg.exe", "ffmpeg")

    PID_FILE = os.path.join(BASE, "bridge.pid")
    try:
        with open(PID_FILE, "w") as fh:
            fh.write(str(os.getpid()))
    except OSError:
        PID_FILE = None

    print("YouTube yt-dlp bridge v" + VERSION, flush=True)
    print("  Address:  http://%s:%d" % (HOST, args.port), flush=True)
    print("  yt-dlp:   " + (YT_DLP or "NOT FOUND (install.bat or: pip install yt-dlp)"), flush=True)
    print("  ffmpeg:   " + (FFMPEG or "NOT FOUND (install ffmpeg)"), flush=True)
    print("  Folder:   " + DOWNLOAD_DIR, flush=True)

    if not YT_DLP or not FFMPEG:
        print("  WARNING: downloads will fail until the missing tools are installed.", flush=True)

    try:
        server = ThreadingHTTPServer((HOST, args.port), Handler)
        server.daemon_threads = True
    except OSError:
        print("ERROR:", msg("en", "port_busy", port=args.port), flush=True)
        print("BLAD:  ", msg("pl", "port_busy", port=args.port), flush=True)
        if PID_FILE and os.path.isfile(PID_FILE):
            try:
                os.remove(PID_FILE)
            except OSError:
                pass
        sys.exit(1)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if PID_FILE and os.path.isfile(PID_FILE):
            try:
                os.remove(PID_FILE)
            except OSError:
                pass


if __name__ == "__main__":
    main()
