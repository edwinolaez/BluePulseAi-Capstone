"""Health check router for Project Jasper API."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Return API health status."""
    return {"status": "ok"}
