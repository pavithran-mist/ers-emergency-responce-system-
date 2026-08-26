@echo off
echo ===================================================
echo Training Custom YOLO Road Accident Detection Model
echo ===================================================
python -m scripts.train_accident --epochs 5 --batch 4
pause
