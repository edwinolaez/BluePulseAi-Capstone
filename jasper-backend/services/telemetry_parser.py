import os
import requests

WATEROFFICE_URL = "https://wateroffice.ec.gc.ca/services/real_time_data/csv/inline"

def fetch_wateroffice_data(station_id: str = "07AA002") -> dict:
    """
    Fetch real-time hydrometric data from Environment Canada Water Office.
    Default station 07AA002 is the Athabasca River near Jasper.
    """
    try:
        params = {
            "stations[]": station_id,
            "parameters[]": [47, 46],  # 47=water level, 46=discharge/flow rate
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
        
        response = requests.get(WATEROFFICE_URL, params=params, timeout=10)
        
        if response.status_code == 200:
            return {
                "station_id": station_id,
                "source": "Environment Canada Water Office",
                "status": "fetched",
                "data": response.text[:500]
            }
        return {"station_id": station_id, "status": "unavailable"}
        
    except Exception as e:
        print(f"Water Office fetch error: {e}")
        return {"station_id": station_id, "status": "error", "message": str(e)}