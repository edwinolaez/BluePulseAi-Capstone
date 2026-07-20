"""Copernicus API integration for fetching Sentinel-2 satellite imagery — Owner: Feven.

This service connects to the Copernicus Data Space Ecosystem (ESA's satellite data portal).
Sentinel-2 imagery is what we use to detect burn scars and vegetation loss after the wildfire.
"""
import os

import requests

# Copernicus token endpoint — we send our username/password here to get an access token
# Access tokens expire, so we request a fresh one each time
COPERNICUS_TOKEN_URL = (
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
)

# Copernicus product search endpoint — we query this to find available satellite images
COPERNICUS_SEARCH_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"


def get_copernicus_token() -> str:
    """Request a short-lived access token from Copernicus using our account credentials.
    The token is used in the Authorization header for all subsequent API calls.
    Credentials come from environment variables — never hardcoded."""
    username = os.getenv("COPERNICUS_USERNAME")
    password = os.getenv("COPERNICUS_PASSWORD")

    # Guard clause — fail early with a clear message if credentials are missing
    if not username or not password:
        raise ValueError("Copernicus credentials not found in .env.local")

    # POST our credentials to get back a JWT access token
    # grant_type="password" is the OAuth2 flow for username/password login
    response = requests.post(
        COPERNICUS_TOKEN_URL,
        data={
            "grant_type": "password",
            "username": username,
            "password": password,
            "client_id": "cdse-public"
        }
    )

    # Raise an error if authentication failed — wrong password, account issues, etc.
    if response.status_code != 200:
        raise ValueError(f"Failed to get Copernicus token: {response.text}")

    # Extract the access token from the response JSON
    return response.json()["access_token"]


def search_sentinel2(sector_id: str, date_from: str, date_to: str) -> list:
    """Search Copernicus for Sentinel-2 satellite images covering a date range.
    Returns up to 5 most recent images — sorted newest first.
    Returns empty list if token fetch fails or no images are found."""
    try:
        # Get a fresh access token — required for every Copernicus API call
        token = get_copernicus_token()

        # Include the token in the Authorization header so Copernicus knows who we are
        headers = {"Authorization": f"Bearer {token}"}

        # OData filter syntax — filters by collection name and date range
        # $top=5 limits results to 5 images, $orderby sorts newest first
        params = {
            "$filter": (
                f"Collection/Name eq 'SENTINEL-2' and "
                f"ContentDate/Start gt {date_from}T00:00:00.000Z and "
                f"ContentDate/Start lt {date_to}T00:00:00.000Z"
            ),
            "$top": 5,
            "$orderby": "ContentDate/Start desc"
        }

        response = requests.get(
            COPERNICUS_SEARCH_URL,
            headers=headers,
            params=params
        )

        # Return the list of matching images, or empty list if none found
        if response.status_code == 200:
            return response.json().get("value", [])
        return []

    except Exception as e:
        # Log the error and return empty list — caller handles missing data
        print(f"Copernicus search error: {e}")
        return []