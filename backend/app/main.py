import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
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

    # 4. Seed Standard Camera Fleet
    sample_cameras = [
        Camera(
            camera_id="CAM-001",
            name="NH-44 Expressway North Corridor",
            url="synthetic",
            camera_type="synthetic",
            location="NH-44 Highway Mile Marker 42, Northbound",
            latitude=28.7041,
            longitude=77.1025,
            landmark="Overpass Junction 4",
            zone="Highway North Zone",
            description="High-speed arterial highway monitor with multi-lane optical tracking.",
            status="ONLINE",
            is_enabled=True,
        ),
        Camera(
            camera_id="CAM-002",
            name="Central Metro Commercial Intersection",
            url="synthetic",
            camera_type="synthetic",
            location="5th Avenue & Ring Road Central",
            latitude=28.6139,
            longitude=77.2090,
            landmark="City Financial Plaza",
            zone="Downtown Sector 1",
            description="Urban intersection monitoring pedestrian crossings and vehicle convergence.",
            status="ONLINE",
            is_enabled=True,
        ),
        Camera(
            camera_id="CAM-003",
            name="Industrial Logistics & Fuel Depot Hub",
            url="synthetic",
            camera_type="synthetic",
            location="Sector 18 Hazmat & Freight Terminal",
            latitude=28.5355,
            longitude=77.3910,
            landmark="Warehouse Gate 2B",
            zone="Industrial Corridor",
            description="Thermal and optical monitoring for flame, heavy smoke, and hazmat emergencies.",
            status="ONLINE",
            is_enabled=True,
        ),
    ]
    for cam in sample_cameras:
        existing_cam = db.query(Camera).filter(Camera.camera_id == cam.camera_id).first()
        if not existing_cam:
            db.add(cam)
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
    #camera_service.initialize_cameras()

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

    @app.get("/{full_path:path}")
    async def serve_spa_frontend(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            raise HTTPException(status_code=404, detail="API route not found.")
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
