import os
import requests

ALTALIS_BASE_URL = "https://www.altalisdata.com"

def fetch_dem_data(sector_id: str, coordinates: dict) -> dict:
    """
    Fetch Digital Elevation Model data from Altalis for a given sector.
    Currently returns metadata — actual file download happens via ingest endpoint.
    """
    try:
        lat = coordinates.get("lat", 52.8734)
        lon = coordinates.get("lon", -118.0823)
        
        return {
            "sector_id": sector_id,
            "source": "Altalis Provincial Open Data",
            "resolution_meters": 25,
            "coordinates": {"lat": lat, "lon": lon},
            "status": "ready_for_download",
            "download_url": f"{ALTALIS_BASE_URL}/data/dem?lat={lat}&lon={lon}"
        }
    except Exception as e:
        print(f"DEM fetch error: {e}")
        return {}