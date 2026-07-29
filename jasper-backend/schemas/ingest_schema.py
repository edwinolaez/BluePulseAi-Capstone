"""
Pydantic validation schemas for ingest endpoints.
Owner: Feven | Data Pipeline & API Engineer

This file defines the "shape" of data that the ingest endpoints expect to receive.
Pydantic is a Python library that checks incoming data against these class
definitions automatically — if a required field is missing or the wrong type,
FastAPI returns a 422 Unprocessable Entity response before the endpoint even runs.

Think of these classes as contracts: "if you want to call this endpoint,
your request body must look exactly like this."

These schemas are imported and used in ingest.py. They are kept in a separate
file to make it easy to find and update validation rules without digging through
the endpoint logic.
"""

from datetime import datetime
from typing import Optional

# BaseModel is the Pydantic base class. Every schema inherits from it to get
# automatic validation, serialisation, and IDE autocompletion for free.
from pydantic import BaseModel


class Coordinates(BaseModel):
    """Validates that geographic coordinates are within physically possible ranges.

    Pydantic will reject any value outside these ranges with a 422 automatically.
    The range checks here are intentionally loose (no Field constraints) —
    ingest.py's own Coordinates class adds stricter ge/le bounds for endpoints
    that need them. This class is used as a nested type in the schemas below.

    lat: Latitude in decimal degrees (-90 to +90)
    lon: Longitude in decimal degrees (-180 to +180)
    """
    lat: float
    lon: float


class GeoTiffIngest(BaseModel):
    """Schema for a GeoTIFF satellite imagery ingest request body.

    Used by the POST /api/v1/ingest/geotiff endpoint to validate that all
    required metadata is present alongside the uploaded file. FastAPI checks
    the multipart form fields against this schema before calling the endpoint.

    sector_id:   Which monitoring sector this image covers (e.g. "ATH-001-A")
    data_source: Which satellite or provider produced this image (e.g. "Copernicus")
    user_id:     Identifier of the person or service uploading the file
    timestamp:   When the image was captured. The `datetime` type means FastAPI
                 will automatically parse ISO 8601 strings like "2026-07-18T10:00:00Z"
    coordinates: The geographic centre point of this image tile
    """
    sector_id: str
    data_source: str
    user_id: str
    # Using `datetime` (not `str`) means Pydantic parses and validates the date format
    # automatically — invalid date strings like "not-a-date" are rejected with 422
    timestamp: datetime
    coordinates: Coordinates


class DEMIngest(BaseModel):
    """Schema for a Digital Elevation Model ingest request body.

    DEM files contain terrain height data used by Richard's ML models to calculate
    slope angles for the RUSLE erosion equation. Same required fields as GeoTiffIngest
    because both are file-based ingests with the same metadata requirements.

    sector_id:   Which sector's terrain this elevation file covers
    data_source: Data provider (e.g. "Altalis Provincial Open Data")
    user_id:     Identifier of the uploader
    timestamp:   When this elevation survey was conducted
    coordinates: Geographic centre point of the DEM tile
    """
    sector_id: str
    data_source: str
    user_id: str
    timestamp: datetime
    coordinates: Coordinates


class TelemetryIngest(BaseModel):
    """Schema for a water quality telemetry ingest request body.

    Telemetry readings come from Environment Canada river monitoring stations.
    Not every station measures every parameter, so turbidity and flow_rate are
    Optional — they can be omitted from the request without causing a 422 error.

    sector_id:   Which monitoring sector the sensor station is in
    data_source: Which station provided this reading (e.g. "07AA002")
    user_id:     Identifier of the service submitting this reading
    timestamp:   When the sensor took this measurement
    coordinates: Geographic location of the sensor station
    turbidity:   Water cloudiness in NTU — None if not measured by this station
    flow_rate:   River flow rate in m³/s — None if not measured by this station
    """
    sector_id: str
    data_source: str
    user_id: str
    timestamp: datetime
    coordinates: Coordinates
    # Optional fields default to None — not every monitoring station tracks all parameters
    turbidity: Optional[float] = None
    flow_rate: Optional[float] = None