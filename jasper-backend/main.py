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

# FastAPI is the web framework we use to build our API
# Think of it like the engine of the whole backend
from fastapi import FastAPI

# We import our three routers — each one handles a different group of endpoints
# health.py handles: GET /health
# ingest.py handles: POST /api/v1/ingest, /geotiff, /dem, /telemetry
# data.py handles:   GET /api/v1/layers/{sector_id}
from routers import data, health, ingest

# Create the main FastAPI application instance
# title= sets the name shown in the auto-generated /docs page
app = FastAPI(title="Project Jasper API")

# Register each router with the main app
# Without this, FastAPI wouldn't know about any of the endpoints
# It's like plugging in different modules into the main system
app.include_router(health.router)
app.include_router(ingest.router)
app.include_router(data.router)
