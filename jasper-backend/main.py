from fastapi import FastAPI
from routers import health, ingest

app = FastAPI(title="Project Jasper API")

app.include_router(health.router)
app.include_router(ingest.router)