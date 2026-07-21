"""Altalis DEM data integration for terrain elevation data — Owner: Feven.

DEM (Digital Elevation Model) files contain height values for every point
in the Jasper watershed. Richard's ML models use this to calculate erosion
risk and predict where contamination will flow after the wildfire.
"""
import os

# requests is the standard Python library for making HTTP calls to external APIs
import requests

# Base URL for Altalis — Alberta's provincial open data portal for terrain files
ALTALIS_BASE_URL = "https://www.altalisdata.com"


def fetch_dem_data(sector_id: str, coordinates: dict) -> dict:
    """Build a metadata response for a DEM tile request.

    This function takes a sector ID and coordinates, then returns
    metadata about where to find the corresponding DEM tile on Altalis.
    Actual file download happens through the /ingest/dem endpoint.

    Args:
        sector_id: The sector we need elevation data for (e.g. "ATH-001")
        coordinates: Dict with lat/lon keys for the center of the sector

    Returns:
        dict: Metadata including source, resolution, and download URL
              Returns empty dict if an error occurs
    """
    try:
        # Extract lat/lon from the coordinates dict
        # Default to Jasper's coordinates if none provided
        lat = coordinates.get("lat", 52.8734)
        lon = coordinates.get("lon", -118.0823)

        # Build and return the metadata response
        # resolution_meters=25 means each pixel represents a 25m x 25m area
        return {
            "sector_id": sector_id,
            "source": "Altalis Provincial Open Data",
            "resolution_meters": 25,
            "coordinates": {"lat": lat, "lon": lon},
            "status": "ready_for_download",
            # Construct the download URL using the coordinates
            "download_url": f"{ALTALIS_BASE_URL}/data/dem?lat={lat}&lon={lon}"
        }

    except Exception as e:
        # Log the error and return empty dict — caller handles missing data
        print(f"DEM fetch error: {e}")
        return {}