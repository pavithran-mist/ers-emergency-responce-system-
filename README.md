# 🛡️ ASTRA AI - Road Safety & Visual Emergency Detection Platform

**ASTRA AI** is a camera-based road safety and emergency visual detection platform. It uses computer vision, deep learning, kinematic trajectory tracking, and temporal verification to detect possible road accidents, vehicle interactions, fire, smoke, and risk levels across multi-camera networks in real time.

---

## 🌟 Key Capabilities & System Features

- **AI Vision Engine**:
  - **YOLO11n Vehicle Detector**: Detects and tracks `car`, `truck`, `bus`, `motorcycle`, and `bicycle`.
  - **Dual-Backend Accident Detection**:
    - *Trained YOLO Model* (`models/road_accident.pt`): Fine-tuned bounding box inference for road collisions.
    - *Kinematic Heuristic Engine* (Fallback): Rapid vehicle convergence vectors, bounding box overlap (IoU), abrupt deceleration, and abnormal trajectory angle deviations.
  - **Dual-Backend Fire & Smoke Detection**: Trained models or RGB/HSV chromatic flame analysis and low-chrominance smoke dispersion filters.
  - **Temporal Verification & Debounce**: Multi-frame sliding window filter (3 hits in 6 frames) to suppress camera noise and 6-second cooldown to prevent duplicate alert spam.
  - **Multi-Factor Risk Engine**: Scores hazard severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) and triages alerts to specialized department queues.
- **Location-Aware Incident Alerts**:
  - Every camera has registered location metadata (Address, Latitude, Longitude, Landmark, Jurisdiction Zone).
  - Every detected incident automatically inherits the camera's location and displays interactive OpenStreetMap / GPS views.
- **Multi-Camera Worker Pool Architecture**:
  - Supports IP cameras, RTSP streams, local webcams, video files, phone streams, and built-in synthetic traffic generators.
  - Each camera runs an isolated background processing worker delivering live MJPEG video with HUD bounding box overlays.
- **Role-Based Access Control (RBAC) & User Approval Flow**:
  - Roles: `ADMIN` and `OPERATOR`.
  - New user registration requires administrator approval before system access is granted.
  - Secure bcrypt password hashing and signed JWT session tokens.
- **Dedicated Emergency Alert Centers**:
  - 🚔 **Police Alerts**: Traffic collisions, rapid convergence, and road blockages.
  - 🔥 **Fire Station Alerts**: Roadside fires, vehicle fires, and smoke hazards.
  - 🚑 **Ambulance / EMS Alerts**: High-risk collisions, motorcycle involvement, and multi-vehicle crashes.
- **Real-Time WebSocket Dispatches**: Live sub-second emergency dispatches to the frontend dashboard.
- **Dynamic Content Management (CMS)**: Administrators can modify site title, organization name, emergency hotlines, and detection thresholds without modifying code.
- **Audit Logging**: Full audit trail recording all administrative interventions and operator triage actions.
- **Safety & Ethics Compliance**: Decision-support only (no autonomous 911/emergency dispatch), anonymous person detection (no facial recognition).

---

## 🚀 Quick Start Guide (Windows & VS Code)

### Prerequisites
- Python 3.10+ (Python 3.10 - 3.14 supported)
- Node.js 18+ and npm

### 1. Installation

Open PowerShell or Command Prompt in the `astra-ai` directory:

```powershell
# 1. Install Python Dependencies
pip install -r requirements.txt

# 2. Install Frontend Dependencies
cd frontend
npm install
cd ..
```

---

### 2. Launching the System

You can use the provided Windows batch scripts or run the commands directly in VS Code terminals:

#### Option A: Using Windows Batch Scripts
- Double-click `start-backend.bat` to launch the FastAPI server.
- Double-click `start-frontend.bat` to launch the React frontend.

#### Option B: Terminal Commands (VS Code)

**Terminal 1 (Backend Server):**
```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 (React Command Center):**
```powershell
cd frontend
npm run dev
```

Open your browser and navigate to: **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Default Credentials

The platform initializes with a seeded Super Administrator account:

| Account Role | Email Address | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@astra.ai` | `Admin@12345` | Full System & User Management |
| **Operator (Demo)** | `operator@astra.ai` | `Operator@123` | Monitoring & Alert Triage |

*(Quick-fill demo buttons are available on the Login page for instant one-click login)*

---

## 🧪 Running Automated Tests

Run the complete automated test suite (AI detector, accident heuristics, fire/smoke, temporal verifier, risk engine, dataset validator, authentication, cameras, incidents):

```powershell
# Run via Python module
python -m pytest tests/ -v

# Or double-click
run-tests.bat
```

---

## 🎯 Model Training & Dataset Validation

### 1. Validate Dataset Integrity
Checks for missing pairs, invalid bounding box coordinates, empty labels, duplicates, and train/val leakage:
```powershell
python -m scripts.validate_dataset
# Or double-click validate-dataset.bat
```

### 2. Train Custom Road Accident YOLO Model
Trains YOLO on `datasets/road_accident/data.yaml` and exports weights to `models/road_accident.pt`:
```powershell
python -m scripts.train_accident --epochs 5 --batch 4
# Or double-click train-model.bat
```

---

## 🏗️ System Architecture

```
Multiple Camera Ingest (IP / RTSP / Webcam / File / Synthetic)
      ↓
Dedicated Camera Worker Pool (ai_engine/stream_worker.py)
      ↓
YOLO Object Detection (YOLO11n Vehicle Classes)
      ↓
Centroid & Kinematic Trajectory Tracker (ai_engine/tracker.py)
      ↓
Accident Detection (Custom YOLO Model + Motion Heuristics)
      ↓
Fire & Smoke Detection (Model + Chromatic Heuristics)
      ↓
Temporal Persistence Verifier & Debounce Filter (ai_engine/temporal_verifier.py)
      ↓
Multi-Factor Risk Scoring Engine (ai_engine/risk_engine.py)
      ↓
FastAPI Backend (backend/app/main.py)
      ↓
PostgreSQL / SQLite Database Persistence & Audit Logging
      ↓
WebSocket Broadcast (/ws/alerts)
      ↓
React Dark Command Center Dashboard (frontend/src/)
      ↓
Department Triage (Police, Fire, Ambulance Alert Desks)
```

---

## 🛡️ Safety & Ethics Compliance

1. **Decision Support Protocol**: ASTRA AI is designed strictly as an assistive visual decision-support platform. It does NOT autonomously dial emergency services or dispatch first responders.
2. **Anonymous Detection**: ASTRA does NOT perform facial recognition, person identification, or biometric matching.
3. **Location Attribution**: Incident GPS coordinates and landmarks are linked to fixed camera assets, not to individuals.
