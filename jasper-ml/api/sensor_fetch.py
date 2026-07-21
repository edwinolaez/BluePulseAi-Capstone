"""
sensor_fetch.py — Live sensor values from Environment Canada open data
                  and SRTM terrain elevation.

Fetches real discharge, precipitation, and terrain slope from public APIs
and converts them to the units the ML simulation models expect.

Results are cached so repeated simulation calls don't hammer external APIs:
  - discharge / rainfall: 5-minute TTL (readings update hourly)
  - slope:               24-hour TTL  (terrain is static)
"""
import csv
import io
import math
import time
import requests
from datetime import datetime, timezone

_WATEROFFICE_URL = "https://wateroffice.ec.gc.ca/services/real_time_data/csv/inline"
_CLIMATE_URL     = "https://climate.weather.gc.ca/climate_data/bulk_data_e.html"
_OPEN_TOPO_URL   = "https://api.opentopodata.org/v1/srtm30m"

# Athabasca River at station 07AA002 cross-section estimate (~50 m wide, ~1 m deep)
# Used to convert bulk discharge (m³/s) → surface velocity (m/s)
_CROSS_SECTION_M2 = 50.0

# Fallbacks used when Environment Canada APIs are unavailable
FALLBACK_VELOCITY_MS = 1.5   # median Athabasca summer flow
FALLBACK_RAINFALL_MM = 0.0   # dry-day default

_CACHE: dict = {}
_SENSOR_TTL = 300    # 5 min — EC readings update hourly, no need to be faster
_TERRAIN_TTL = 86400 # 24 h  — terrain slope doesn't change


def _cached(key: str, fetch_fn, ttl: int = _SENSOR_TTL):
    now = time.monotonic()
    if key in _CACHE and now - _CACHE[key]["ts"] < ttl:
        return _CACHE[key]["val"]
    val = fetch_fn()
    _CACHE[key] = {"val": val, "ts": now}
    return val


def _last_numeric(csv_text: str, col_hints: list[str]) -> float | None:
    """
    Scan a CSV string and return the most-recent non-null value from any
    column whose name contains one of the hint substrings (case-insensitive).
    Falls back to the third column if no named match is found.
    """
    lines = [l for l in csv_text.splitlines()
             if l.strip() and not l.lstrip().startswith("#")]
    if len(lines) < 2:
        return None

    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    target_col: str | None = None
    last_val: float | None = None

    for row in reader:
        if target_col is None:
            for hint in col_hints:
                match = next((c for c in row if hint.lower() in c.lower()), None)
                if match:
                    target_col = match
                    break
            if target_col is None:
                cols = list(row.keys())
                if len(cols) >= 3:
                    target_col = cols[2]  # Date, Level, Discharge positional fallback

        if target_col:
            raw = row.get(target_col, "").strip().strip('"')
            if raw and raw not in ("M", "T", ""):  # M=missing, T=trace in EC data
                try:
                    v = float(raw.replace(",", ""))
                    if v >= 0:
                        last_val = v
                except ValueError:
                    pass

    return last_val


def _fetch_velocity() -> tuple[float, str]:
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
            "parameters[]": [47, 46],
        }, timeout=10)

        if r.status_code == 200:
            discharge = _last_numeric(r.text, ["discharge", "flow", "46"])
            if discharge is not None:
                velocity = round(min(discharge / _CROSS_SECTION_M2, 5.0), 3)
                return velocity, f"EC Water Office 07AA002 — {discharge:.1f} m³/s → {velocity:.2f} m/s"
    except Exception as exc:
        print(f"[sensor_fetch] Water Office error: {exc}")

    return FALLBACK_VELOCITY_MS, "fallback — EC Water Office unavailable"


def _find_data_start(csv_text: str) -> str:
    """Skip Environment Canada metadata preamble rows, return data-only text."""
    lines = csv_text.splitlines()
    for i, line in enumerate(lines):
        lower = line.lower().replace('"', "")
        if "date/time" in lower or "date time" in lower:
            return "\n".join(lines[i:])
    return csv_text


def _fetch_rainfall() -> tuple[float, str]:
    now = datetime.now(timezone.utc)
    try:
        r = requests.get(_CLIMATE_URL, params={
            "format": "csv",
            "stationID": "2203",
            "Year":  str(now.year),
            "Month": str(now.month),
            "Day":   "1",
            "timeframe": "2",
            "submit": "Download+Data",
        }, timeout=10)

        if r.status_code == 200:
            data_text = _find_data_start(r.text)
            rainfall = _last_numeric(data_text, ["precip"])
            if rainfall is not None:
                return rainfall, f"EC Climate station 2203 — {rainfall:.1f} mm"
    except Exception as exc:
        print(f"[sensor_fetch] Climate data error: {exc}")

    return FALLBACK_RAINFALL_MM, "fallback — EC Climate unavailable"


def live_water_velocity() -> tuple[float, str]:
    """
    Return (water_velocity_ms, source_label) for the Athabasca River at Jasper.
    Cached for 5 minutes to avoid repeated external calls.
    """
    return _cached("velocity", _fetch_velocity)


def live_rainfall_mm() -> tuple[float, str]:
    """
    Return (rainfall_mm, source_label) from the Jasper weather station.
    Cached for 5 minutes to avoid repeated external calls.
    """
    return _cached("rainfall", _fetch_rainfall)


# ── Terrain slope from SRTM 30m elevation data ────────────────────────────────

# Degree offsets that correspond to ~500 m at Jasper's latitude (~53°N).
# Used to sample elevation at 4 cardinal neighbours for gradient calculation.
_LAT_OFFSET_DEG = 0.0045   # ≈ 500 m (111 000 m / degree)
_LON_OFFSET_DEG = 0.0075   # ≈ 500 m at 53°N (cos 53° ≈ 0.60)

# Jasper watershed centre — default when no coordinates are supplied
JASPER_DEFAULT_LAT = 52.8734
JASPER_DEFAULT_LON = -118.0823

# Known ATH sector centres (Athabasca watershed grid)
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
    Query SRTM 30m elevation at five points around (lat, lon) and calculate
    terrain slope using the finite-difference gradient method.

    Five-point stencil:
        (lat+Δ, lon)  ← north
        (lat-Δ, lon)  ← south
        (lat, lon+Δ)  ← east
        (lat, lon-Δ)  ← west
        (lat, lon)    ← centre (used only in logging)

    slope = atan( sqrt( (dE/dx)² + (dE/dy)² ) ) converted to degrees
    """
    points = [
        (lat, lon),
        (lat + _LAT_OFFSET_DEG, lon),
        (lat - _LAT_OFFSET_DEG, lon),
        (lat, lon + _LON_OFFSET_DEG),
        (lat, lon - _LON_OFFSET_DEG),
    ]
    locations = "|".join(f"{p[0]:.6f},{p[1]:.6f}" for p in points)

    try:
        r = requests.get(_OPEN_TOPO_URL, params={"locations": locations}, timeout=10)
        if r.status_code == 200:
            results = r.json().get("results", [])
            if len(results) == 5:
                elevs = [res.get("elevation") for res in results]
                if all(e is not None for e in elevs):
                    _centre, north, south, east, west = elevs

                    # Horizontal distances in metres
                    dy = _LAT_OFFSET_DEG * 111_000
                    dx = _LON_OFFSET_DEG * 111_000 * math.cos(math.radians(lat))

                    dE_dy = (north - south) / (2 * dy)
                    dE_dx = (east  - west)  / (2 * dx)

                    slope_rad = math.atan(math.sqrt(dE_dx ** 2 + dE_dy ** 2))
                    slope_deg = round(math.degrees(slope_rad), 2)
                    slope_deg = max(0.0, min(slope_deg, 89.0))

                    centre_elev = _centre
                    return (
                        slope_deg,
                        f"SRTM 30m at ({lat:.4f}, {lon:.4f}) "
                        f"elev {centre_elev:.0f} m — slope {slope_deg:.1f}°",
                    )
    except Exception as exc:
        print(f"[sensor_fetch] Open Topo Data error: {exc}")

    # Known Jasper Rocky Mountain terrain: valley floor ~5°, typical slopes ~28°
    fallback = 28.0
    return fallback, f"fallback — SRTM unavailable, using Jasper terrain estimate {fallback}°"


def live_slope_deg(
    lat: float = JASPER_DEFAULT_LAT,
    lon: float = JASPER_DEFAULT_LON,
) -> tuple[float, str]:
    """
    Return (slope_deg, source_label) for a given coordinate.
    Cached for 24 hours — terrain doesn't change between simulation runs.
    """
    key = f"slope_{lat:.4f}_{lon:.4f}"
    return _cached(key, lambda: _fetch_slope(lat, lon), ttl=_TERRAIN_TTL)


def sector_coords(sector_id: str) -> tuple[float, float]:
    """
    Return (lat, lon) for a known ATH sector, or the Jasper default.
    Normalises the sector_id to handle both 'ATH-001' and 'ATH-001-A' forms.
    """
    return _SECTOR_COORDS.get(sector_id.upper(), (JASPER_DEFAULT_LAT, JASPER_DEFAULT_LON))
