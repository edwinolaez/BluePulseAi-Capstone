"""
erosion_model.py — Erosion Risk Simulation

RUSLE-inspired erosion risk calculation for post-fire watersheds.

Formula:
    Erosion Risk = sqrt(slope_factor * rainfall_factor)
    
    where:
    - slope_factor = min(slope_deg / 90, 1.0)
    - rainfall_factor = min(rainfall_mm / 100, 1.0)
"""

import numpy as np
from typing import Dict, Any


def calculate_erosion_risk(slope_deg: float, rainfall_mm: float, 
                          burn_severity: float = 1.0) -> Dict[str, Any]:
    """
    Calculate erosion risk using RUSLE-inspired approach.
    
    Args:
        slope_deg: Terrain slope in degrees (0-90)
        rainfall_mm: Rainfall intensity in mm (0-500)
        burn_severity: Post-fire vegetation loss factor (0-1, 1=severe burn)
    
    Returns:
        {
            "risk_score": float [0, 1],
            "risk_label": str (High/Medium/Low),
            "slope_factor": float,
            "rainfall_factor": float,
            "burn_factor": float
        }
    """
    
    # Normalize slope (max slope ~45° for rivers)
    slope_factor = min(slope_deg / 90.0, 1.0)
    
    # Normalize rainfall (typical range 0-100mm for storm events)
    rainfall_factor = min(rainfall_mm / 100.0, 1.0)
    
    # Burn severity: post-fire vegetation loss increases erosion
    burn_factor = burn_severity
    
    # RUSLE-inspired composite: slope + rainfall + burn effects
    # Higher slope = more runoff
    # Higher rainfall = more water energy
    # Higher burn severity = less vegetation to resist erosion
    risk_score = np.sqrt(slope_factor * rainfall_factor * burn_factor)
    risk_score = float(np.clip(risk_score, 0.0, 1.0))
    
    # Classify into risk labels
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
    Estimate suspended sediment load in cubic meters per day.
    
    Args:
        flow_rate_cms: Stream flow rate in cubic meters per second
        slope_deg: Channel gradient in degrees
    
    Returns:
        Estimated sediment load (m³/day)
    """
    # Empirical relationship: higher slope + higher flow = more sediment
    slope_rad = np.radians(slope_deg)
    sediment_coeff = np.tan(slope_rad) + 0.1  # Avoid division by zero
    sediment_load = flow_rate_cms * sediment_coeff * 86400  # seconds/day
    
    return float(sediment_load)


def calculate_erosion_zones(dem_array: np.ndarray, rainfall_mm: float) -> np.ndarray:
    """
    Calculate pixel-wise erosion risk for a DEM (Digital Elevation Model).
    
    Args:
        dem_array: DEM raster array (height, width)
        rainfall_mm: Rainfall intensity
    
    Returns:
        Erosion risk map (height, width) with values [0, 1]
    """
    
    # Calculate slope from DEM (simplified: gradient magnitude)
    gy, gx = np.gradient(dem_array)
    slope_rad = np.arctan(np.sqrt(gx**2 + gy**2))
    slope_deg = np.degrees(slope_rad)
    
    # Normalize slope to [0, 90]
    slope_normalized = np.clip(slope_deg, 0, 90) / 90.0
    
    # Rainfall factor
    rainfall_factor = min(rainfall_mm / 100.0, 1.0)
    
    # Calculate erosion risk per pixel
    erosion_risk = np.sqrt(slope_normalized * rainfall_factor)
    erosion_risk = np.clip(erosion_risk, 0.0, 1.0)
    
    return erosion_risk


if __name__ == "__main__":
    # Example usage
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
