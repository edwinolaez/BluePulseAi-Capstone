import requests

CLIMATE_DATA_URL = "https://climate.weather.gc.ca/climate_data/bulk_data_e.html"

def fetch_climate_data(station_id: str = "2203", year: str = "2024") -> dict:
    """
    Fetch historical climate data from Environment Canada.
    Default station 2203 is Jasper, Alberta.
    """
    try:
        params = {
            "format": "csv",
            "stationID": station_id,
            "Year": year,
            "Month": "1",
            "Day": "1",
            "timeframe": "2",
            "submit": "Download+Data"
        }

        response = requests.get(CLIMATE_DATA_URL, params=params, timeout=10)

        if response.status_code == 200:
            return {
                "station_id": station_id,
                "year": year,
                "source": "Canada Historical Climate Data",
                "status": "fetched",
                "records": len(response.text.split("\n"))
            }
        return {"station_id": station_id, "status": "unavailable"}

    except Exception as e:
        print(f"Climate data fetch error: {e}")
        return {"station_id": station_id, "status": "error", "message": str(e)}