# ML Output Schema — Project Jasper
**Author:** Richard (AI/ML Specialist)  
**Date:** June 26, 2026  
**Status:** Finalized for Sprint 1

## Overview

This document defines the standardized JSON schema for all ML model outputs in Project Jasper. All three simulation types (change detection, erosion, contaminant) produce outputs following this unified structure.

**Consumers:**
- **Rahil (DB Team)**: Stores outputs in PostGIS with sector_id as primary key
- **Reyta (Frontend)**: Displays risk_score and contaminant_vector on map overlays
- **Edwin (QA)**: Validates schema compliance in CI/CD pipeline

---

## JSON Schema

```json
{
  "sector_id": "string",
  "model_version": "string",
  "simulation_type": "string",
  "risk_score": 0.0,
  "risk_label": "string",
  "contaminant_vector": {
    "direction_deg": 0.0,
    "velocity": 0.0
  },
  "timestamp": "string",
  "confidence": 0.0
}
```

---

## Field Definitions

| Field | Type | Range | Description | Consumer |
|-------|------|-------|-------------|----------|
| **sector_id** | string | any | Grid cell identifier from Feven's ingest pipeline | Rahil |
| **model_version** | string | e.g., "v1.0" | Model version identifier | Rahil, Edwin |
| **simulation_type** | enum | `change_detection` &#124; `erosion` &#124; `contaminant` | Type of simulation run | Rahil, Reyta, Edwin |
| **risk_score** | float | [0.0, 1.0] | Normalized risk score. **Must not be NaN.** | Reyta (map display) |
| **risk_label** | string | `High` &#124; `Medium` &#124; `Low` | Human-readable risk classification | Reyta (map legend) |
| **contaminant_vector.direction_deg** | float | [0.0, 360.0) | Direction of plume movement in degrees | Reyta (vector arrows) |
| **contaminant_vector.velocity** | float | [0.0, 1.0] | Normalized velocity magnitude | Reyta (arrow length) |
| **timestamp** | string | ISO 8601 | UTC timestamp when prediction was made | Rahil (audit log) |
| **confidence** | float | [0.0, 1.0] | Model confidence in prediction | Edwin (testing), Reyta (optional opacity) |

---

## Risk Label Rules

| Condition | Label | Use Case |
|-----------|-------|----------|
| `risk_score >= 0.7` | `High` | Active burn scar / active erosion / high contamination |
| `0.4 <= risk_score < 0.7` | `Medium` | Moderate concern zones |
| `risk_score < 0.4` | `Low` | Background / safe zones |

---

## Timestamp Format

All timestamps **must** be ISO 8601 format with UTC timezone:

```
2026-06-26T14:30:00Z
2026-06-26T14:30:00+00:00
```

**Not acceptable:**
```
2026-06-26 14:30:00  ❌ (missing timezone)
06/26/2026 14:30:00  ❌ (not ISO 8601)
```

---

## Contaminant Vector Rules

The `contaminant_vector` object **must always be present**, even for non-contaminant simulations:

### For Contaminant Simulation:
```json
{
  "direction_deg": 270.0,
  "velocity": 0.65
}
```
- `direction_deg`: Actual water flow direction
- `velocity`: Plume movement speed

### For Non-Contaminant Simulations (Change Detection, Erosion):
```json
{
  "direction_deg": 0.0,
  "velocity": 0.0
}
```
- Both fields set to 0.0 (placeholder)
- Ensures schema consistency for all output types

---

## Validation Rules (Enforced by Edwin's CI)

```python
# All of the following must be true:
assert 0.0 <= risk_score <= 1.0            # No out-of-range values
assert not np.isnan(risk_score)            # No NaN values
assert risk_label in ["High", "Medium", "Low"]  # Valid label
assert 0.0 <= direction_deg < 360.0        # Degrees in valid range
assert 0.0 <= velocity <= 1.0              # Velocity normalized
assert 0.0 <= confidence <= 1.0            # Confidence valid
# Timestamp parses as ISO 8601
```

---

## Example Outputs

### Change Detection
```json
{
  "sector_id": "ATH-001-A",
  "model_version": "v1.0",
  "simulation_type": "change_detection",
  "risk_score": 0.85,
  "risk_label": "High",
  "contaminant_vector": {
    "direction_deg": 0.0,
    "velocity": 0.0
  },
  "timestamp": "2026-06-26T14:30:00Z",
  "confidence": 0.92
}
```

### Erosion Risk
```json
{
  "sector_id": "ATH-001-B",
  "model_version": "v1.0",
  "simulation_type": "erosion",
  "risk_score": 0.65,
  "risk_label": "Medium",
  "contaminant_vector": {
    "direction_deg": 0.0,
    "velocity": 0.0
  },
  "timestamp": "2026-06-26T14:32:00Z",
  "confidence": 0.78
}
```

### Contaminant Tracking
```json
{
  "sector_id": "ATH-001-C",
  "model_version": "v1.0",
  "simulation_type": "contaminant",
  "risk_score": 0.72,
  "risk_label": "Medium",
  "contaminant_vector": {
    "direction_deg": 180.0,
    "velocity": 0.45
  },
  "timestamp": "2026-06-26T14:34:00Z",
  "confidence": 0.85
}
```

---

## Integration Points

**Feven (Data Pipeline)** → Provides sector_id, imagery  
**Richard (ML Models)** → Produces outputs following this schema  
**Rahil (Database)** → Stores in PostGIS with JSON type  
**Reyta (Frontend)** → Queries Convex, displays on map  
**Edwin (QA)** → Validates schema in CI pipeline  

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-06-26 | Initial schema definition, Sprint 1 |
