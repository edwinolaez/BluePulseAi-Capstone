"""
contaminant_model.py — Hydrocarbon Plume Vector Tracking

Tracks contaminant movement through watersheds using water flow direction
and contamination concentration levels.
"""

import numpy as np
from typing import Dict, Any, Tuple


def calculate_contaminant_vector(flow_direction_deg: float, 
                                 water_velocity_ms: float,
                                 contamination_level: float,
                                 dispersal_coefficient: float = 0.1) -> Dict[str, Any]:
    """
    Calculate contaminant plume movement vector.
    
    Args:
        flow_direction_deg: Direction of water flow (0-360 degrees)
        water_velocity_ms: Water flow velocity (0-5 m/s)
        contamination_level: Hydrocarbon concentration (0-1)
        dispersal_coefficient: Lateral dispersion factor (0-1)
    
    Returns:
        {
            "direction_deg": float [0, 360),
            "velocity": float [0, 1] normalized,
            "confidence": float [0, 1],
            "dispersal_width": float (meters)
        }
    """
    
    # Normalize flow direction
    direction_deg = flow_direction_deg % 360.0
    
    # Normalize water velocity to [0, 1] scale (typical rivers: 0-5 m/s)
    velocity_normalized = min(water_velocity_ms / 5.0, 1.0)
    
    # Plume velocity influenced by water velocity and contamination concentration
    # Heavier contaminants (higher concentration) move slower
    plume_velocity = velocity_normalized * (0.7 + 0.3 * (1.0 - contamination_level))
    plume_velocity = float(np.clip(plume_velocity, 0.0, 1.0))
    
    # Confidence: higher concentration = more certain direction
    confidence = float(np.clip(contamination_level, 0.1, 1.0))
    
    # Dispersal width: higher contamination = narrower plume (less dilution)
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
    Estimate contaminant concentration at a downstream distance.
    
    Uses exponential decay model: C = C0 * exp(-distance * dispersion_factor)
    
    Args:
        source_concentration: Initial concentration level (0-1)
        distance_km: Distance from source in kilometers
        dispersion_factor: Dispersion rate (higher = faster decay)
    
    Returns:
        Estimated concentration (0-1)
    """
    concentration = source_concentration * np.exp(-distance_km * dispersion_factor)
    return float(np.clip(concentration, 0.0, 1.0))


def predict_plume_trajectory(source_location: Tuple[float, float],
                            flow_direction_deg: float,
                            water_velocity_ms: float,
                            hours: int = 24) -> Dict[str, Any]:
    """
    Predict contaminant plume location after given time period.
    
    Args:
        source_location: (latitude, longitude) of spill source
        flow_direction_deg: Direction of water flow (0-360°)
        water_velocity_ms: Flow velocity in m/s
        hours: Time period to predict (hours)
    
    Returns:
        {
            "start": (lat, lon),
            "end": (lat, lon),
            "distance_km": float,
            "direction": float
        }
    """
    
    # Calculate distance traveled
    seconds = hours * 3600
    distance_meters = water_velocity_ms * seconds
    distance_km = distance_meters / 1000.0
    
    # Convert direction to radians
    direction_rad = np.radians(flow_direction_deg)
    
    # Simple calculation (ignores Earth curvature for short distances)
    # 1 degree latitude ≈ 111 km
    # 1 degree longitude ≈ 111 km * cos(latitude) at equator
    lat_start, lon_start = source_location
    
    # Add displacement (simplified)
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
    Estimate downstream area affected by contamination at critical level.
    
    Args:
        contamination_level: Initial concentration (0-1)
        water_velocity_ms: Flow velocity (m/s)
        hours_to_critical_threshold: Time until concentration drops to critical level
    
    Returns:
        {
            "critical_concentration": float,
            "distance_to_critical_km": float,
            "area_affected_km2": float,
            "plume_width_m": float
        }
    """
    
    # Define critical threshold (when plume is considered safe)
    critical_concentration = 0.05
    
    # Use exponential decay to find distance to critical level
    # concentration = source * exp(-distance * factor)
    # Solve for distance when concentration = critical_threshold
    dispersion_factor = 0.05
    
    if contamination_level <= critical_concentration:
        distance_to_critical_km = 0.0
    else:
        # distance = -ln(critical / source) / dispersion_factor
        distance_to_critical_km = -np.log(critical_concentration / contamination_level) / dispersion_factor
    
    # Calculate plume dimensions
    plume_length_km = (water_velocity_ms * hours_to_critical_threshold * 3600) / 1000.0
    plume_width_m = 50.0 + 200.0 * contamination_level  # 50-250m width
    
    area_affected_km2 = plume_length_km * (plume_width_m / 1000.0)
    
    return {
        "critical_concentration": float(critical_concentration),
        "distance_to_critical_km": float(distance_to_critical_km),
        "area_affected_km2": float(area_affected_km2),
        "plume_width_m": float(plume_width_m)
    }


if __name__ == "__main__":
    # Example usage
    print("Contaminant Model — Test Cases")
    print("=" * 50)
    
    # Test plume vectors
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
