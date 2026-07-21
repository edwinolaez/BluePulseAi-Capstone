"""
sensor_fetch.py — Live sensor values from Environment Canada open data.

Fetches real discharge and precipitation from the same public APIs that the
backend ingest pipeline uses, and converts them to the units the ML simulation
models expect.

Results are cached for 5 minutes so repeated simulation calls (e.g., from a
chatbot triggering 10 runs) don't hammer the Environment Canada endpoints.
"""
import csv
import io
import time
import requests
from datetime import datetime, timezone

_WATEROFFICE_URL = "https://wateroffice.ec.gc.ca/services/real_time_data/csv/inline"
_CLIMATE_URL     = "https://climate.weather.gc.ca/climate_data/bulk_data_e.html"

# Athabasca River at station 07AA002 cross-section estimate (~50 m wide, ~1 m deep)
# Used to convert bulk discharge (m³/s) → surface velocity (m/s)
_CROSS_SECTION_M2 = 50.0

# Fallbacks used when Environment Canada APIs are unavailable
FALLBACK_VELOCITY_MS = 1.5   # median Athabasca summer flow
FALLBACK_RAINFALL_MM = 0.0   # dry-day default

_CACHE: dict = {}
_CACHE_TTL = 300  # 5 minutes


def _cached(key: str, fetch_fn):
    now = time.monotonic()
    if key in _CACHE and now - _CACHE[key]["ts"] < _CACHE_TTL:
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
