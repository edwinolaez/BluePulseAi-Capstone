# jasper-backend

**Owner:** Feven | FastAPI + Kong Gateway

## Setup

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install fastapi uvicorn pydantic python-multipart httpx pytest pylint supabase rasterio
pip freeze > requirements.txt

uvicorn main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health` → `{"status": "ok"}`

## Kong (local)

```bash
docker compose up -d kong
curl http://localhost:8001/status
```

## Deployment: Railway

Auto-deploys from `feature/feven-ingest` when merged to `develop`.
