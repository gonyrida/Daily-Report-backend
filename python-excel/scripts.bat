@echo off
REM Ensure we use Python 3.11 explicitly
py -3.11 -m venv .venv

REM Activate the virtual environment
call .venv\Scripts\activate.bat

REM Upgrade pip, setuptools, and wheel first (avoids some install issues)
python -m pip install --upgrade pip setuptools wheel

REM Install required packages
python -m pip install flask openpyxl pillow flask-cors reportlab cairosvg imageio

REM Run your app
python app.py