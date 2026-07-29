"""
contaminant_model.py — Hydrocarbon Plume Vector Tracking

This module models how a hydrocarbon contaminant (e.g. a fuel spill after
a wildfire disrupts infrastructure) spreads through the Athabasca watershed.

It answers three key questions:
  1. Which direction is the plume moving and how fast?
       → calculate_contaminant_vector()
  2. How concentrated is the contaminant at a given distance downstream?
       → calculate_contaminant_concentration_at_distance()
  3. Where will the leading edge of the plume be after N hours?
       → predict_plume_trajectory()
  4. What is the total downstream area at risk above the safety threshold?
       → estimate_plume_impact_zone()

The physics is simplified (1D advection-dispersion with exponential decay)
rather than a full hydrodynamic simulation, which is appropriate for the
real-time risk-screening purpose of this platform.

Run this file directly to see example outputs for a few test cases.
"""

import numpy as np
from typing import Dict, Any, Tuple


def calculate_contaminant_vector(flow_direction_deg: float,
                                 water_velocity_ms: float,
                                 contamination_level: float,
                                 dispersal_coefficient: float = 0.1) -> Dict[str, Any]:
    """
    Compute the velocity vector of a contaminant plume moving through the river.

    The plume moves in the same direction as the water but slightly slower
    because heavier contaminants (higher concentration) have more inertia and
    experience more turbulent mixing that slows their net downstream movement.

    The "dispersal_width" represents how wide the plume spreads laterally.
    A higher initial concentration actually produces a narrower plume because
    the dense contaminant resists lateral dilution.

    Args:
        flow_direction_deg    — compass bearing of river flow, 0–360°.
                                0° = north, 90° = east, etc.
        water_velocity_ms     — river surface speed in metres per second (0–5).
                                Comes from live Environment Canada readings.
        contamination_level   — initial hydrocarbon concentration, 0–1.
                                0 = clean water, 1 = maximum contamination.
        dispersal_coefficient — controls lateral spreading rate (0–1).
                                Higher values produce wider plumes.

    Returns:
        Dict with keys:
            direction_deg   — normalised flow bearing (same as input, mod 360).
            velocity        — normalised plume speed 0–1 (1 = 5 m/s river).
            confidence      — how certain we are of the plume direction (0–1).
                              Higher initial concentration = higher confidence
                              because a denser plume is easier to track.
            dispersal_width — estimated lateral plume width in metres (10–100).
    """
    # Normalise direction to [0, 360) so any input bearing is valid
    direction_deg = flow_direction_deg % 360.0

    # Normalise water velocity: typical Athabasca range is 0–5 m/s
    velocity_normalized = min(water_velocity_ms / 5.0, 1.0)

    # Heavier contaminants (higher concentration) move slower than the water
    # because of increased drag and mixing with the bottom sediment.
    # At concentration=0: plume_velocity = 1.0 * velocity (fast)
    # At concentration=1: plume_velocity = 0.7 * velocity (30% slower)
    plume_velocity = velocity_normalized * (0.7 + 0.3 * (1.0 - contamination_level))
    plume_velocity = float(np.clip(plume_velocity, 0.0, 1.0))

    # Higher initial concentration → we're more certain the plume follows the
    # main channel (rather than dispersing unpredictably into side channels)
    confidence = float(np.clip(contamination_level, 0.1, 1.0))

    # Dispersal width: at low concentration the plume is diluted and spreads
    # widely; at high concentration it stays narrow (less lateral mixing).
    # Multiplying by (1 - concentration * dispersal_coefficient) shrinks width
    # as concentration increases.
    dispersal_width = 100.0 * (1.0 - contamination_level * dispersal_coefficient)
    dispersal_width = float(np.clip(dispersal_width, 10.0, 100.0))

    return {
        "direction_deg": float(direction_deg),
        "velocity": plume_velocity,
        "confidence": confidence,
        "dispersal_width": dispersal_width
    }


def calculate_contaminant_concentration_at_distance(
    source_concentration: float,
    distance_km: float,
    dispersion_factor: float = 0.05
) -> float:
    """
    Estimate how concentrated the contaminant will be at a point that is
    `distance_km` kilometres downstream of the spill source.

    Uses an exponential decay model: C(d) = C0 * exp(-d * k)
    where C0 is the initial concentration, d is distance, and k is the
    dispersion factor.  This is a standard approximation for dilution in
    a well-mixed river channel.

    A dispersion_factor of 0.05 means the concentration drops to ~60% after
    10 km and to ~8% after 50 km — reasonable for a mountain river like the
    Athabasca with moderate turbulent mixing.

    Args:
        source_concentration — initial concentration at the spill point (0–1).
        distance_km          — downstream distance to evaluate in kilometres.
        dispersion_factor    — decay rate per km.  Higher = faster dilution.

    Returns:
        Estimated concentration at the specified distance (0–1).
    """
    concentration = source_concentration * np.exp(-distance_km * dispersion_factor)
    return float(np.clip(concentration, 0.0, 1.0))


def predict_plume_trajectory(source_location: Tuple[float, float],
                            flow_direction_deg: float,
                            water_velocity_ms: float,
                            hours: int = 24) -> Dict[str, Any]:
    """
    Predict where the leading edge of the contaminant plume will be after a
    given number of hours, assuming constant flow speed and direction.

    The calculation is a simple straight-line displacement (speed × time)
    projected onto the Earth's surface using a small-angle approximation.
    Earth curvature is ignored because the distances involved (tens of km)
    are small relative to the Earth's radius.

    Coordinate conversion:
        1 degree of latitude  ≈ 111 km (constant everywhere)
        1 degree of longitude ≈ 111 km × cos(latitude) (shrinks toward poles)

    Args:
        source_location   — (latitude, longitude) of the spill origin.
        flow_direction_deg — compass bearing (0° = north, 90° = east).
        water_velocity_ms  — river flow speed in m/s.
        hours              — how far ahead to project (default = 24 hours).

    Returns:
        Dict with keys:
            start        — (lat, lon) of the spill source.
            end          — (lat, lon) of the projected plume front.
            distance_km  — straight-line distance the plume travels.
            direction_deg — flow direction (same as input).
    """
    seconds = hours * 3600
    distance_meters = water_velocity_ms * seconds
    distance_km = distance_meters / 1000.0

    # Convert compass bearing to a math angle (north = 90° in math, not 0°)
    # np.cos(direction_rad) gives the northward component
    # np.sin(direction_rad) gives the eastward component
    direction_rad = np.radians(flow_direction_deg)

    lat_start, lon_start = source_location

    # Project distance_km onto latitude and longitude axes
    dlat = (distance_km / 111.0) * np.cos(direction_rad)
    dlon = (distance_km / (111.0 * np.cos(np.radians(lat_start)))) * np.sin(direction_rad)

    lat_end = lat_start + dlat
    lon_end = lon_start + dlon

    return {
        "start": source_location,
        "end": (lat_end, lon_end),
        "distance_km": float(distance_km),
        "direction_deg": float(flow_direction_deg)
    }


def estimate_plume_impact_zone(
    contamination_level: float,
    water_velocity_ms: float,
    hours_to_critical_threshold: int = 24
) -> Dict[str, Any]:
    """
    Estimate the total downstream area that will be exposed to contaminant
    concentrations above the critical safety threshold.

    The critical threshold is 5% of the initial concentration (i.e. the plume
    is considered safe when it has been diluted by 95%).  We use the exponential
    decay model to find how far downstream this happens, then multiply by the
    plume width to get an affected area.

    This gives environmental response teams a first estimate of which
    municipalities, intake points, or ecologically sensitive areas are at risk.

    Args:
        contamination_level           — initial concentration at source (0–1).
        water_velocity_ms             — flow speed in m/s (affects plume length).
        hours_to_critical_threshold   — time window for the length calculation.

    Returns:
        Dict with keys:
            critical_concentration     — threshold below which water is safe (0.05).
            distance_to_critical_km    — km downstream where concentration falls
                                         below the threshold.
            area_affected_km2          — estimated affected river corridor area.
            plume_width_m              — lateral width of the plume in metres.
    """
    # Safety threshold: 5% of initial concentration
    critical_concentration = 0.05
    dispersion_factor = 0.05  # same decay rate as calculate_contaminant_concentration_at_distance

    if contamination_level <= critical_concentration:
        # Already at or below threshold at the source — no downstream risk
        distance_to_critical_km = 0.0
    else:
        # Solve for d in: critical = source * exp(-d * k)
        # d = -ln(critical / source) / k
        distance_to_critical_km = -np.log(critical_concentration / contamination_level) / dispersion_factor

    # Plume length is how far the water carries the plume during the time window
    plume_length_km = (water_velocity_ms * hours_to_critical_threshold * 3600) / 1000.0

    # Plume width scales with initial concentration: denser plumes are narrower
    # (50 m minimum at near-zero concentration, 250 m maximum at full concentration)
    plume_width_m = 50.0 + 200.0 * contamination_level

    # Area = length × width (converted to km²)
    area_affected_km2 = plume_length_km * (plume_width_m / 1000.0)

    return {
        "critical_concentration": float(critical_concentration),
        "distance_to_critical_km": float(distance_to_critical_km),
        "area_affected_km2": float(area_affected_km2),
        "plume_width_m": float(plume_width_m)
    }


if __name__ == "__main__":
    # Quick smoke test with a few representative scenarios
    print("Contaminant Model — Test Cases")
    print("=" * 50)

    test_vectors = [
        (45, 0.5, 0.3, "Low flow, low contamination"),
        (180, 2.0, 0.7, "Moderate flow, high contamination"),
        (270, 3.5, 0.9, "High flow, very high contamination"),
    ]

    for direction, velocity, contam, desc in test_vectors:
        result = calculate_contaminant_vector(direction, velocity, contam)
        print(f"{desc:35s} → " +
              f"Dir: {result['direction_deg']:.0f}°, " +
              f"Vel: {result['velocity']:.2f}, " +
              f"Conf: {result['confidence']:.2f}")
