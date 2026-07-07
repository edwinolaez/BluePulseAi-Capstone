"""Project Jasper FastAPI application entry point."""
from fastapi import FastAPI
from routers import health, ingest, data

app = FastAPI(title="Project Jasper API")

app.include_router(health.router)
app.include_router(ingest.router)
app.include_router(data.router)
