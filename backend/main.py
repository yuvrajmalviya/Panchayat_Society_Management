import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.config import settings
from backend.database.connection import get_database, close_db_connection
from backend.routers import (
    auth,
    users,
    complaints,
    notices,
    announcements,
    documents,
    notifications,
    analytics,
    ai
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("panchayat_ai")

app = FastAPI(
    title="Panchayat AI API",
    description="Backend API services for the AI-Powered Panchayat Society Management System",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL (e.g. Vercel)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Uploads directory for static files (access complaints images, voice recordings)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

@app.on_event("startup")
async def startup_db_client():
    logger.info("Initializing database client...")
    get_database()

@app.on_event("shutdown")
async def shutdown_db_client():
    logger.info("Closing database connection...")
    await close_db_connection()

# Include Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(complaints.router)
app.include_router(notices.router)
app.include_router(announcements.router)
app.include_router(documents.router)
app.include_router(notifications.router)
app.include_router(analytics.router)
app.include_router(ai.router)

@app.get("/")
def read_root():
    return {
        "name": "Panchayat AI API Service",
        "status": "Operational",
        "message": "Panchayat Society Backend is running",
        "documentation": "/docs"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }

if __name__ == "__main__":
    import uvicorn
    # Read host/port from environment if needed, default to local port 8000
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
