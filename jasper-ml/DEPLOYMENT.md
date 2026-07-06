# Project Jasper ML API — Deployment Guide

**Status:** Sprint 4 Production Hardening  
**Date:** June 27, 2026  
**Environments:** Development, Staging, Production

---

## Overview

This guide covers deployment of the Project Jasper ML API across three environments: **development** (local), **staging** (pre-production testing), and **production** (live deployment).

---

## Environment Configuration

### Development (Local)

```bash
# Clone and setup
git clone https://github.com/edwinolaez/BluePulseAi-Capstone.git
cd jasper-ml

# Create virtual environment
python3.13 -m venv ml-env
source ml-env/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run API
python api/model_endpoint.py
# or with environment variables
API_ENV=development python -m uvicorn api.model_endpoint:app --reload --port 8001
```

**URL:** `http://localhost:8001`  
**Docs:** `http://localhost:8001/docs`  
**Allowed Origins:** `http://localhost:3000` (frontend dev server)

### Staging Deployment

```bash
# Build Docker image
docker build -t jasper-ml:latest .

# Run container
docker run \
  -e API_ENV=staging \
  -e ALLOWED_ORIGINS="https://staging.bluepulseai.ca" \
  -p 8001:8001 \
  jasper-ml:latest
```

**URL:** `https://staging.bluepulseai.ca/api/v1/`  
**Kong Gateway:** Enabled (rate limiting 20 req/min)  
**Health Check:** `https://staging.bluepulseai.ca/health`

### Production Deployment

**Prerequisites:**

- Real trained model (`models/change_detection/model_v1.pkl`)
- Production credentials in `.env.production`
- Kong Gateway configuration
- Monitoring setup (Prometheus, Grafana)

```bash
# Environment variables (.env.production)
API_ENV=production
API_HOST=0.0.0.0
API_PORT=8001
ALLOWED_ORIGINS="https://bluepulseai.ca,https://map.bluepulseai.ca"

# Deploy with Kubernetes (optional)
kubectl apply -f k8s/deployment.yaml

# Or Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

**URL:** `https://api.bluepulseai.ca/api/v1/`  
**SLA:** 99.9% uptime  
**Rate Limit:** 20 req/min per client (Kong Gateway)

---

## Docker Deployment

### Build Image

```bash
docker build -t bluepulseai/jasper-ml:v1.0 .
```

### Run Container

```bash
# Development
docker run -p 8001:8001 \
  -e API_ENV=development \
  bluepulseai/jasper-ml:v1.0

# Staging with volume mounts
docker run -p 8001:8001 \
  -e API_ENV=staging \
  -e ALLOWED_ORIGINS="https://staging.bluepulseai.ca" \
  -v $(pwd)/models:/app/models \
  bluepulseai/jasper-ml:v1.0

# Production with all settings
docker run -d \
  --name jasper-ml-api \
  -p 8001:8001 \
  -e API_ENV=production \
  -e ALLOWED_ORIGINS="https://bluepulseai.ca,https://map.bluepulseai.ca" \
  --restart unless-stopped \
  --health-cmd="curl -f http://localhost:8001/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  bluepulseai/jasper-ml:v1.0
```

### Kubernetes Deployment

```bash
# Create namespace
kubectl create namespace jasper-ml

# Deploy
kubectl apply -f k8s/deployment.yaml -n jasper-ml
kubectl apply -f k8s/service.yaml -n jasper-ml

# Check status
kubectl get pods -n jasper-ml
kubectl logs -f deployment/jasper-ml-api -n jasper-ml

# Scale
kubectl scale deployment jasper-ml-api --replicas=3 -n jasper-ml
```

---

## Health Checks & Monitoring

### Endpoints

**Health Check:**

```bash
curl https://api.bluepulseai.ca/health
```

Response:

```json
{
  "status": "ok",
  "service": "Project Jasper ML API",
  "version": "1.0.0",
  "timestamp": "2026-06-27T14:30:00Z",
  "components": {
    "model": "ready",
    "erosion_model": "ready",
    "contaminant_model": "ready"
  }
}
```

**Metrics Endpoint:**

```bash
curl https://api.bluepulseai.ca/metrics
```

### Response Headers

All responses include:

```
X-Process-Time: <elapsed_seconds>
```

### Logging

Logs are written to stdout and can be collected by:

- **Development:** Console output
- **Staging:** CloudWatch, Stackdriver
- **Production:** ELK Stack, DataDog, or similar

Example log entries:

```
2026-06-27 14:30:00 - api.model_endpoint - INFO - 📥 POST /api/v1/predict/change-detection
2026-06-27 14:30:00 - api.model_endpoint - INFO - Processing change detection for sector: ATH-001-A
2026-06-27 14:30:00 - api.model_endpoint - INFO - ✓ Change detection complete for ATH-001-A
2026-06-27 14:30:00 - api.model_endpoint - INFO - 📤 POST /api/v1/predict/change-detection | Status: 200 | Time: 0.045s
```

---

## Kong Gateway Configuration

Rate limiting and API gateway configuration for Kong:

```yaml
# kong-config.yaml
service:
  name: jasper-ml-api
  url: http://jasper-ml-api:8001

plugins:
  - name: rate-limiting
    config:
      minute: 20
      policy: local
  - name: cors
    config:
      origins:
        - https://bluepulseai.ca
        - https://map.bluepulseai.ca
  - name: request-transformer
    config:
      add:
        headers:
          - X-Service:jasper-ml
  - name: response-transformer
    config:
      add:
        headers:
          - X-API-Version:1.0.0
```

---

## CORS Configuration

Frontend integration requires CORS headers. Configure via environment variable:

```bash
# Development
export ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"

# Staging
export ALLOWED_ORIGINS="https://staging.bluepulseai.ca"

# Production
export ALLOWED_ORIGINS="https://bluepulseai.ca,https://map.bluepulseai.ca"
```

**Example Request from Frontend:**

```javascript
fetch("https://api.bluepulseai.ca/api/v1/predict/change-detection", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    sector_id: "ATH-001-A",
  }),
})
  .then((res) => res.json())
  .then((data) => console.log(data));
```

---

## Security Checklist

- [x] No hardcoded credentials (use environment variables)
- [x] No stack traces in API responses (error messages are generic)
- [x] HTTPS enforced in staging/production
- [x] CORS properly configured
- [x] Rate limiting enabled (Kong Gateway)
- [x] Health checks configured
- [x] Logging configured (no sensitive data logged)
- [ ] WAF (Web Application Firewall) configured
- [ ] DDoS protection enabled
- [ ] Backup & disaster recovery plan

---

## Performance Tuning

### API Response Times (Target: < 1 second)

**Typical latencies:**

- Change detection prediction: 45-80ms
- Erosion simulation: 15-30ms
- Contaminant simulation: 20-40ms

### Scaling

- **Vertical Scaling:** Increase CPU/memory per container
- **Horizontal Scaling:** Add more container replicas (3-5 recommended)
- **Load Balancing:** Kong Gateway or Nginx distributes requests

**Recommended Production Setup:**

```
3x API Container (replicas)
+ Kong Gateway (rate limiting, routing)
+ Prometheus (monitoring)
+ Grafana (dashboards)
+ ELK Stack (logs)
```

---

## Troubleshooting

### API Won't Start

```bash
# Check logs
docker logs jasper-ml-api

# Verify model file exists
ls -la models/change_detection/model_v1.pkl

# Test imports
python -c "from api.model_endpoint import app; print('✓ Imports OK')"
```

### Slow Responses

```bash
# Check container resources
docker stats jasper-ml-api

# Monitor CPU/Memory
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Scale up if needed
kubectl scale deployment jasper-ml-api --replicas=5
```

### Model Not Loading

```bash
# Check model path
python -c "from pathlib import Path; print(Path('models/change_detection/model_v1.pkl').exists())"

# Try loading manually
python -c "import pickle; pickle.load(open('models/change_detection/model_v1.pkl', 'rb'))"
```

---

## Rollback Procedure

If deployment has issues:

```bash
# Docker: Revert to previous image
docker run -d --name jasper-ml-api bluepulseai/jasper-ml:v1.0-prev

# Kubernetes: Rollback deployment
kubectl rollout undo deployment/jasper-ml-api -n jasper-ml
kubectl rollout history deployment/jasper-ml-api -n jasper-ml
```

---

## Support & Contacts

- **API Issues:** richard@bluepulseai.ca
- **Infrastructure:** devops@bluepulseai.ca
- **Documentation:** docs.bluepulseai.ca

---

**Last Updated:** June 27, 2026  
**Next Review:** July 15, 2026
