"""Canada Historical Climate Data integration for weather/precipitation — Owner: Feven.

This service fetches historical precipitation and temperature data from
Environment Canada's climate data portal. We use this to calibrate
Richard's storm hazard simulations — specifically the 50mm/hour threshold.
"""
import requests

# Base URL for Environment Canada's climate data bulk download endpoint
CLIMATE_DATA_URL = "https://climate.weather.gc.ca/climate_data/bulk_data_e.html"


def fetch_climate_data(station_id: str = "2203", year: str = "2024") -> dict:
    """Fetch historical climate data for a weather station near Jasper.

    Station 2203 is the Jasper weather station — it records hourly
    precipitation, temperature, wind speed, and humidity going back decades.
    This historical data is used to set baseline thresholds for storm simulations.

    Args:
        station_id: Environment Canada station ID — default is Jasper, Alberta
        year: Which year of data to fetch — default is 2024

    Returns:
        dict: Status, station info, and record count from the CSV response
              Returns unavailable/error status if the request fails
    """
    try:
        # Build query parameters for the bulk data download
        # timeframe=2 means hourly data (1=daily, 2=hourly, 3=monthly)
        # format=csv returns data as a CSV file we can parse line by line
        params = {
            "format": "csv",
            "stationID": station_id,
            "Year": year,
            "Month": "1",
            "Day": "1",
            "timeframe": "2",
            "submit": "Download+Data"
        }

        # Make the GET request with a 10 second timeout
        # timeout prevents the server from hanging if the climate API is slow
        response = requests.get(CLIMATE_DATA_URL, params=params, timeout=10)

        # If successful, return metadata including a rough record count
        if response.status_code == 200:
            return {
                "station_id": station_id,
                "year": year,
                "source": "Canada Historical Climate Data",
                "status": "fetched",
                # Split on newlines to count how many rows of data came back
                "records": len(response.text.split("\n"))
            }

        # Return unavailable if the request didn't succeed
        return {"station_id": station_id, "status": "unavailable"}

    except Exception as e:
        # Log and return error status — caller handles missing data gracefully
        print(f"Climate data fetch error: {e}")
        return {"station_id": station_id, "status": "error", "message": str(e)}