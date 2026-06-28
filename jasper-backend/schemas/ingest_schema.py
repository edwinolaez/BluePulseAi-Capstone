from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class Coordinates(BaseModel):
    lat: float
    lon: float

class GeoTiffIngest(BaseModel):
    sector_id: str
    data_source: str
    user_id: str
    timestamp: datetime
    coordinates: Coordinates

class DEMIngest(BaseModel):
    sector_id: str
    data_source: str
    user_id: str
    timestamp: datetime
    coordinates: Coordinates

class TelemetryIngest(BaseModel):
    sector_id: str
    data_source: str
    user_id: str
    timestamp: datetime
    coordinates: Coordinates
    turbidity: Optional[float] = None
    flow_rate: Optional[float] = None