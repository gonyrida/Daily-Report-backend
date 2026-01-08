@echo off
REM Ensure we use Python 3.11 explicitly
py -3.11 -m venv .venv

REM Activate virtual environment
call .venv\Scripts\activate.bat

REM Upgrade pip, setuptools, and wheel first (avoids some install issues)
python -m pip install --upgrade pip setuptools wheel

REM Install required packages from requirements.txt
pip install -r requirements.txt

REM Set JWT_SECRET environment variable to match Node.js backend
set JWT_SECRET=process.env.JWT_SECRET

REM Run your app
python app.py