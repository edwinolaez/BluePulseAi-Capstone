"""
erosion_model.py — Erosion Risk Simulation

This module estimates how much soil a post-wildfire watershed will lose during
a rain event, and whether that erosion poses a High, Medium, or Low risk.

It is inspired by the RUSLE (Revised Universal Soil Loss Equation), which is
the standard engineering formula for predicting long-term average soil erosion.
The full RUSLE accounts for many factors (rainfall erosivity, soil erodibility,
slope length, cover management, and support practices).  This implementation
simplifies it to the three most impactful factors for post-fire scenarios:
  - Slope (steeper = faster runoff = more erosion)
  - Rainfall (more rain = more erosive energy)
  - Burn severity (bare ground after fire = no vegetation to slow runoff)

The formula used is:
    risk_score = sqrt(slope_factor * rainfall_factor * burn_factor)

The square-root shape means that risk grows quickly at low values of all
three factors but levels off as they approach their maximums — which matches
real-world observations where extremely steep burned slopes don't produce
infinitely more erosion than moderately steep ones.

Run this file directly to see test-case output.
"""

import numpy as np
from typing import Dict, Any


def calculate_erosion_risk(slope_deg: float, rainfall_mm: float,
                          burn_severity: float = 1.0) -> Dict[str, Any]:
    """
    Calculate a sector-level erosion risk score and label.

    Each input is first normalised to a [0, 1] factor:
      - slope_factor    = slope_deg / 90    (90° = vertical, maximum possible)
      - rainfall_factor = rainfall_mm / 100 (100 mm = heavy storm event)
      - burn_factor     = burn_severity      (already 0–1)

    The three factors are then combined as:
        risk_score = sqrt(slope_factor * rainfall_factor * burn_factor)

    Why sqrt instead of a plain product?  A product would be very small when
    any single factor is small (e.g. 0.1 * 0.9 * 0.9 = 0.08), which would
    under-report risk in partially-burned, gently-sloped areas that receive
    heavy rainfall.  The sqrt moderates this, giving more weight to high-
    performing factors.

    Args:
        slope_deg     — terrain slope in degrees (0–90).  Comes from SRTM data
                        via sensor_fetch.live_slope_deg().
        rainfall_mm   — total rainfall in millimetres (0–500).  Comes from
                        Environment Canada or user input.
        burn_severity — fraction of vegetation destroyed by fire (0–1).
                        1.0 = completely bare ground (default for post-fire).
                        0.0 = fully vegetated (pre-fire baseline).

    Returns:
        Dict with keys:
            risk_score     — float [0, 1]; higher = more erosion risk.
            risk_label     — "High" (>= 0.7), "Medium" (>= 0.4), "Low".
            slope_factor   — normalised slope input used in the calculation.
            rainfall_factor — normalised rainfall input.
            burn_factor    — burn severity (passed through as-is).
    """
    # Clamp slope to [0, 90] and normalise.  A 45° slope is quite steep for
    # a river valley; 90° would be a cliff (rare in the Athabasca watershed).
    slope_factor = min(slope_deg / 90.0, 1.0)

    # Normalise rainfall.  100 mm per event is a heavy storm in the Rockies;
    # values above 100 mm are treated as equally severe (factor = 1.0).
    rainfall_factor = min(rainfall_mm / 100.0, 1.0)

    # Burn severity is already in [0, 1] — use it directly
    burn_factor = burn_severity

    # RUSLE-inspired composite risk score.
    # All three factors must be non-zero for significant erosion — this
    # matches reality: a steep slope with no rain or no burn produces little
    # erosion.  sqrt prevents the product from being overly pessimistic
    # when two factors are high but one is low.
    risk_score = np.sqrt(slope_factor * rainfall_factor * burn_factor)
    risk_score = float(np.clip(risk_score, 0.0, 1.0))

    # Thresholds chosen to align with the dashboard's traffic-light colour scheme
    if risk_score >= 0.7:
        risk_label = "High"
    elif risk_score >= 0.4:
        risk_label = "Medium"
    else:
        risk_label = "Low"

    return {
        "risk_score": risk_score,
        "risk_label": risk_label,
        "slope_factor": float(slope_factor),
        "rainfall_factor": float(rainfall_factor),
        "burn_factor": float(burn_factor)
    }


def estimate_sediment_load(flow_rate_cms: float, slope_deg: float) -> float:
    """
    Estimate the suspended sediment load a stream carries per day, in cubic
    metres.

    Uses an empirical relationship: steeper channel gradient + higher flow rate
    = more sediment transported.  The slope term is converted to a dimensionless
    coefficient using the tangent (tan(slope_rad)), which is the ratio of
    vertical drop to horizontal distance — a direct measure of the stream's
    erosive energy per unit length.

    The +0.1 offset prevents the coefficient from reaching zero on flat terrain,
    because even very shallow streams carry some suspended material.

    Args:
        flow_rate_cms — stream discharge in cubic metres per second.
        slope_deg     — channel gradient in degrees.

    Returns:
        Estimated sediment load in cubic metres per day.
    """
    slope_rad = np.radians(slope_deg)
    # tan(slope) = rise / run — proportional to stream power per unit length
    sediment_coeff = np.tan(slope_rad) + 0.1  # +0.1 avoids zero on flat terrain
    # Multiply by 86400 (seconds per day) to convert from m³/s to m³/day
    sediment_load = flow_rate_cms * sediment_coeff * 86400

    return float(sediment_load)


def calculate_erosion_zones(dem_array: np.ndarray, rainfall_mm: float) -> np.ndarray:
    """
    Produce a pixel-wise erosion risk map from a Digital Elevation Model (DEM)
    raster and a uniform rainfall amount.

    This function applies the same RUSLE-inspired formula as calculate_erosion_risk()
    to every pixel in the DEM, returning a full raster map where each value is the
    erosion risk at that location.

    It is intended for raster-based analysis (e.g. overlaying on the 3D map) rather
    than the per-sector API endpoint.  Burn severity is not included here because
    this function is designed for DEM-only analysis where burn data may not be
    available at the same resolution.

    Args:
        dem_array   — 2D NumPy array of elevation values (height, width).
                      Units can be metres or feet — only the relative gradient
                      (slope) matters for the calculation.
        rainfall_mm — rainfall intensity applied uniformly across the DEM.

    Returns:
        Erosion risk raster (height, width) with float values in [0, 1].
        Higher values indicate higher erosion risk.
    """
    # np.gradient computes finite-difference derivatives in y (rows) and x (cols)
    gy, gx = np.gradient(dem_array)
    # Combine x and y gradients into a slope magnitude, then convert to degrees
    slope_rad = np.arctan(np.sqrt(gx**2 + gy**2))
    slope_deg = np.degrees(slope_rad)

    # Normalise slope to [0, 1] pixel-by-pixel
    slope_normalized = np.clip(slope_deg, 0, 90) / 90.0

    # Single rainfall factor applied uniformly across the entire scene
    rainfall_factor = min(rainfall_mm / 100.0, 1.0)

    # sqrt combines slope and rainfall the same way as the scalar function above
    erosion_risk = np.sqrt(slope_normalized * rainfall_factor)
    erosion_risk = np.clip(erosion_risk, 0.0, 1.0)

    return erosion_risk


if __name__ == "__main__":
    # Quick smoke test across a range of slope and rainfall conditions
    print("Erosion Model — Test Cases")
    print("=" * 50)

    test_cases = [
        (0, 0, "Flat terrain, no rain"),
        (30, 50, "Gentle slope, moderate rain"),
        (60, 100, "Steep slope, heavy rain"),
        (90, 200, "Very steep, very heavy rain"),
    ]

    for slope, rainfall, desc in test_cases:
        result = calculate_erosion_risk(slope, rainfall)
        print(f"{desc:30s} → " +
              f"Risk: {result['risk_score']:.3f} ({result['risk_label']})")
