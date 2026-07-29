"""
sensor_fetch.py — Live sensor values from Environment Canada open data
                  and SRTM terrain elevation.

This module is responsible for pulling real-world environmental measurements
into the Jasper simulation models so they don't have to rely on hard-coded
numbers.  It talks to two public APIs:

  1. Environment Canada Water Office (wateroffice.ec.gc.ca)
     - Fetches discharge (m³/s) for the Athabasca River at station 07AA002
       and converts it to a surface velocity (m/s) using an estimated
       cross-sectional area.

  2. Environment Canada Climate Data (climate.weather.gc.ca)
     - Fetches today's total precipitation (mm) from Jasper weather station 2203.

  3. OpenTopoData SRTM 30m (api.opentopodata.org)
     - Queries elevation at five points around a coordinate and computes
       terrain slope using a finite-difference gradient.

All three calls are wrapped in an in-process cache to avoid hammering the
external APIs on every simulation request:
  - Discharge / rainfall: 5-minute TTL (Environment Canada updates hourly)
  - Terrain slope:        24-hour TTL  (terrain doesn't change between runs)

If an external API is unavailable, a safe fallback value is returned instead
so the simulation endpoints stay responsive.
"""
import csv
import io
import math
import time
import requests
from datetime import datetime, timezone

# Base URLs for the three external data sources
_WATEROFFICE_URL = "https://wateroffice.ec.gc.ca/services/real_time_data/csv/inline"
_CLIMATE_URL     = "https://climate.weather.gc.ca/climate_data/bulk_data_e.html"
_OPEN_TOPO_URL   = "https://api.opentopodata.org/v1/srtm30m"

# Athabasca River at station 07AA002 cross-section estimate (~50 m wide, ~1 m deep).
# Used to convert bulk discharge (m³/s) → surface velocity (m/s):
#   velocity = discharge / cross_section_area
_CROSS_SECTION_M2 = 50.0

# Safe fallback values returned when Environment Canada APIs are unavailable.
# FALLBACK_VELOCITY_MS is the median Athabasca summer flow — reasonable for
# a contaminant simulation when live data can't be fetched.
FALLBACK_VELOCITY_MS = 1.5   # median Athabasca summer flow
FALLBACK_RAINFALL_MM = 0.0   # dry-day default (conservative — underestimates erosion)

# Shared in-process cache: {key: {"val": value, "ts": monotonic_time}}
_CACHE: dict = {}
_SENSOR_TTL = 300    # 5 min — EC readings update hourly, no need to be faster
_TERRAIN_TTL = 86400 # 24 h  — terrain slope doesn't change


def _cached(key: str, fetch_fn, ttl: int = _SENSOR_TTL):
    """
    Generic TTL cache wrapper.

    Checks whether a cached value for `key` is still fresh (i.e. was stored
    less than `ttl` seconds ago).  If yes, returns the cached value.
    If no, calls `fetch_fn()` to get a fresh value, stores it, and returns it.

    Args:
        key      — unique string identifier for the cached value.
        fetch_fn — zero-argument callable that returns the fresh value.
        ttl      — how many seconds the cached value is considered valid.

    Returns:
        Whatever fetch_fn() returns (cached or freshly fetched).
    """
    now = time.monotonic()
    if key in _CACHE and now - _CACHE[key]["ts"] < ttl:
        return _CACHE[key]["val"]
    val = fetch_fn()
    _CACHE[key] = {"val": val, "ts": now}
    return val


def _last_numeric(csv_text: str, col_hints: list[str]) -> float | None:
    """
    Scan a CSV string and return the most-recent non-null numeric value from
    any column whose name contains one of the hint substrings (case-insensitive).

    Environment Canada CSVs use "M" (missing) and "T" (trace amount) as
    sentinel strings instead of empty cells — this function skips those.
    Falls back to the third positional column if no named match is found
    (the standard EC layout is: Date, Water Level, Discharge).

    Args:
        csv_text  — raw CSV string from an EC API response.
        col_hints — list of substrings to look for in the header row
                    (e.g. ["discharge", "flow", "46"]).

    Returns:
        The last valid float found, or None if no valid row exists.
    """
    # Strip comment lines (lines starting with "#") and blank lines before
    # handing to the CSV reader.
    lines = [l for l in csv_text.splitlines()
             if l.strip() and not l.lstrip().startswith("#")]
    if len(lines) < 2:
        return None

    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    target_col: str | None = None
    last_val: float | None = None

    for row in reader:
        # Determine which column to read on the first data row
        if target_col is None:
            for hint in col_hints:
                match = next((c for c in row if hint.lower() in c.lower()), None)
                if match:
                    target_col = match
                    break
            if target_col is None:
                # No column matched any hint — fall back to positional column 3
                cols = list(row.keys())
                if len(cols) >= 3:
                    target_col = cols[2]  # Date, Level, Discharge positional fallback

        if target_col:
            raw = row.get(target_col, "").strip().strip('"')
            # Skip EC sentinel values: M = missing, T = trace (too small to measure)
            if raw and raw not in ("M", "T", ""):
                try:
                    v = float(raw.replace(",", ""))
                    if v >= 0:
                        last_val = v  # keep updating — we want the last valid row
                except ValueError:
                    pass

    return last_val


def _fetch_velocity() -> tuple[float, str]:
    """
    Fetch current Athabasca River discharge from EC Water Office station 07AA002
    and convert it to a surface velocity in m/s.

    Requests today's real-time CSV export (timeframe=2 means hourly data).
    Parameters 47 and 46 are the EC codes for water level and discharge
    respectively.

    Returns a (velocity_ms, source_label) tuple.  Falls back to
    FALLBACK_VELOCITY_MS if the request fails or returns no usable data.
    """
    now = datetime.now(timezone.utc)
    try:
        r = requests.get(_WATEROFFICE_URL, params={
            "format": "csv",
            "stationID": "07AA002",
            "Year":  str(now.year),
            "Month": str(now.month),
            "Day":   str(now.day),
            "timeframe": "2",
            "submit": "Download+Data",
            "parameters[]": [47, 46],  # 47 = water level, 46 = discharge
        }, timeout=10)

        if r.status_code == 200:
            discharge = _last_numeric(r.text, ["discharge", "flow", "46"])
            if discharge is not None:
                # Cap at 5 m/s — anything higher is a data artefact, not a real reading
                velocity = round(min(discharge / _CROSS_SECTION_M2, 5.0), 3)
                return velocity, f"EC Water Office 07AA002 — {discharge:.1f} m³/s → {velocity:.2f} m/s"
    except Exception as exc:
        print(f"[sensor_fetch] Water Office error: {exc}")

    return FALLBACK_VELOCITY_MS, "fallback — EC Water Office unavailable"


def _find_data_start(csv_text: str) -> str:
    """
    Skip the Environment Canada Climate data metadata preamble and return only
    the portion of the CSV that starts at the real header row.

    EC climate CSVs include several lines of station metadata before the actual
    column headers.  This function scans for the first row that contains
    "date/time" or "date time" (case-insensitive) and returns everything from
    that line onward so the CSV parser sees a clean header.
    """
    lines = csv_text.splitlines()
    for i, line in enumerate(lines):
        lower = line.lower().replace('"', "")
        if "date/time" in lower or "date time" in lower:
            return "\n".join(lines[i:])
    # If we can't find the header, return the full text and let the parser try
    return csv_text


def _fetch_rainfall() -> tuple[float, str]:
    """
    Fetch this month's daily precipitation from EC Climate station 2203 (Jasper)
    and return today's (i.e. the last row's) value in mm.

    Requests a daily CSV export for the current month (timeframe=2 = daily data).

    Returns a (rainfall_mm, source_label) tuple.  Falls back to
    FALLBACK_RAINFALL_MM (0.0) if the request fails or returns no usable data.
    """
    now = datetime.now(timezone.utc)
    try:
        r = requests.get(_CLIMATE_URL, params={
            "format": "csv",
            "stationID": "2203",
            "Year":  str(now.year),
            "Month": str(now.month),
            "Day":   "1",         # always request from the 1st; we take the last row
            "timeframe": "2",
            "submit": "Download+Data",
        }, timeout=10)

        if r.status_code == 200:
            # Strip the EC metadata preamble before parsing
            data_text = _find_data_start(r.text)
            rainfall = _last_numeric(data_text, ["precip"])
            if rainfall is not None:
                return rainfall, f"EC Climate station 2203 — {rainfall:.1f} mm"
    except Exception as exc:
        print(f"[sensor_fetch] Climate data error: {exc}")

    return FALLBACK_RAINFALL_MM, "fallback — EC Climate unavailable"


def live_water_velocity() -> tuple[float, str]:
    """
    Return the current Athabasca River surface velocity and its data source.

    Result is cached for 5 minutes so repeated contaminant simulation calls
    within the same window don't make duplicate HTTP requests.

    Returns:
        (water_velocity_ms, source_label)
          water_velocity_ms — float, metres per second (0–5).
          source_label      — human-readable string describing where the value
                              came from (e.g. "EC Water Office 07AA002 — ...").
    """
    return _cached("velocity", _fetch_velocity)


def live_rainfall_mm() -> tuple[float, str]:
    """
    Return today's precipitation total (mm) at the Jasper weather station and
    its data source.

    Result is cached for 5 minutes.

    Returns:
        (rainfall_mm, source_label)
          rainfall_mm  — float, millimetres (0–500 typical).
          source_label — human-readable string describing the data source.
    """
    return _cached("rainfall", _fetch_rainfall)


# ── Terrain slope from SRTM 30m elevation data ────────────────────────────────

# Degree offsets that correspond to ~500 m at Jasper's latitude (~53°N).
# Used to sample elevation at 4 cardinal neighbours for gradient calculation.
# At 53°N: 1° latitude ≈ 111 000 m, 1° longitude ≈ 111 000 * cos(53°) ≈ 66 800 m.
_LAT_OFFSET_DEG = 0.0045   # ≈ 500 m north/south  (111 000 m / degree)
_LON_OFFSET_DEG = 0.0075   # ≈ 500 m east/west at 53°N (cos 53° ≈ 0.60)

# Jasper watershed centre — used as the default when no coordinates are supplied
JASPER_DEFAULT_LAT = 52.8734
JASPER_DEFAULT_LON = -118.0823

# Lookup table mapping known ATH sector IDs to their centre coordinates.
# Used by sector_coords() so callers don't need to pass explicit lat/lon.
_SECTOR_COORDS: dict[str, tuple[float, float]] = {
    "ATH-001":   (52.88, -118.08),
    "ATH-001-A": (52.88, -118.08),
    "ATH-001-B": (52.85, -118.05),
    "ATH-001-W": (52.86, -118.12),
    "ATH-001-H": (52.90, -118.00),
    "ATH-002":   (52.90, -117.95),
    "ATH-002-A": (52.90, -117.95),
    "ATH-002-B": (52.75, -118.10),
}


def _fetch_slope(lat: float, lon: float) -> tuple[float, str]:
    """
    Query SRTM 30m elevation at five points around (lat, lon) and compute
    terrain slope in degrees using a finite-difference gradient.

    Five-point stencil layout (each point ~500 m from centre):
        north: (lat + _LAT_OFFSET_DEG, lon)
        south: (lat - _LAT_OFFSET_DEG, lon)
        east:  (lat, lon + _LON_OFFSET_DEG)
        west:  (lat, lon - _LON_OFFSET_DEG)
        centre: (lat, lon)  — included in the API call for the elevation label

    Slope calculation:
        dE/dx = (east_elev - west_elev) / (2 * dx)   [horizontal gradient]
        dE/dy = (north_elev - south_elev) / (2 * dy) [vertical gradient]
        slope = atan( sqrt( (dE/dx)² + (dE/dy)² ) ) → degrees

    Falls back to 28° (typical Jasper Rocky Mountain slope) if the SRTM
    API is unavailable.

    Args:
        lat — latitude of the point of interest.
        lon — longitude of the point of interest.

    Returns:
        (slope_deg, source_label)
    """
    points = [
        (lat, lon),                          # index 0: centre
        (lat + _LAT_OFFSET_DEG, lon),        # index 1: north
        (lat - _LAT_OFFSET_DEG, lon),        # index 2: south
        (lat, lon + _LON_OFFSET_DEG),        # index 3: east
        (lat, lon - _LON_OFFSET_DEG),        # index 4: west
    ]
    # OpenTopoData accepts locations as "lat,lon|lat,lon|..."
    locations = "|".join(f"{p[0]:.6f},{p[1]:.6f}" for p in points)

    try:
        r = requests.get(_OPEN_TOPO_URL, params={"locations": locations}, timeout=10)
        if r.status_code == 200:
            results = r.json().get("results", [])
            if len(results) == 5:
                elevs = [res.get("elevation") for res in results]
                if all(e is not None for e in elevs):
                    _centre, north, south, east, west = elevs

                    # Convert degree offsets to metres for the gradient calculation.
                    # dy is north-south distance; dx is east-west distance (longitude
                    # spacing shrinks as you move away from the equator, hence cos(lat)).
                    dy = _LAT_OFFSET_DEG * 111_000
                    dx = _LON_OFFSET_DEG * 111_000 * math.cos(math.radians(lat))

                    # Central-difference gradient: more accurate than a one-sided
                    # difference because errors on both sides cancel out.
                    dE_dy = (north - south) / (2 * dy)
                    dE_dx = (east  - west)  / (2 * dx)

                    # atan of the gradient magnitude gives the slope angle
                    slope_rad = math.atan(math.sqrt(dE_dx ** 2 + dE_dy ** 2))
                    slope_deg = round(math.degrees(slope_rad), 2)
                    # Clamp to [0, 89] — a perfectly vertical cliff (90°) would
                    # cause the erosion formula to misbehave.
                    slope_deg = max(0.0, min(slope_deg, 89.0))

                    centre_elev = _centre
                    return (
                        slope_deg,
                        f"SRTM 30m at ({lat:.4f}, {lon:.4f}) "
                        f"elev {centre_elev:.0f} m — slope {slope_deg:.1f}°",
                    )
    except Exception as exc:
        print(f"[sensor_fetch] Open Topo Data error: {exc}")

    # Known Jasper Rocky Mountain terrain: valley floor ~5°, typical slopes ~28°.
    # Using 28° as the fallback errs on the side of higher erosion estimates,
    # which is the safer direction for an environmental monitoring platform.
    fallback = 28.0
    return fallback, f"fallback — SRTM unavailable, using Jasper terrain estimate {fallback}°"


def live_slope_deg(
    lat: float = JASPER_DEFAULT_LAT,
    lon: float = JASPER_DEFAULT_LON,
) -> tuple[float, str]:
    """
    Return terrain slope in degrees for a given coordinate, and its data source.

    Cached for 24 hours — terrain does not change between simulation runs,
    so there is no reason to query the SRTM API more than once per day per point.

    Args:
        lat — latitude (defaults to Jasper watershed centre).
        lon — longitude (defaults to Jasper watershed centre).

    Returns:
        (slope_deg, source_label)
    """
    # Use lat/lon rounded to 4 decimal places as the cache key so nearby
    # coordinates within ~10 m share the same cached value.
    key = f"slope_{lat:.4f}_{lon:.4f}"
    return _cached(key, lambda: _fetch_slope(lat, lon), ttl=_TERRAIN_TTL)


def sector_coords(sector_id: str) -> tuple[float, float]:
    """
    Return the (lat, lon) centre point for a known ATH sector ID.

    If the sector_id is not in the lookup table, returns the Jasper watershed
    default coordinates so the simulation can still run with a sensible value.

    Args:
        sector_id — e.g. "ATH-001" or "ATH-001-A" (case-insensitive).

    Returns:
        (lat, lon) tuple.
    """
    return _SECTOR_COORDS.get(sector_id.upper(), (JASPER_DEFAULT_LAT, JASPER_DEFAULT_LON))
