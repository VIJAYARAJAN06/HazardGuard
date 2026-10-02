"""
HAZARDGUARD — FastAPI application entry point.
Initializes SQLite database and seeds default records on startup.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database.init_db import init_db
from api.routes import router
from api.websocket import live_feed

load_dotenv()

# Ensure database tables exist and are seeded
init_db()

app = FastAPI(
    title="HAZARDGUARD Intelligent Safety Monitoring API",
    version="2.0.0",
    description="Software-First Industrial Hazard-Zone Personnel Monitoring System"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register REST router
app.include_router(router)

# Register WebSocket endpoint
app.add_api_websocket_route("/ws/live", live_feed)

# Mount frontend for unified single-port deployment (Render / Railway / Docker / Local)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/css", StaticFiles(directory=os.path.join(frontend_dir, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(frontend_dir, "js")), name="js")

    @app.get("/app")
    @app.get("/dashboard")
    @app.get("/monitoring")
    @app.get("/incidents")
    def serve_frontend_alias():
        return FileResponse(os.path.join(frontend_dir, "index.html"))

    @app.get("/ui")
    def serve_frontend():
        return FileResponse(os.path.join(frontend_dir, "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
