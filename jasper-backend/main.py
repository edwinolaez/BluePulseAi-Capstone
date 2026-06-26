from fastapi import FastAPI
from routers import health

app = FastAPI(title="Project Jasper API")

app.include_router(health.router)