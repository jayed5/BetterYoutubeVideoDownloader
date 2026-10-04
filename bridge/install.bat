@echo off
setlocal EnableExtensions

echo ============================================
echo YouTube yt-dlp Downloader - bridge installer
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo Python not found. Install Python 3.8+ from https://python.org and run again.
  pause
  exit /b 1
)

set "INSTALL_DIR=%LOCALAPPDATA%\yt-dlp-bridge"
set "SRC=%~dp0"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo Copying bridge files from %SRC% ...
copy /y "%SRC%bridge.py" "%INSTALL_DIR%\bridge.py" >nul
copy /y "%SRC%start-hidden.vbs" "%INSTALL_DIR%\start-hidden.vbs" >nul
if not exist "%INSTALL_DIR%\bridge.py" (
  echo ERROR: could not copy bridge.py.
  pause
  exit /b 1
)

rem Stop a previously running bridge (it holds port 8765)
if exist "%INSTALL_DIR%\bridge.pid" (
  for /f %%P in ('type "%INSTALL_DIR%\bridge.pid"') do taskkill /f /pid %%P >nul 2>&1
  del /q "%INSTALL_DIR%\bridge.pid" >nul 2>&1
)

if exist "%INSTALL_DIR%\yt-dlp.exe" goto HAVE_YTDLP
echo Downloading yt-dlp.exe ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '%INSTALL_DIR%\yt-dlp.exe' -UseBasicParsing } catch { exit 1 }"
if not exist "%INSTALL_DIR%\yt-dlp.exe" echo WARNING: yt-dlp.exe not downloaded - the bridge will try to use yt-dlp from PATH (pip install yt-dlp).
:HAVE_YTDLP

if exist "%INSTALL_DIR%\ffmpeg.exe" goto HAVE_FFMPEG
echo Downloading FFmpeg (essentials build) ...
if not exist "%INSTALL_DIR%\ffmpeg.zip" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile '%INSTALL_DIR%\ffmpeg.zip' -UseBasicParsing } catch { exit 1 }"
)
if exist "%INSTALL_DIR%\ffmpeg.zip" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Force '%INSTALL_DIR%\ffmpeg.zip' '%INSTALL_DIR%\ffmpeg_tmp'"
  for /r "%INSTALL_DIR%\ffmpeg_tmp" %%F in (ffmpeg.exe) do if not exist "%INSTALL_DIR%\ffmpeg.exe" copy /y "%%F" "%INSTALL_DIR%\ffmpeg.exe" >nul
  rmdir /s /q "%INSTALL_DIR%\ffmpeg_tmp" >nul 2>&1
)
if not exist "%INSTALL_DIR%\ffmpeg.exe" echo WARNING: ffmpeg.exe not installed - downloads that need merging will fail until ffmpeg is available.
:HAVE_FFMPEG

echo Adding to user PATH ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d='%INSTALL_DIR%'; $p=[Environment]::GetEnvironmentVariable('Path','User'); if(($p -split ';') -notcontains $d){ [Environment]::SetEnvironmentVariable('Path', ($p.TrimEnd(';') + ';' + $d), 'User') }"

echo Configuring autostart at login ...
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\YouTube yt-dlp Bridge.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%'); $s.TargetPath=$env:WINDIR+'\System32\wscript.exe'; $s.Arguments='\"%INSTALL_DIR%\start-hidden.vbs\"'; $s.WorkingDirectory='%INSTALL_DIR%'; $s.Save()"

echo Starting the bridge ...
start "" wscript.exe "%INSTALL_DIR%\start-hidden.vbs"
timeout /t 3 >nul

echo Checking bridge health ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 5; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo WARNING: the bridge did not respond yet. Check %%LOCALAPPDATA%%\yt-dlp-bridge\bridge.log
) else (
  echo Bridge is running.
)

echo.
echo ============================================
echo DONE
echo ============================================
echo.
echo Install dir:        %INSTALL_DIR%
echo Autostart at login: yes
echo Address:            http://127.0.0.1:8765
echo Download folder:    %%USERPROFILE%%\Downloads\yt-dlp
echo.
echo Now install the extension (chrome/firefox folder) or the userscript,
echo then reload YouTube. Use the popup/menu to switch English/Polski.
echo.
pause
