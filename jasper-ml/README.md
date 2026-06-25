# jasper-ml

**Owner:** Richard | AI/ML + Simulation

## Setup

```bash
python3 -m venv ml-env
source ml-env/bin/activate      # Windows: ml-env\Scripts\activate
pip install scikit-learn numpy scipy rasterio fastapi uvicorn pytest pylint supabase
# Choose one:
pip install tensorflow           # Option A
# pip install torch torchvision  # Option B
pip freeze > requirements.txt
```

## Verify

```bash
python3 -c "import rasterio; print('rasterio OK:', rasterio.__version__)"
python3 -c "from sklearn.ensemble import RandomForestClassifier; print('sklearn OK')"
```

## Deliverables

- `notebooks/change_detection_spike.ipynb` — Sprint 1 spike
- `POST /predict/change-detection`
- `POST /simulate/erosion`
- `POST /simulate/contaminant`
- `model_card.md` — required for M5
