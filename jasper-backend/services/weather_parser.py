"""
Environment Canada Historical Climate Data integration — fetches precipitation data.
Owner: Feven | Data Pipeline & API Engineer

This service fetches historical precipitation and temperature records from
Environment Canada's Canada Historical Climate Data portal. We specifically
use the hourly precipitation (rainfall_mm) value to:
  - Feed Richard's RUSLE erosion simulation (high rainfall + burned soil = high erosion)
  - Calibrate the 50mm/hour storm hazard threshold used in risk alert generation
  - Provide context for the timeline slider (show when major rain events occurred)

Station 2203 is the Jasper Townsite weather station — it has hourly records going
back decades and is the closest official station to the Jasper Valley watershed.

The Environment Canada bulk download API returns CSV files with a metadata preamble
(station name, province, coordinates, elevation) before the actual data. Two private
helper functions handle stripping that preamble and parsing the precipitation column.
"""

import csv
import io
import requests
from datetime import datetime, timezone

# Environment Canada bulk climate data download endpoint
# Returns hourly station data as a CSV file when called with the right query parameters
CLIMATE_DATA_URL = "https://climate.weather.gc.ca/climate_data/bulk_data_e.html"

# Substring hint used to find the precipitation column in the CSV.
# Environment Canada uses various column names like "Total Precip (mm)",
# "Precipitation (mm)" etc. — checking for the word "precip" covers all of them.
_PRECIP_HINTS = ("precip",)


def _find_data_start(csv_text: str) -> str:
    """Strip the metadata preamble that Environment Canada prepends to every CSV download.

    Every bulk download from climate.weather.gc.ca starts with several lines of
    station metadata like:
        "Station Name","Jasper"
        "Province","ALBERTA"
        "Latitude","52.88"
        ...

    The actual column headers begin at the row containing "Date/Time". This function
    scans for that row and returns everything from it onwards, discarding the preamble.
    If "Date/Time" is never found (unexpected format), the original text is returned
    unchanged and the CSV parser will do its best.

    Args:
        csv_text: Raw CSV text as returned by the climate data API

    Returns:
        str: The CSV text starting from the header row (or the original if not found)
    """
    lines = csv_text.splitlines()
    for i, line in enumerate(lines):
        # Remove quotes before checking — Environment Canada wraps column names in quotes
        if "date/time" in line.lower().replace('"', ""):
            # Return everything from this header row onwards (inclusive)
            return "\n".join(lines[i:])
    # Fallback: return original text — the DictReader will try to parse it as-is
    return csv_text


def _parse_recent_precipitation(csv_text: str) -> float | None:
    """Extract the most-recent non-null hourly precipitation reading from a climate CSV.

    Iterates all data rows and returns the LAST valid numeric value it finds for
    the precipitation column. Because Environment Canada returns rows oldest-first,
    the last row is the most recent reading.

    Environment Canada uses special sentinel values in their CSVs:
      "M" = Missing data (station malfunction, gap in records)
      "T" = Trace amount (precipitation occurred but was too small to measure)
    Both are skipped — we want only actual numeric measurements.

    Args:
        csv_text: Raw CSV text (may include preamble — this function calls _find_data_start)

    Returns:
        float: The most recent valid precipitation reading in mm, or None if not found
    """
    # Strip the metadata preamble first so the CSV reader sees clean column headers
    data_text = _find_data_start(csv_text)
    lines = [l for l in data_text.splitlines() if l.strip()]

    # Need at least a header row and one data row
    if len(lines) < 2:
        return None

    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    precip_col: str | None = None   # Column name we'll read precipitation from
    last_precip: float | None = None  # Most recent valid reading found so far

    for row in reader:
        # On the first data row, find which column holds precipitation
        if precip_col is None:
            precip_col = next(
                (c for c in row if any(h in c.lower() for h in _PRECIP_HINTS)),
                None  # Returns None if no matching column exists
            )

        if precip_col:
            raw = row.get(precip_col, "").strip().strip('"')

            # Skip missing ("M"), trace ("T"), and empty values
            if raw and raw not in ("M", "T", ""):
                try:
                    v = float(raw)
                    if v >= 0:  # Rainfall can't be negative
                        last_precip = v  # Keep updating — last valid row = most recent
                except ValueError:
                    pass  # Silently skip any remaining non-numeric values

    return last_precip


def fetch_climate_data(station_id: str = "2203", year: str | None = None) -> dict:
    """Fetch historical hourly climate data for a weather station near Jasper.

    Downloads hourly data for the current month of the given year. The most recent
    precipitation reading is extracted and returned as rainfall_mm, which feeds
    directly into Richard's erosion simulation as the "rainfall_mm" input parameter.

    Station 2203 is the Jasper Townsite weather station — the only official
    Environment Canada station close enough to the Jasper Valley watershed to
    provide relevant precipitation data for our erosion and storm simulations.

    Args:
        station_id: Environment Canada station ID (default: 2203 = Jasper, Alberta)
        year:       Which year to fetch data for (default: current year)

    Returns:
        dict with keys:
          station_id  — the station queried
          year        — the year of data requested
          source      — "Canada Historical Climate Data"
          status      — "fetched", "unavailable", or "error"
          records     — number of lines in the CSV response
          rainfall_mm — most-recent hourly precipitation in millimetres (None if unavailable)
    """
    now = datetime.now(timezone.utc)

    # Default to the current year if no year was specified
    if year is None:
        year = str(now.year)

    try:
        params = {
            "format":    "csv",
            "stationID": station_id,
            "Year":      year,
            "Month":     str(now.month),  # Fetch data for the current month only
            "Day":       "1",             # Start from the first of the month
            "timeframe": "2",             # 2 = hourly data (1 = daily, 3 = monthly)
            "submit":    "Download+Data",
        }

        # timeout=10 prevents hanging if Environment Canada's server is slow
        response = requests.get(CLIMATE_DATA_URL, params=params, timeout=10)

        if response.status_code == 200:
            rainfall_mm = _parse_recent_precipitation(response.text)
            return {
                "station_id":  station_id,
                "year":        year,
                "source":      "Canada Historical Climate Data",
                "status":      "fetched",
                "records":     len(response.text.splitlines()),
                "rainfall_mm": rainfall_mm,
            }

        # Non-200 (e.g. unknown station ID, server error)
        return {"station_id": station_id, "status": "unavailable", "rainfall_mm": None}

    except Exception as e:
        print(f"Climate data fetch error: {e}")
        return {
            "station_id":  station_id,
            "status":      "error",
            "message":     str(e),
            "rainfall_mm": None,
        }
