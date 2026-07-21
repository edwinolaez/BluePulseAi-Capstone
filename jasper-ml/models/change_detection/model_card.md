# Model Card: Change Detection v1.0

**Project:** Project Jasper — Post-Wildfire Environmental Monitoring  
**Author:** Richard (AI/ML Specialist)  
**Date:** June 26, 2026  
**Status:** Baseline model (Sprint 2)

---

## Model Overview

**Name:** Post-Fire Burn Scar Detection (Random Forest)  
**Task:** Binary/Multi-class change detection on pre/post-fire satellite imagery  
**Framework:** scikit-learn RandomForestClassifier  
**Deployment:** Athabasca watershed, real-time inference

---

## Model Objective

Detect post-wildfire burn scars in satellite imagery by analyzing spectral changes between pre-fire and post-fire images. The model classifies each pixel or image patch into one of three categories:

- **No Change** (0): Natural background
- **Medium Change** (1): Partial burn/vegetation loss
- **High Change** (2): Active burn scar

---

## Model Performance

### Baseline Metrics (Sprint 1 Spike)

| Metric                  | Value | Target |
| ----------------------- | ----- | ------ |
| **F1 Score (macro)**    | 0.80  | ≥ 0.75 |
| **F1 Score (weighted)** | 0.82  | ≥ 0.75 |
| **Precision (macro)**   | 0.81  | ≥ 0.75 |
| **Recall (macro)**      | 0.79  | ≥ 0.75 |
| **Accuracy**            | 0.81  | —      |

### Per-Class Performance

| Class             | Precision | Recall | F1   | Support |
| ----------------- | --------- | ------ | ---- | ------- |
| No Change (0)     | 0.85      | 0.88   | 0.86 | 1024    |
| Medium Change (1) | 0.78      | 0.75   | 0.76 | 512     |
| High Change (2)   | 0.80      | 0.74   | 0.77 | 256     |

---

## Data

### Training Dataset

| Attribute             | Value                                         |
| --------------------- | --------------------------------------------- |
| **Source**            | Synthetic + Athabasca test imagery (Sprint 1) |
| **Imagery Type**      | 4-band satellite (RGB + NIR)                  |
| **Resolution**        | 30-50m/pixel (Landsat-equivalent)             |
| **Temporal Coverage** | Pre/post-fire pairs, 2024-2026                |
| **Samples**           | 256×256 patches, 1,792 training samples       |
| **Train/Test Split**  | 80/20 (stratified)                            |

### Data Preprocessing

1. **Normalization**: Pixel values scaled to [0, 1]
2. **Band Stacking**: Pre-fire RGB+NIR + Post-fire RGB+NIR = 8-channel feature vector
3. **Feature Engineering**:
   - NDVI difference (pre vs. post)
   - Spectral angle mapper
   - Mean spectral change

---

## Model Architecture

### Model Type

Random Forest Classifier (ensemble of 100 decision trees)

### Hyperparameters

```python
RandomForestClassifier(
    n_estimators=100,
    max_depth=15,
    min_samples_split=10,
    random_state=42,
    n_jobs=-1  # parallel processing
)
```

### Training Details

- **Optimization**: Gini impurity
- **Training Time**: ~2.5 seconds (on CPU)
- **Feature Importance**: NDVI difference > spectral angle > mean change

---

## Intended Use

**Appropriate Uses:**

- Real-time burn scar detection for emergency response
- Post-fire environmental assessment
- Erosion risk prediction (downstream)
- CERCUTS/SAIT Faculty demonstration (demo day)

**Limitations:**

- Performance on cloud-obscured imagery: Unknown
- Performance on non-Landsat imagery: Not tested
- Seasonal variations: Not quantified
- Snow/ice interference: Not handled

---

## Model Inputs and Outputs

### Inputs

- **Pre-fire Image**: 4-band GeoTIFF, 256×256 pixels
- **Post-fire Image**: 4-band GeoTIFF, 256×256 pixels, same extent

### Outputs

Follows [ML_OUTPUT_SCHEMA.md](../ML_OUTPUT_SCHEMA.md):

```json
{
  "sector_id": "ATH-001-A",
  "model_version": "v1.0",
  "simulation_type": "change_detection",
  "risk_score": 0.85,
  "risk_label": "High",
  "contaminant_vector": { "direction_deg": 0.0, "velocity": 0.0 },
  "timestamp": "2026-06-26T14:30:00Z",
  "confidence": 0.92
}
```

---

## Bias and Fairness

**Potential Biases:**

- Training data limited to Athabasca region (may not generalize to other watersheds)
- Seasonal imagery bias (mostly summer data)
- Sensor bias (Landsat 8/9 spectral characteristics)

**Mitigation:**

- Multi-region data planned for Sprint 3+
- Stratified validation across seasons
- Cross-sensor evaluation (Sentinel-2, etc.)

---

## Safety and Security

- ✅ No hardcoded secrets
- ✅ No eval() or exec() calls
- ✅ Input validation on sector_id and image dimensions
- ✅ Output range checking (risk_score ∈ [0, 1])
- ✅ Comprehensive error handling

---

## Maintenance and Monitoring

### Performance Monitoring

- F1 score tracked weekly against baseline (0.80 threshold)
- Confusion matrix reviewed monthly
- Outlier predictions logged for inspection

### Model Updates

**Sprint 2 (June 23–July 4):**

- [ ] Retrain on real satellite imagery from Feven's ingest pipeline
- [ ] Document final F1 score in this card
- [ ] Update hyperparameters if needed
- [ ] Validate on holdout test set
- [ ] Tag Edwin for review before M2 milestone

---

## Sprint 2 Retraining Instructions

**Purpose:** Train model v1 on real Landsat imagery for production use

**Deadline:** July 4, 2026 (M2 milestone)

### 1. Prepare Data

```bash
cd /Users/Richard/Downloads/Capstone/Project\ Jasper/BluePulseAi-Capstone/jasper-ml

# Coordinate with Feven to download real pre/post-fire imagery:
# Athabasca watershed sectors: ATH-001-A, ATH-001-B, ATH-002-A, ATH-002-B
# Expected format: {sector_id}_pre.tif, {sector_id}_post.tif
# Resolution: 30m/pixel (Landsat-standard)
# Bands: RGB + NIR (4-band GeoTIFF)

mkdir -p data/
# Place downloaded imagery in data/ directory
```

### 2. Activate Environment and Install Dependencies

```bash
source ml-env/bin/activate
pip install -r requirements.txt
```

### 3. Train Model

```bash
# Train with default hyperparameters
python models/change_detection/train.py \
  --data data/ \
  --sectors ATH-001-A ATH-001-B ATH-002-A \
  --output models/change_detection/model_v1.pkl

# Or with custom hyperparameters
python models/change_detection/train.py \
  --data data/ \
  --sectors ATH-001-A ATH-001-B ATH-002-A \
  --n-estimators 100 \
  --max-depth 15 \
  --output models/change_detection/model_v1.pkl
```

### 4. Review Metrics

Training script outputs:

- F1 Score (macro): Should be ≥ 0.75 for M2 milestone
- Precision & Recall per class
- Confusion matrix
- Feature importances
- Metrics saved to `model_v1_metrics.json`

### 5. Update This Card

Copy metrics from training output and update:

- "Training Dataset" section: actual sector names, data source
- "Model Performance" section: final F1, precision, recall
- "Training Details" section: actual training time, date
- "Status" field: change to "Production v1.0"

**Example:**

```markdown
### Final Metrics (Sprint 2, Real Imagery)

| Metric                  | Value |
| ----------------------- | ----- |
| **F1 Score (macro)**    | 0.82  |
| **F1 Score (weighted)** | 0.84  |
| **Precision (macro)**   | 0.83  |
| **Recall (macro)**      | 0.81  |
| **Accuracy**            | 0.83  |

Training Date: 2026-07-02  
Training Time: 3.5 seconds  
Data Source: Landsat 8/9, Athabasca region
```

### 6. Run Tests

```bash
# Run accuracy threshold tests
pytest tests/test_models.py::test_model_f1_score_baseline -v
pytest tests/test_models.py::test_model_precision_and_recall -v
pytest tests/test_models.py -v
```

### 7. Commit and Push

```bash
git add models/change_detection/model_v1.pkl
git add models/change_detection/model_v1_metrics.json
git add models/change_detection/model_card.md
git add models/change_detection/train.py
git commit -m "feat: train change-detection model v1, F1=0.82 on real Athabasca imagery"
git push origin feature/richard-ml
```

### 8. Create Pull Request

GitHub → New Pull Request

- Base: `develop`
- Head: `feature/richard-ml`
- Title: `feat: Change detection model v1 trained on real imagery (M2)`
- Description:

  ```
  ## Sprint 2 M2 Milestone - Model Training Complete

  **Metrics:**
  - F1 Score (macro): 0.82
  - Precision: 0.83
  - Recall: 0.81
  - Training Data: Real Landsat imagery, Athabasca region
  - Sectors: ATH-001-A, ATH-001-B, ATH-002-A

  **Testing:**
  - [ ] pytest all tests passing
  - [ ] CI pipeline green
  - [ ] Model card updated
  - [ ] Ready for Edwin review
  ```

---

## Testing & CI

**Before requesting review:**

```bash
# Run all tests
pytest tests/test_models.py -v

# Verify model file exists
ls -lh models/change_detection/model_v1.pkl

# Check metrics file
cat models/change_detection/model_v1_metrics.json | jq .

# Run linting
pylint models/change_detection/train.py
```

---

## Contact & Questions

- **Data Questions** → Ask Feven (ingest pipeline)
- **Model Questions** → Ask Richard
- **Testing/QA** → Ask Edwin

---

## Version History

| Version | Date       | Status     | F1 Score | Notes                              |
| ------- | ---------- | ---------- | -------- | ---------------------------------- |
| v0.1    | 2026-06-20 | Baseline   | 0.80     | Sprint 1 spike (synthetic data)    |
| v1.0    | 2026-07-02 | Production | TBD      | Sprint 2 (real imagery) - **TODO** |
| v2.0    | 2026-08-01 | Optimized  | TBD      | Sprint 4 (final tuning) - TODO     |

---

_Last Updated: 2026-06-26_  
_Next Milestone: M2 (July 4, 2026) — Real model training complete_

- Retrained quarterly with new imagery
- Hyperparameter tuning if F1 score drops below 0.75
- Version incremented (v1.1, v1.2, v2.0) on significant changes

### Versioning

- **v1.0** (Sprint 1): Baseline spike notebook
- **v1.1** (Sprint 2): Trained on production pipeline
- **v2.0** (Sprint 3+): Planned improvements

---

## Testing

### Unit Tests

- Output schema validation
- Risk score range checks [0, 1]
- Risk label classification rules
- Timestamp ISO 8601 format

### Integration Tests

- End-to-end prediction with real imagery
- PostGIS storage round-trip
- Frontend map display validation

### Regression Tests

- F1 score maintained above baseline
- No NaN/Inf values in outputs
- Latency < 2 seconds per prediction

---

## References

- [ML Output Schema](../ML_OUTPUT_SCHEMA.md)
- [Test Suite](../tests/test_models.py)
- [Training Code](train.py)
- [Spike Notebook](../notebooks/change_detection_spike.ipynb)

---

## Contact

**Model Owner:** Richard (AI/ML Specialist)  
**Questions:** Ask in team channel  
**Report Issues:** Create GitHub issue on `feature/richard-ml` branch

---

_Last Updated: 2026-06-26_  
_Next Review: 2026-07-04 (M2 Milestone)_
