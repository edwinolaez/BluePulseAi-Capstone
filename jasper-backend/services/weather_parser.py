"""Canada Historical Climate Data integration for weather/precipitation — Owner: Feven.

This service fetches historical precipitation and temperature data from
Environment Canada's climate data portal. We use this to calibrate
Richard's storm hazard simulations — specifically the 50mm/hour threshold.
"""
import csv
import io
import requests
from datetime import datetime, timezone

CLIMATE_DATA_URL = "https://climate.weather.gc.ca/climate_data/bulk_data_e.html"

# Environment Canada hourly CSV uses these column names for precipitation
_PRECIP_HINTS = ("precip",)


def _find_data_start(csv_text: str) -> str:
    """
    Strip the metadata preamble that Environment Canada prepends to every CSV.

    The bulk download endpoint returns several rows of station metadata
    (name, province, lat/lon, elevation) before the actual data header row.
    We find the real header by looking for the 'Date/Time' column name.
    """
    lines = csv_text.splitlines()
    for i, line in enumerate(lines):
        if "date/time" in line.lower().replace('"', ""):
            return "\n".join(lines[i:])
    return csv_text


def _parse_recent_precipitation(csv_text: str) -> float | None:
    """
    Extract the most-recent non-null precipitation value from a climate CSV.

    Environment Canada marks missing data as 'M' and trace amounts as 'T'.
    Both are treated as 0 for simulation purposes — we skip them and return
    the last actual numeric reading.
    """
    data_text = _find_data_start(csv_text)
    lines = [l for l in data_text.splitlines() if l.strip()]
    if len(lines) < 2:
        return None

    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    precip_col: str | None = None
    last_precip: float | None = None

    for row in reader:
        if precip_col is None:
            precip_col = next(
                (c for c in row if any(h in c.lower() for h in _PRECIP_HINTS)),
                None
            )

        if precip_col:
            raw = row.get(precip_col, "").strip().strip('"')
            if raw and raw not in ("M", "T", ""):
                try:
                    v = float(raw)
                    if v >= 0:
                        last_precip = v
                except ValueError:
                    pass

    return last_precip


def fetch_climate_data(station_id: str = "2203", year: str | None = None) -> dict:
    """Fetch historical climate data for a weather station near Jasper.

    Station 2203 is the Jasper weather station — it records hourly
    precipitation, temperature, wind speed, and humidity going back decades.
    This historical data is used to set baseline thresholds for storm simulations.

    Args:
        station_id: Environment Canada station ID — default is Jasper, Alberta
        year: Which year of data to fetch — defaults to current year

    Returns:
        dict with keys:
          station_id, year, source, status, records,
          rainfall_mm — most-recent hourly precipitation reading (None if unavailable)
    """
    now = datetime.now(timezone.utc)
    if year is None:
        year = str(now.year)

    try:
        params = {
            "format": "csv",
            "stationID": station_id,
            "Year":  year,
            "Month": str(now.month),
            "Day":   "1",
            "timeframe": "2",
            "submit": "Download+Data",
        }

        response = requests.get(CLIMATE_DATA_URL, params=params, timeout=10)

        if response.status_code == 200:
            rainfall_mm = _parse_recent_precipitation(response.text)
            return {
                "station_id": station_id,
                "year": year,
                "source": "Canada Historical Climate Data",
                "status": "fetched",
                "records": len(response.text.splitlines()),
                "rainfall_mm": rainfall_mm,
            }

        return {"station_id": station_id, "status": "unavailable", "rainfall_mm": None}

    except Exception as e:
        print(f"Climate data fetch error: {e}")
        return {
            "station_id": station_id,
            "status": "error",
            "message": str(e),
            "rainfall_mm": None,
        }
