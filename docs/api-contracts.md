# Project Jasper — API Contracts

**Owner:** Feven | Data Pipeline & API Engineer  
**Last Updated:** 2026-06-26

---

## 1. Health Check

**Endpoint:** `GET /health`  
**Auth:** None (public)  
**Response:**

```json
{ "status": "ok" }
```

---

## 2. Ingest Record Schema (Feven → Rahil)

All ingest endpoints accept and store data in this format:

```json
{
  "layer_type": "geotiff | dem | telemetry | water_quality",
  "sector_id": "string",
  "coordinates": { "lat": 52.8734, "lon": -118.0823 },
  "timestamp": "2026-06-26T18:00:00Z",
  "data_source": "string",
  "user_id": "string",
  "payload": {}
}
```

---

## 3. Ingest Endpoints (Sprint 2)

### GeoTIFF Satellite Imagery

**Endpoint:** `POST /api/v1/ingest/geotiff`  
**Auth:** `X-API-Key: <key>`  
**Max file size:** 50MB  
**Response:** `{"status": "accepted", "layer_id": "string"}`

### DEM Terrain Tile

**Endpoint:** `POST /api/v1/ingest/dem`  
**Auth:** `X-API-Key: <key>`  
**Max file size:** 50MB  
**Response:** `{"status": "accepted", "layer_id": "string"}`

### Water Quality Telemetry

**Endpoint:** `POST /api/v1/ingest/telemetry`  
**Auth:** `X-API-Key: <key>`  
**Response:** `{"status": "accepted", "record_id": "string"}`

---

## 4. Map Data Query Endpoint (Feven → Reyta)

**Endpoint:** `GET /api/v1/layers/{sector_id}`  
**Auth:** `X-API-Key: <key>`  
**Query params:** `date_from`, `date_to`, `layer_type`  
**Response:**

```json
{
  "sector_id": "string",
  "layers": []
}
```
