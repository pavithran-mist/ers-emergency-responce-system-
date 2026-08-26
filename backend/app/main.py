"""Main FastAPI application entrypoint for ASTRA AI Platform."""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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
    """Seed the initial administrator and system settings (no demo cameras)."""
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

    # 2. Seed Default CMS Settings
    seed_default_settings(db)

    # Remove the legacy synthetic demo network from existing installations.
    # These IDs are reserved for the original sample cameras; user-created cameras are unaffected.
    demo_camera_ids = ("CAM-001", "CAM-002", "CAM-003")
    demo_cameras = db.query(Camera).filter(
        Camera.camera_id.in_(demo_camera_ids),
        Camera.url == "synthetic",
    ).all()
    if demo_cameras:
        ids_to_remove = [camera.camera_id for camera in demo_cameras]
        db.query(Incident).filter(Incident.camera_id.in_(ids_to_remove)).delete(synchronize_session=False)
        db.query(Camera).filter(Camera.camera_id.in_(ids_to_remove)).delete(synchronize_session=False)
        logger.info("Removed %d legacy demo camera(s).", len(ids_to_remove))

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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
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


@app.get("/")
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
