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

# health.py: GET /health
# ingest.py: POST /api/v1/ingest, /geotiff, /dem, /telemetry
# data.py:   GET /api/v1/layers/{sector_id}
# fusion.py: GET /api/v1/fusion/{sector_id}
from routers import data, fusion, health, ingest, timeline

app = FastAPI(title="Project Jasper API")

app.include_router(health.router)
app.include_router(ingest.router)
app.include_router(data.router)
app.include_router(fusion.router)
app.include_router(timeline.router)
