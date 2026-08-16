@echo off
title TRIPMIND
cd /d "%~dp0"
echo.
echo   TRIPMIND  —  the field
echo   opening http://localhost:8765
echo.
start "" "http://localhost:8765"
where py >nul 2>nul && py -m http.server 8765 && goto :eof
where python >nul 2>nul && python -m http.server 8765 && goto :eof
where npx >nul 2>nul && npx --yes serve -l 8765 && goto :eof
echo No Python or Node found. Open index.html directly if your browser allows modules.
pause
