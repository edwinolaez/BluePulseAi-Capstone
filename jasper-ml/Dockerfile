# Multi-stage Dockerfile for Project Jasper ML API
# Stage 1: Builder
FROM python:3.13.7-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt


# Stage 2: Runtime
FROM python:3.13.7-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY . .

# Set environment variables
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    API_ENV=production \
    API_HOST=0.0.0.0 \
    PORT=8080

# Expose port
EXPOSE 8080

# Run API - use PORT environment variable (Railway requirement)
CMD python -m uvicorn api.model_endpoint:app --host 0.0.0.0 --port ${PORT:-8080} --workers 4
