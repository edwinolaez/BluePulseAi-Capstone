"""
Environment Canada Water Office integration — fetches real-time river telemetry.
Owner: Feven | Data Pipeline & API Engineer

This service pulls live hydrometric (river measurement) data from Environment
Canada's Water Survey of Canada (WSC) monitoring network. Station 07AA002 sits
on the Athabasca River near Jasper and is our primary sensor for detecting:
  - Post-wildfire runoff events (sudden spikes in flow rate)
  - Contamination transport risk (high velocity = plume spreads faster)
  - Flood risk (water level rising above normal range)

The Water Office API returns data as a CSV file with a commented preamble, so
this file includes a small CSV parser (_parse_discharge) to extract the most
recent discharge reading from the raw text.

Discharge (m³/s) is converted to surface water velocity (m/s) using a simple
cross-section area estimate for the Athabasca River at Jasper. This velocity
value feeds directly into Richard's contaminant plume simulation as input.
"""

import csv
import io
import requests
from datetime import datetime, timezone

# The Water Office real-time data download endpoint
WATEROFFICE_URL = "https://wateroffice.ec.gc.ca/services/real_time_data/csv/inline"

# Estimated cross-section area of the Athabasca River at Jasper in square metres.
# Based on field survey data: approximately 50m wide and 1m average depth.
# velocity = discharge / cross_section_area — this converts bulk flow to surface speed.
_CROSS_SECTION_M2 = 50.0


def _parse_discharge(csv_text: str) -> float | None:
    """Extract the most-recent discharge reading from an Environment Canada Water Office CSV.

    Water Office CSVs have a tricky format: several lines of commented metadata
    (lines starting with "#") appear before the actual data header. This function
    strips the comments, then scans for the discharge column by looking for
    column names containing "discharge", "flow", or "46" (the WSC parameter code).

    The function iterates all rows and returns the LAST valid numeric value it finds.
    This gives us the most recent reading, since Water Office returns rows oldest-first.

    Args:
        csv_text: Raw CSV text as returned by the Water Office API

    Returns:
        float: The most recent valid discharge value in m³/s, or None if not found
    """
    # Strip comment lines (start with "#") and blank lines before feeding to csv.DictReader
    lines = [l for l in csv_text.splitlines()
             if l.strip() and not l.lstrip().startswith("#")]

    # Need at least a header row and one data row to extract anything
    if len(lines) < 2:
        return None

    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    target_col: str | None = None   # The column name we'll read discharge from
    last_value: float | None = None  # The most recent valid reading found so far

    for row in reader:
        # On the first data row, figure out which column holds discharge.
        # We check column names on the first pass only (they don't change between rows).
        if target_col is None:
            hints = ("discharge", "flow", "46")  # "46" is the WSC parameter code for discharge
            target_col = next(
                (c for c in row if any(h in c.lower() for h in hints)),
                None
            )
            if target_col is None:
                # No named match found — fall back to the third column.
                # Water Office CSVs are typically ordered: Date, Level, Discharge
                cols = list(row.keys())
                if len(cols) >= 3:
                    target_col = cols[2]

        if target_col:
            raw = row.get(target_col, "").strip().strip('"')
            # "M" = Missing data, "T" = Trace amount (too small to measure)
            # Both are skipped — we only want real numeric readings
            if raw and raw not in ("M", "T", ""):
                try:
                    # Remove any thousands-separator commas before converting to float
                    v = float(raw.replace(",", ""))
                    if v >= 0:  # Discharge can't be negative — ignore invalid readings
                        last_value = v  # Keep updating: last row = most recent reading
                except ValueError:
                    pass  # Non-numeric values (column headers, units rows) are silently skipped

    return last_value


def fetch_wateroffice_data(station_id: str = "07AA002") -> dict:
    """Fetch real-time hydrometric data for a Water Survey of Canada station.

    Requests today's data for two parameters:
      - Parameter 47: water level above datum (metres) — how high the river is
      - Parameter 46: discharge / flow rate (m³/s) — how much water is flowing

    The discharge value is then converted to a surface water velocity estimate
    using the Athabasca River cross-section area. This velocity feeds into the
    contaminant plume simulation as the "water_velocity_ms" input.

    Args:
        station_id: WSC station identifier — default 07AA002 is Athabasca River at Jasper

    Returns:
        dict with keys:
          station_id         — the station queried
          source             — "Environment Canada Water Office"
          status             — "fetched", "unavailable", or "error"
          records            — number of CSV lines in the response
          discharge_m3s      — most recent discharge in cubic metres/second (None if unavailable)
          water_velocity_ms  — estimated surface velocity in metres/second (None if unavailable)
    """
    now = datetime.now(timezone.utc)
    try:
        # Request today's data at hourly resolution (timeframe=2)
        # parameters[] is a multi-value list: [47, 46] = level + discharge
        params = {
            "format":       "csv",
            "stationID":    station_id,
            "Year":         str(now.year),
            "Month":        str(now.month),
            "Day":          str(now.day),
            "timeframe":    "2",           # 2 = hourly data
            "submit":       "Download+Data",
            "parameters[]": [47, 46],      # 47 = water level, 46 = discharge
        }

        # timeout=10 prevents indefinite hangs if the Water Office server is slow
        response = requests.get(WATEROFFICE_URL, params=params, timeout=10)

        if response.status_code == 200:
            discharge_m3s = _parse_discharge(response.text)

            if discharge_m3s is not None:
                # velocity = discharge / cross-section area
                # min(..., 5.0) caps velocity at 5 m/s — above that is clearly a data error
                # round(..., 3) gives 3 decimal places (mm/s precision) — enough for the simulation
                water_velocity_ms = round(min(discharge_m3s / _CROSS_SECTION_M2, 5.0), 3)
            else:
                water_velocity_ms = None

            return {
                "station_id":        station_id,
                "source":            "Environment Canada Water Office",
                "status":            "fetched",
                "records":           len(response.text.splitlines()),
                "discharge_m3s":     discharge_m3s,
                "water_velocity_ms": water_velocity_ms,
            }

        # Non-200 response (e.g. 404 for an unknown station ID)
        return {
            "station_id":        station_id,
            "status":            "unavailable",
            "discharge_m3s":     None,
            "water_velocity_ms": None,
        }

    except Exception as e:
        print(f"Water Office fetch error: {e}")
        return {
            "station_id":        station_id,
            "status":            "error",
            "message":           str(e),
            "discharge_m3s":     None,
            "water_velocity_ms": None,
        }
