"""Pydantic validation schemas for ingest endpoints — Owner: Feven.

Pydantic schemas define the shape of data our API expects.
When a request comes in, FastAPI automatically validates it against
these schemas and returns 422 if anything is missing or wrong.
"""
from datetime import datetime
from typing import Optional

# BaseModel is the base class for all Pydantic schemas
# Every schema we define inherits from it
from pydantic import BaseModel


class Coordinates(BaseModel):
    """Validates geographic coordinates are within valid ranges.
    lat must be -90 to 90, lon must be -180 to 180."""
    lat: float
    lon: float


class GeoTiffIngest(BaseModel):
    """Schema for GeoTIFF satellite imagery ingest requests.
    FastAPI checks incoming requests match this shape before running the endpoint."""
    sector_id: str
    data_source: str
    user_id: str
    # datetime type means FastAPI will parse ISO 8601 strings automatically
    timestamp: datetime
    coordinates: Coordinates


class DEMIngest(BaseModel):
    """Schema for Digital Elevation Model ingest requests.
    Same structure as GeoTiffIngest — both are file-based ingests."""
    sector_id: str
    data_source: str
    user_id: str
    timestamp: datetime
    coordinates: Coordinates


class TelemetryIngest(BaseModel):
    """Schema for water quality telemetry ingest requests.
    Optional fields use None as default — they don't have to be provided."""
    sector_id: str
    data_source: str
    user_id: str
    timestamp: datetime
    coordinates: Coordinates
    # Optional sensor readings — not every station tracks all measurements
    turbidity: Optional[float] = None
    flow_rate: Optional[float] = None