"""
predict.py — Run Change Detection Model Inference

Loads trained model and runs predictions on new satellite imagery.

Usage:
    python predict.py --model models/change_detection/model_v1.pkl --sector ATH-001-A
"""

import argparse
import pickle
import numpy as np
from pathlib import Path
from datetime import datetime, timezone
import json


def load_model(model_path: str):
    """Load trained model from disk."""
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    print(f"✓ Model loaded from {model_path}")
    return model


def load_sector_imagery(sector_id: str):
    """
    Load pre/post-fire imagery for a specific sector.
    
    TODO (Sprint 2):
    - Query Feven's ingest pipeline for sector data
    - Load GeoTIFF files with rasterio
    - Parse geospatial metadata
    """
    print(f"Loading imagery for sector {sector_id}...")
    
    # Placeholder: generate synthetic imagery features
    n_features = 8
    features = np.random.randn(1, n_features).astype(np.float32)
    
    print(f"✓ Loaded features for sector {sector_id}")
    return features


def predict(model, features):
    """Run model inference."""
    prediction = model.predict(features)[0]
    probability = model.predict_proba(features)[0].max()
    return prediction, probability


def format_output(sector_id: str, prediction: int, confidence: float) -> dict:
    """Format prediction as standardized ML output."""
    
    # Map class to label
    label_map = {0: "Low", 1: "Medium", 2: "High"}
    risk_label = label_map.get(prediction, "Unknown")
    
    # Normalize to risk_score [0, 1]
    risk_score = float(prediction) / 2.0  # Normalize class to [0, 1]
    
    output = {
        "sector_id": sector_id,
        "model_version": "v1.0",
        "simulation_type": "change_detection",
        "risk_score": risk_score,
        "risk_label": risk_label,
        "contaminant_vector": {"direction_deg": 0.0, "velocity": 0.0},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "confidence": float(confidence)
    }
    
    return output


def main():
    parser = argparse.ArgumentParser(description="Run change detection predictions")
    parser.add_argument("--model", default="models/change_detection/model_v1.pkl",
                       help="Path to trained model")
    parser.add_argument("--sector", required=True, help="Sector ID to predict")
    parser.add_argument("--output", help="Output file path (JSON)")
    args = parser.parse_args()
    
    print("=" * 70)
    print("PROJECT JASPER — Change Detection Model Inference")
    print("=" * 70)
    
    # Load model
    model = load_model(args.model)
    
    # Load sector imagery
    features = load_sector_imagery(args.sector)
    
    # Run prediction
    print(f"\nRunning inference on sector {args.sector}...")
    prediction, confidence = predict(model, features)
    
    # Format output
    output = format_output(args.sector, prediction, confidence)
    
    print(f"\n✓ Prediction complete:")
    print(f"  Risk Score: {output['risk_score']:.3f}")
    print(f"  Risk Label: {output['risk_label']}")
    print(f"  Confidence: {output['confidence']:.3f}")
    
    # Display JSON
    print(f"\nJSON Output:")
    print(json.dumps(output, indent=2))
    
    # Optionally save to file
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(output, f, indent=2)
        print(f"\n✓ Output saved to {args.output}")
    
    print("\n" + "=" * 70)


if __name__ == "__main__":
    main()
