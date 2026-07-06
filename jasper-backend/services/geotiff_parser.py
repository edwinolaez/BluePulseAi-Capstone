import os
import requests
from datetime import datetime, timezone

COPERNICUS_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
COPERNICUS_SEARCH_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"

def get_copernicus_token() -> str:
    """Get access token from Copernicus using username and password."""
    username = os.getenv("COPERNICUS_USERNAME")
    password = os.getenv("COPERNICUS_PASSWORD")

    if not username or not password:
        raise Exception("Copernicus credentials not found in .env.local")

    response = requests.post(
        COPERNICUS_TOKEN_URL,
        data={
            "grant_type": "password",
            "username": username,
            "password": password,
            "client_id": "cdse-public"
        }
    )

    if response.status_code != 200:
        raise Exception(f"Failed to get Copernicus token: {response.text}")

    return response.json()["access_token"]


def search_sentinel2(sector_id: str, date_from: str, date_to: str) -> list:
    """Search for Sentinel-2 imagery for a given sector and date range."""
    try:
        token = get_copernicus_token()
        headers = {"Authorization": f"Bearer {token}"}

        params = {
            "$filter": f"Collection/Name eq 'SENTINEL-2' and ContentDate/Start gt {date_from}T00:00:00.000Z and ContentDate/Start lt {date_to}T00:00:00.000Z",
            "$top": 5,
            "$orderby": "ContentDate/Start desc"
        }

        response = requests.get(
            COPERNICUS_SEARCH_URL,
            headers=headers,
            params=params
        )

        if response.status_code == 200:
            return response.json().get("value", [])
        return []

    except Exception as e:
        print(f"Copernicus search error: {e}")
        return []