@echo off
echo ===================================================
echo Starting ASTRA AI Backend Server (FastAPI + Uvicorn)
echo ===================================================
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
pause
