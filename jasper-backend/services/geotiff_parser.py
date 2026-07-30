"""
Copernicus API integration — searches for Sentinel-2 satellite imagery.
Owner: Feven | Data Pipeline & API Engineer

This service connects to the Copernicus Data Space Ecosystem, which is the
European Space Agency's (ESA) official portal for free satellite data.
Sentinel-2 is a constellation of two satellites that photograph every point on
Earth every 5 days in high resolution. We use these images to:
  - Detect burn scars left by the wildfire (look for darkened areas in NIR bands)
  - Track vegetation regrowth over time (NDVI index from red + NIR bands)
  - Monitor changes in land cover that might increase erosion risk

Authentication flow:
  1. Call get_copernicus_token() with our ESA account credentials to get a
     short-lived JWT access token (tokens typically expire after 10 minutes)
  2. Include that token as "Authorization: Bearer <token>" in search requests
  3. Call search_sentinel2() to find available images for our date range

Credentials (COPERNICUS_USERNAME, COPERNICUS_PASSWORD) are stored as environment
variables in Railway — never hardcoded in source code.
"""

import os

# requests is the standard Python library for making synchronous HTTP calls
import requests

# Copernicus identity server — this is the OAuth2 token endpoint.
# We send our username/password here using the "password" grant type and
# receive a JWT access token in return.
COPERNICUS_TOKEN_URL = (
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
)

# Copernicus OData catalogue — this is where we search for available satellite products.
# We filter by collection name (SENTINEL-2) and date range to find relevant images.
COPERNICUS_SEARCH_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"


def get_copernicus_token() -> str:
    """Request a short-lived access token from the Copernicus identity server.

    Uses the OAuth2 "Resource Owner Password" flow — we send our ESA account
    credentials and receive a JWT token back. This token is then included in the
    Authorization header of every Copernicus catalogue API call.

    Tokens expire quickly (typically 10 minutes), so we request a fresh one
    before each search operation rather than caching and reusing them.

    Returns:
        str: A JWT access token string to use in Authorization headers

    Raises:
        ValueError: If credentials are missing from environment variables
        ValueError: If the authentication request fails (wrong password, locked account, etc.)
    """
    username = os.getenv("COPERNICUS_USERNAME")
    password = os.getenv("COPERNICUS_PASSWORD")

    # Guard clause — fail fast with a useful message if credentials aren't configured
    if not username or not password:
        raise ValueError("Copernicus credentials not found in .env.local")

    # POST our credentials to the token endpoint.
    # grant_type="password" is the OAuth2 flow for direct username/password exchange.
    # client_id="cdse-public" is the public client ID for the Copernicus Data Space.
    response = requests.post(
        COPERNICUS_TOKEN_URL,
        data={
            "grant_type": "password",
            "username":   username,
            "password":   password,
            "client_id":  "cdse-public"
        }
    )

    # A non-200 response means login failed — surface the error body so we can
    # diagnose whether it's a credentials issue, account suspension, etc.
    if response.status_code != 200:
        raise ValueError(f"Failed to get Copernicus token: {response.text}")

    # The response JSON contains several fields; we only need "access_token"
    return response.json()["access_token"]


def search_sentinel2(sector_id: str, date_from: str, date_to: str) -> list:
    """Search the Copernicus catalogue for Sentinel-2 images covering a date range.

    Queries the Copernicus OData API for all Sentinel-2 products whose capture date
    falls within the given range, then returns up to 5 results sorted newest-first.
    The sector_id parameter is available for future filtering by spatial extent
    but is not yet passed to the API (Copernicus spatial filtering requires a
    bounding box geometry, which is a Phase 2 enhancement).

    Args:
        sector_id: The sector we want imagery for (reserved for future spatial filter)
        date_from: Start of the date range in YYYY-MM-DD format (e.g. "2026-06-01")
        date_to:   End of the date range in YYYY-MM-DD format (e.g. "2026-07-01")

    Returns:
        list: Up to 5 Sentinel-2 product metadata dicts, sorted newest capture first.
              Returns empty list if authentication fails or no images are found.
    """
    try:
        # Get a fresh token — Copernicus tokens expire, so we always request a new one
        token = get_copernicus_token()

        # Include the token in every request to prove we are an authorised ESA user
        headers = {"Authorization": f"Bearer {token}"}

        # OData filter syntax (similar to SQL WHERE clause):
        # - Collection/Name eq 'SENTINEL-2'     → only Sentinel-2 products
        # - ContentDate/Start gt <date>T00:00Z  → captured after date_from (exclusive)
        # - ContentDate/Start lt <date>T00:00Z  → captured before date_to (exclusive)
        # $top=5 limits to 5 results; $orderby sorts newest-first
        params = {
            "$filter": (
                f"Collection/Name eq 'SENTINEL-2' and "
                f"ContentDate/Start gt {date_from}T00:00:00.000Z and "
                f"ContentDate/Start lt {date_to}T00:00:00.000Z"
            ),
            "$top":     5,
            "$orderby": "ContentDate/Start desc"
        }

        response = requests.get(
            COPERNICUS_SEARCH_URL,
            headers=headers,
            params=params
        )

        if response.status_code == 200:
            # The "value" key holds the list of matching products in Copernicus OData responses
            return response.json().get("value", [])

        # Non-200 but not an exception — just return empty list so the caller
        # can decide whether to retry or proceed without imagery
        return []

    except Exception as e:
        # Any error (token failure, network issue, JSON parse error) returns empty list
        # so the upstream ingest pipeline can continue without satellite data
        print(f"Copernicus search error: {e}")
        return []