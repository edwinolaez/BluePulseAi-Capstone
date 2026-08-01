"""
flood_model.py — Flood Elevation Risk Simulation

RUSLE-inspired flood risk calculation for post-fire watersheds.
Post-fire vegetation loss reduces water absorption, so a given storm
produces more runoff and higher flood risk than it would pre-fire.

Formula:
    Flood Risk = sqrt(level_factor * duration_factor)

    where:
    - level_factor    = min(water_level_m / 3.0, 1.0)     # 3m ~ historic Athabasca flood stage
    - duration_factor = min(storm_duration_hr / 72.0, 1.0)  # 72h ~ multi-day storm system
"""

import numpy as np
from typing import Dict, Any


def calculate_flood_risk(water_level_m: float, storm_duration_hr: float) -> Dict[str, Any]:
    """
    Calculate flood risk using a RUSLE-inspired approach, consistent with
    calculate_erosion_risk in erosion_model.py.

    Args:
        water_level_m: River water level above normal stage, in metres (0-3+)
        storm_duration_hr: Storm duration in hours (0-72+)

    Returns:
        {
            "risk_score": float [0, 1],
            "risk_label": str (High/Medium/Low),
            "level_factor": float,
            "duration_factor": float
        }
    """

    # Normalize water level (3m above normal stage ~ historic Athabasca flood event)
    level_factor = min(water_level_m / 3.0, 1.0)

    # Normalize storm duration (72h ~ sustained multi-day storm system)
    duration_factor = min(storm_duration_hr / 72.0, 1.0)

    risk_score = np.sqrt(level_factor * duration_factor)
    risk_score = float(np.clip(risk_score, 0.0, 1.0))

    if risk_score >= 0.7:
        risk_label = "High"
    elif risk_score >= 0.4:
        risk_label = "Medium"
    else:
        risk_label = "Low"

    return {
        "risk_score": risk_score,
        "risk_label": risk_label,
        "level_factor": float(level_factor),
        "duration_factor": float(duration_factor),
    }


if __name__ == "__main__":
    print("Flood Model — Test Cases")
    print("=" * 50)

    test_cases = [
        (0.0, 0, "No rise, no storm"),
        (1.0, 12, "Minor rise, short storm"),
        (1.5, 24, "Moderate rise, 1-day storm"),
        (3.0, 72, "Major rise, multi-day storm"),
    ]

    for level, duration, desc in test_cases:
        result = calculate_flood_risk(level, duration)
        print(f"{desc:30s} → " +
              f"Risk: {result['risk_score']:.3f} ({result['risk_label']})")
