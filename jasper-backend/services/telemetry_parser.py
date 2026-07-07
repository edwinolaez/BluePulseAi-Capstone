"""Environment Canada Water Office integration for river telemetry — Owner: Feven.

This service fetches real-time hydrometric data from Environment Canada.
Station 07AA002 monitors the Athabasca River near Jasper — this is our
primary source for flow rate and water level readings post-wildfire.
"""
import requests

# Base URL for Environment Canada's Water Office bulk data download
WATEROFFICE_URL = "https://wateroffice.ec.gc.ca/services/real_time_data/csv/inline"


def fetch_wateroffice_data(station_id: str = "07AA002") -> dict:
    """Fetch real-time hydrometric data from Environment Canada Water Office.

    We request two parameters from the station:
    - Parameter 47 = water level (how high the river is)
    - Parameter 46 = discharge/flow rate (how fast water is moving)

    These readings help detect post-wildfire flooding and contamination spread.

    Args:
        station_id: The Water Office station ID — default is Athabasca River near Jasper

    Returns:
        dict: Status, station info, and raw CSV data from Environment Canada
              Returns unavailable/error status if the request fails
    """
    try:
        # Build the query parameters for the bulk data download
        # timeframe=2 means hourly data, parameters 47 and 46 are level and flow
        params = {
            "format": "csv",
            "stationID": station_id,
            "Year": "2024",
            "Month": "1",
            "Day": "1",
            "timeframe": "2",
            "submit": "Download+Data",
            # Request both water level (47) and discharge/flow rate (46)
            "parameters[]": [47, 46],
        }

        # Make the GET request with a 10 second timeout
        # timeout prevents the server from hanging if Environment Canada is slow
        response = requests.get(WATEROFFICE_URL, params=params, timeout=10)

        # If successful, return the data with a record count
        if response.status_code == 200:
            return {
                "station_id": station_id,
                "source": "Environment Canada Water Office",
                "status": "fetched",
                # Count lines in CSV response as a quick record count
                "records": len(response.text.split("\n"))
            }

        # Return unavailable status if the request didn't succeed
        return {"station_id": station_id, "status": "unavailable"}

    except Exception as e:
        # Log the error and return error status — caller handles missing data
        print(f"Water Office fetch error: {e}")
        return {"station_id": station_id, "status": "error", "message": str(e)}