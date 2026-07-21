"""Environment Canada Water Office integration for river telemetry — Owner: Feven.

This service fetches real-time hydrometric data from Environment Canada.
Station 07AA002 monitors the Athabasca River near Jasper — this is our
primary source for flow rate and water level readings post-wildfire.
"""
import csv
import io
import requests
from datetime import datetime, timezone

WATEROFFICE_URL = "https://wateroffice.ec.gc.ca/services/real_time_data/csv/inline"

# Athabasca River at Jasper cross-section estimate (~50 m wide, ~1 m deep)
# Converts bulk discharge (m³/s) to an approximate surface velocity (m/s)
_CROSS_SECTION_M2 = 50.0


def _parse_discharge(csv_text: str) -> float | None:
    """
    Extract the most-recent discharge reading from a Water Office CSV response.

    The CSV has one column per requested parameter. We look for a column whose
    name contains "discharge", "flow", or "46" (the Water Office parameter code
    for discharge). Falls back to the third column if no named match is found,
    since Water Office CSVs are typically ordered: Date, Level, Discharge.
    """
    lines = [l for l in csv_text.splitlines()
             if l.strip() and not l.lstrip().startswith("#")]
    if len(lines) < 2:
        return None

    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    target_col: str | None = None
    last_value: float | None = None

    for row in reader:
        if target_col is None:
            hints = ("discharge", "flow", "46")
            target_col = next(
                (c for c in row if any(h in c.lower() for h in hints)),
                None
            )
            if target_col is None:
                cols = list(row.keys())
                if len(cols) >= 3:
                    target_col = cols[2]

        if target_col:
            raw = row.get(target_col, "").strip().strip('"')
            if raw and raw not in ("M", "T", ""):
                try:
                    v = float(raw.replace(",", ""))
                    if v >= 0:
                        last_value = v
                except ValueError:
                    pass

    return last_value


def fetch_wateroffice_data(station_id: str = "07AA002") -> dict:
    """Fetch real-time hydrometric data from Environment Canada Water Office.

    We request two parameters from the station:
    - Parameter 47 = water level (how high the river is)
    - Parameter 46 = discharge/flow rate (how fast water is moving)

    These readings help detect post-wildfire flooding and contamination spread.

    Args:
        station_id: The Water Office station ID — default is Athabasca River near Jasper

    Returns:
        dict with keys:
          station_id, source, status, records,
          discharge_m3s  — raw discharge in cubic metres per second (None if unavailable)
          water_velocity_ms — estimated surface velocity in m/s (None if unavailable)
    """
    now = datetime.now(timezone.utc)
    try:
        params = {
            "format": "csv",
            "stationID": station_id,
            "Year":  str(now.year),
            "Month": str(now.month),
            "Day":   str(now.day),
            "timeframe": "2",
            "submit": "Download+Data",
            "parameters[]": [47, 46],
        }

        response = requests.get(WATEROFFICE_URL, params=params, timeout=10)

        if response.status_code == 200:
            discharge_m3s = _parse_discharge(response.text)
            if discharge_m3s is not None:
                water_velocity_ms = round(min(discharge_m3s / _CROSS_SECTION_M2, 5.0), 3)
            else:
                water_velocity_ms = None

            return {
                "station_id": station_id,
                "source": "Environment Canada Water Office",
                "status": "fetched",
                "records": len(response.text.splitlines()),
                "discharge_m3s": discharge_m3s,
                "water_velocity_ms": water_velocity_ms,
            }

        return {
            "station_id": station_id,
            "status": "unavailable",
            "discharge_m3s": None,
            "water_velocity_ms": None,
        }

    except Exception as e:
        print(f"Water Office fetch error: {e}")
        return {
            "station_id": station_id,
            "status": "error",
            "message": str(e),
            "discharge_m3s": None,
            "water_velocity_ms": None,
        }
