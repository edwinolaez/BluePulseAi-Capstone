"""
Project Jasper — FastAPI Backend Entry Point
Owner: Feven | Data Pipeline & API Engineer

This file is the starting point of the entire backend application.
When uvicorn runs 'main:app', it imports this file and starts the server.

The app is built using FastAPI — a modern Python web framework that:
- Automatically generates API documentation at /docs
- Validates request/response data using Pydantic schemas
- Handles async requests efficiently
"""

from fastapi import FastAPI

# Existing routers
# health.py:         GET /health
# ingest.py:         POST /api/v1/ingest, /geotiff, /dem, /telemetry
# data.py:           GET /api/v1/layers/{sector_id}
# fusion.py:         GET /api/v1/fusion/{sector_id}
# timeline.py:       GET /api/v1/sectors/{sector_id}/timeline
#
# New routers (Sprint 2 — design review feedback)
# auth.py:            POST /api/v1/auth/token, GET /api/v1/auth/verify
# alerts.py:          GET/POST /api/v1/alerts, POST /api/v1/alerts/{id}/acknowledge
# change_detection.py: POST /api/v1/change-detection/predict, GET /status
# simulation.py:      GET /api/v1/simulate/erosion, /contaminant
# admin.py:           GET/POST /api/v1/admin/*  (superadmin only)
from routers import (
    admin,
    alerts,
    change_detection,
    data,
    fusion,
    health,
    ingest,
    simulation,
    timeline,
)
from routers import auth as auth_router

app = FastAPI(
    title="Project Jasper API",
    description="Environmental monitoring backend for Jasper Valley post-wildfire recovery.",
    version="2.0.0",
)

# Core service routers
app.include_router(health.router)
app.include_router(ingest.router)
app.include_router(data.router)
app.include_router(fusion.router)
app.include_router(timeline.router)

# New modular service boundaries (Sprint 2)
app.include_router(auth_router.router)
app.include_router(alerts.router)
app.include_router(change_detection.router)
app.include_router(simulation.router)
app.include_router(admin.router)
