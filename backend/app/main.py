import os
import sys

# Ensure project root is in sys.path for direct VS Code execution
_proj_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _proj_root not in sys.path:
    sys.path.insert(0, _proj_root)

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import engine, Base, SessionLocal
from backend.app.models import User, UserRole, UserStatus, Camera, Incident
from backend.app.auth import hash_password
from backend.app.camera_manager import camera_service
from backend.app.ws_manager import ws_manager
from backend.app.routes.settings_routes import seed_default_settings

# Import route modules
from backend.app.routes.auth_routes import router as auth_router
from backend.app.routes.admin_routes import router as admin_router
from backend.app.routes.camera_routes import router as camera_router
from backend.app.routes.incident_routes import router as incident_router
from backend.app.routes.alert_routes import router as alert_router
from backend.app.routes.ai_routes import router as ai_router
from backend.app.routes.settings_routes import router as settings_router
from backend.app.routes.audit_routes import router as audit_router
from backend.app.routes.stream_routes import router as stream_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("astra.main")


def seed_initial_database_data(db: Session) -> None:
    """Seed the initial administrator, operator, system settings, and camera fleet."""
    # 1. Seed Super Admin
    admin_user = db.query(User).filter(User.email == settings.DEFAULT_ADMIN_EMAIL.lower()).first()
    if not admin_user:
        logger.info(f"Seeding default Super Admin account: {settings.DEFAULT_ADMIN_EMAIL}")
        admin_user = User(
            email=settings.DEFAULT_ADMIN_EMAIL.lower(),
            hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
            full_name=settings.DEFAULT_ADMIN_NAME,
            role=UserRole.ADMIN,
            status=UserStatus.APPROVED,
        )
        db.add(admin_user)
        db.commit()

    # 2. Seed Operator Account
    op_user = db.query(User).filter(User.email == settings.DEFAULT_OPERATOR_EMAIL.lower()).first()
    if not op_user:
        logger.info(f"Seeding default Operator account: {settings.DEFAULT_OPERATOR_EMAIL}")
        op_user = User(
            email=settings.DEFAULT_OPERATOR_EMAIL.lower(),
            hashed_password=hash_password(settings.DEFAULT_OPERATOR_PASSWORD),
            full_name=settings.DEFAULT_OPERATOR_NAME,
            role=UserRole.OPERATOR,
            status=UserStatus.APPROVED,
        )
        db.add(op_user)
        db.commit()

    # 3. Seed Default CMS Settings
    seed_default_settings(db)

    # 4. Clean up any legacy synthetic / bot demo cameras so only real cameras remain
    bot_cams = db.query(Camera).filter(Camera.url.in_(["synthetic", "demo", "sim", "mock"])).all()
    if bot_cams:
        bot_ids = [c.camera_id for c in bot_cams if c.camera_id != "CAM-001"]
        if bot_ids:
            db.query(Incident).filter(Incident.camera_id.in_(bot_ids)).delete(synchronize_session=False)
            db.query(Camera).filter(Camera.camera_id.in_(bot_ids)).delete(synchronize_session=False)
            logger.info("Removed %d legacy synthetic bot camera(s).", len(bot_ids))

    # 5. Seed Predefined Real Webcam (CAM-001) if not exists
    default_webcam = db.query(Camera).filter(Camera.camera_id == "CAM-001").first()
    if not default_webcam:
        logger.info("Seeding predefined live webcam (CAM-001)...")
        webcam = Camera(
            camera_id="CAM-001",
            name="Primary Operations Live Webcam",
            url="0",
            camera_type="webcam",
            location="Operations Command Center - Station 1",
            latitude=28.6139,
            longitude=77.2090,
            landmark="Command Station Alpha",
            zone="Control Room Zone",
            description="Predefined high-speed local optical and thermal sensor feed.",
            status="ONLINE",
            is_enabled=True,
        )
        db.add(webcam)
    else:
        # Ensure it is set to real webcam source
        if default_webcam.url == "synthetic":
            default_webcam.url = "0"
            default_webcam.camera_type = "webcam"
            default_webcam.name = "Primary Operations Live Webcam"
            default_webcam.location = "Operations Command Center - Station 1"
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown event management."""
    logger.info("Initializing ASTRA AI Database...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_initial_database_data(db)
    finally:
        db.close()

    # Bind event loop and launch camera AI workers
    loop = asyncio.get_running_loop()
    camera_service.set_event_loop(loop)
    camera_service.initialize_cameras()

    logger.info("ASTRA AI Platform Backend started successfully.")
    yield

    logger.info("Shutting down ASTRA AI Platform...")
    camera_service.stop_all()


app = FastAPI(
    title=settings.APP_NAME,
    description="ASTRA AI - Camera-Based Road Safety and Emergency Visual Detection Platform",
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS for all domains / local dev / Render
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
api_v1 = settings.API_V1_STR
app.include_router(auth_router, prefix=api_v1)
app.include_router(admin_router, prefix=api_v1)
app.include_router(camera_router, prefix=api_v1)
app.include_router(incident_router, prefix=api_v1)
app.include_router(alert_router, prefix=api_v1)
app.include_router(ai_router, prefix=api_v1)
app.include_router(settings_router, prefix=api_v1)
app.include_router(audit_router, prefix=api_v1)
app.include_router(stream_router, prefix=api_v1)


# ----------------- STATIC SPA SERVING -----------------
# Check for built frontend dist directory
frontend_dist_paths = [
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "dist"),
    os.path.join(os.getcwd(), "frontend", "dist"),
    os.path.join(os.getcwd(), "dist"),
]

frontend_dist_dir = None
for p in frontend_dist_paths:
    if os.path.exists(p) and os.path.isdir(p):
        frontend_dist_dir = p
        break

if frontend_dist_dir:
    logger.info(f"Serving frontend static production bundle from {frontend_dist_dir}")
    assets_dir = os.path.join(frontend_dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    async def serve_spa_frontend(full_path: str, request: Request):
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            raise HTTPException(status_code=404, detail="API route not found.")
        accept_hdr = request.headers.get("accept", "")
        if (full_path == "" or full_path == "/") and "text/html" not in accept_hdr:
            return {
                "platform": settings.APP_NAME,
                "version": "2.0.0",
                "status": "OPERATIONAL",
                "docs_url": "/docs",
            }
        target_file = os.path.join(frontend_dist_dir, full_path)
        if full_path and os.path.exists(target_file) and os.path.isfile(target_file):
            return FileResponse(target_file)
        index_file = os.path.join(frontend_dist_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {
            "platform": settings.APP_NAME,
            "version": "2.0.0",
            "status": "OPERATIONAL",
            "docs_url": "/docs",
        }
else:
    @app.api_route("/", methods=["GET", "HEAD"])
    def root():
        return {
            "platform": settings.APP_NAME,
            "version": "2.0.0",
            "status": "OPERATIONAL",
            "docs_url": "/docs",
        }


@app.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time AI emergency alert and telemetry broadcasts."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and receive ping/heartbeat messages
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting ASTRA AI Platform from direct execution...")
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
