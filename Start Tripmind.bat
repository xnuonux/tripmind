@echo off
title TRIPMIND
cd /d "%~dp0"
echo.
echo   TRIPMIND  —  the field
echo   chamber + agent bridge on http://127.0.0.1:8765
echo.
start "" "http://127.0.0.1:8765"
where node >nul 2>nul && node agent\bridge.mjs && goto :eof
where py >nul 2>nul && py -m http.server 8765 && goto :eof
where python >nul 2>nul && python -m http.server 8765 && goto :eof
echo No Node or Python found. Open index.html directly if your browser allows modules.
echo Agent HTTP control needs Node:  node agent\bridge.mjs
pause
