@echo off
chcp 65001 >nul
cd /d "%~dp0"
python plovdiv_register.py
if errorlevel 9009 py plovdiv_register.py
pause
