@echo off
chcp 65001 >nul
title Zkong Desktop Application - Unofficial • by Nazjar Dev
cd /d "%~dp0"

echo =====================================================================
echo   Zkong Desktop Application - Unofficial (by Nazjar Dev)
echo =====================================================================
echo Starting native Windows Desktop Application...

npx electron .
