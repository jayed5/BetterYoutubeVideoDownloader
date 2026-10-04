@echo off
setlocal EnableExtensions

echo ============================================
echo YouTube yt-dlp Downloader - uninstaller
echo ============================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\yt-dlp-bridge"
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\YouTube yt-dlp Bridge.lnk"

echo Removing autostart shortcut ...
if exist "%LNK%" del "%LNK%"

echo Stopping the running bridge ...
if exist "%INSTALL_DIR%\bridge.pid" (
  for /f %%P in ('type "%INSTALL_DIR%\bridge.pid"') do taskkill /f /pid %%P >nul 2>&1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'bridge\.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
taskkill /f /im yt-dlp.exe >nul 2>&1

echo Removing from user PATH ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d='%INSTALL_DIR%'; $p=[Environment]::GetEnvironmentVariable('Path','User'); $np=($p -split ';' | Where-Object { $_ -and $_ -ne $d }) -join ';'; [Environment]::SetEnvironmentVariable('Path', $np, 'User')"

echo Removing program files ...
if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"

echo.
echo DONE - bridge removed. Downloads already saved are kept.
echo.
pause
