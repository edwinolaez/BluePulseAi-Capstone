"""
Project Jasper — Health Check Router
Owner: Feven | Data Pipeline & API Engineer

This file handles one single endpoint: GET /health

Why we need a health check endpoint:
- Railway uses it to know if our backend is running correctly
  If /health stops responding, Railway automatically restarts the container
- Kong gateway uses it to verify the backend is alive before routing traffic
- Edwin's CI pipeline hits this endpoint first to confirm the backend deployed
- It's the only endpoint that requires NO API key — it must always be public
  so monitoring tools can check it without needing credentials

This is like the "heartbeat" of our application.
"""

# APIRouter lets us define routes in a separate file and then
# register them with the main FastAPI app in main.py
# This keeps our code organized — each file handles one group of routes
from fastapi import APIRouter

# Create a router instance — think of it as a mini-app
# that holds just the endpoints defined in this file
router = APIRouter()


# @router.get("/health") is a "decorator" — it tells FastAPI:
# "When someone sends a GET request to /health, run the function below"
# GET means the client is requesting data (not sending data)
@router.get("/health")
async def health_check():
    """Return API health status.

    This endpoint is publicly accessible — no API key required.
    Returns a simple JSON response confirming the server is running.

    Returns:
        dict: {"status": "ok"} when the server is healthy
    """
    # Return a simple dictionary — FastAPI automatically converts this to JSON
    # {"status": "ok"} is what Railway, Kong, and Edwin's CI pipeline expect to see
    return {"status": "ok"}
