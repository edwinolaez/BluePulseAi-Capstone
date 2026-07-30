"""
Project Jasper — FastAPI Backend Entry Point
Owner: Feven | Data Pipeline & API Engineer

This file is the starting point of the entire backend application.
When Railway (or a developer locally) runs 'uvicorn main:app --reload',
Python imports this file first and the FastAPI server starts up.

The app is built using FastAPI — a modern Python web framework that:
- Automatically generates interactive API documentation at /docs
- Validates every incoming request/response against Pydantic schemas
- Handles many requests at the same time using Python's async/await model

All API routes are organised into "routers" — separate files in the routers/
folder, each owning one logical area (health, ingest, alerts, etc.). We import
each router here and register it with `app.include_router()`. This keeps the
file short and makes it easy to see the full list of capabilities at a glance.

Full route map:
  GET  /health                               — liveness check (no auth required)
  POST /api/v1/ingest                        — store a generic JSON sensor record
  POST /api/v1/ingest/geotiff                — upload Sentinel-2 satellite imagery
  POST /api/v1/ingest/dem                    — upload Altalis elevation files
  POST /api/v1/ingest/telemetry              — store river sensor readings
  GET  /api/v1/layers/{sector_id}            — fetch environmental layers for a sector
  GET  /api/v1/fusion/{sector_id}            — unified multi-source view of a sector
  GET  /api/v1/sectors/{sector_id}/timeline  — timestamped scan history for the map slider
  POST /api/v1/auth/token                    — exchange API key for a short-lived token
  GET  /api/v1/auth/verify                   — verify a bearer token is still valid
  GET  /api/v1/alerts                        — list active environmental risk alerts
  POST /api/v1/alerts                        — create a new alert from ML model output
  POST /api/v1/alerts/{id}/acknowledge       — mark an alert as seen by an operator
  POST /api/v1/change-detection/predict      — run burn-scar detection via ML service
  GET  /api/v1/change-detection/status       — check ML service health
  GET  /api/v1/simulate/erosion              — RUSLE erosion simulation via ML service
  GET  /api/v1/simulate/contaminant          — hydrocarbon plume simulation via ML service
  GET  /api/v1/admin/system-info             — runtime environment info (superadmin only)
  GET  /api/v1/admin/users                   — list registered API consumers (superadmin only)
  POST /api/v1/admin/users                   — register a new API consumer (superadmin only)
  GET  /api/v1/admin/audit-log               — recent admin actions (superadmin only)
"""

from fastapi import FastAPI

# ---------------------------------------------------------------------------
# Router imports — one file per logical service area
# ---------------------------------------------------------------------------

# Existing routers (Sprint 1 / core pipeline)
# health.py:         GET /health
# ingest.py:         POST /api/v1/ingest, /geotiff, /dem, /telemetry
# data.py:           GET /api/v1/layers/{sector_id}
# fusion.py:         GET /api/v1/fusion/{sector_id}
# timeline.py:       GET /api/v1/sectors/{sector_id}/timeline
#
# New routers (Sprint 2 — added in response to design review feedback)
# auth.py:             POST /api/v1/auth/token, GET /api/v1/auth/verify
# alerts.py:           GET/POST /api/v1/alerts, POST /api/v1/alerts/{id}/acknowledge
# change_detection.py: POST /api/v1/change-detection/predict, GET /status
# simulation.py:       GET /api/v1/simulate/erosion, /contaminant
# admin.py:            GET/POST /api/v1/admin/*  (superadmin only)
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
# auth is imported with an alias to avoid shadowing Python's built-in `auth` name
from routers import auth as auth_router

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

# The `app` object is what uvicorn imports and serves.
# title, description, and version show up in the auto-generated /docs page.
app = FastAPI(
    title="Project Jasper API",
    description="Environmental monitoring backend for Jasper Valley post-wildfire recovery.",
    version="2.0.0",
)

# ---------------------------------------------------------------------------
# Register routers — each call wires one file's routes into the main app
# ---------------------------------------------------------------------------

# Core service routers (Sprint 1)
app.include_router(health.router)       # GET /health
app.include_router(ingest.router)       # POST /api/v1/ingest/*
app.include_router(data.router)         # GET /api/v1/layers/*
app.include_router(fusion.router)       # GET /api/v1/fusion/*
app.include_router(timeline.router)     # GET /api/v1/sectors/*/timeline

# New modular service boundaries (Sprint 2)
app.include_router(auth_router.router)        # POST/GET /api/v1/auth/*
app.include_router(alerts.router)             # GET/POST /api/v1/alerts/*
app.include_router(change_detection.router)   # POST/GET /api/v1/change-detection/*
app.include_router(simulation.router)         # GET /api/v1/simulate/*
app.include_router(admin.router)              # GET/POST /api/v1/admin/*
