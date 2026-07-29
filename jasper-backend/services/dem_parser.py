"""
Altalis DEM data integration — builds download metadata for terrain elevation files.
Owner: Feven | Data Pipeline & API Engineer

DEM (Digital Elevation Model) files contain the exact height above sea level for
every point in the Jasper watershed. Richard's ML pipeline uses these height values
to calculate slope angles, which are a core input to the RUSLE erosion model:
a steeper slope means soil is more likely to wash away after the wildfire.

Altalis is Alberta's provincial open data portal that provides free access to
25-metre resolution elevation data for the entire province. This service builds
the metadata and download URL so the ingest pipeline knows where to fetch the file.

Note: This file builds metadata for DEM requests — it does not download the binary
file itself. Actual file upload is handled by POST /api/v1/ingest/dem in ingest.py.
"""

import os

# requests is the standard Python library for making synchronous HTTP calls
# to external APIs — used here to future-proof calls to Altalis if needed
import requests

# Base URL for Altalis — Alberta's provincial open data portal for terrain files
ALTALIS_BASE_URL = "https://www.altalisdata.com"


def fetch_dem_data(sector_id: str, coordinates: dict) -> dict:
    """Build a metadata response describing where to find the DEM tile for a sector.

    This function constructs the Altalis download URL for the elevation file that
    covers the given coordinates. The caller (ingest pipeline) uses this URL to
    trigger the actual file download. No network request is made here — this is
    purely URL construction + metadata assembly.

    Args:
        sector_id:   The monitoring sector we need elevation data for (e.g. "ATH-001")
        coordinates: A dict with "lat" and "lon" keys for the centre of the sector.
                     Defaults to Jasper townsite coordinates (52.8734, -118.0823)
                     if lat/lon are not provided.

    Returns:
        dict: Metadata including source name, resolution, coordinates, status,
              and the Altalis download URL. Returns empty dict if an error occurs.
    """
    try:
        # Extract lat/lon, defaulting to Jasper townsite centre if not provided.
        # These defaults ensure the function always returns a usable URL even if
        # the caller didn't specify coordinates for a rough initial lookup.
        lat = coordinates.get("lat", 52.8734)
        lon = coordinates.get("lon", -118.0823)

        return {
            "sector_id":          sector_id,
            "source":             "Altalis Provincial Open Data",
            # 25-metre resolution: each pixel in the DEM covers a 25m x 25m ground area.
            # This is fine enough for watershed-scale erosion modelling.
            "resolution_meters":  25,
            "coordinates":        {"lat": lat, "lon": lon},
            "status":             "ready_for_download",
            # Construct the download URL by embedding the coordinates as query parameters
            "download_url":       f"{ALTALIS_BASE_URL}/data/dem?lat={lat}&lon={lon}"
        }

    except Exception as e:
        # Log the error for Railway logs and return an empty dict.
        # Callers check for empty dict and handle the missing data gracefully.
        print(f"DEM fetch error: {e}")
        return {}