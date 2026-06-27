"""
predict.py — Run Change Detection Model Inference

Loads trained model and runs predictions on new satellite imagery.

Usage:
    python predict.py --model models/change_detection/model_v1.pkl --sector ATH-001-A
    python predict.py --model model_v1.pkl --sector ATH-001-A --output prediction.json
"""

import argparse
import pickle
import numpy as np
from pathlib import Path
from datetime import datetime, timezone
import json
import sys
import os

# Add parent directory to path for data_loader import
sys.path.insert(0, str(Path(__file__).parent))
from data_loader import load_sector_imagery, compute_spectral_features, create_image_pairs


def load_model(model_path: str):
    """
    Load trained RandomForest model from disk.
    
    Args:
        model_path: Path to pickled model file
    
    Returns:
        Trained RandomForestClassifier
    """
    model_path = Path(model_path)
    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")
    
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    print(f"✓ Model loaded from {model_path}")
    return model


def load_model_metrics(model_path: str) -> dict:
    """
    Load metrics from training (if available).
    
    Args:
        model_path: Path to pickled model file
    
    Returns:
        Metrics dict or empty dict if not found
    """
    metrics_path = Path(model_path).with_stem(
        Path(model_path).stem.replace("_metrics", "") + "_metrics"
    ).with_suffix(".json")
    
    if metrics_path.exists():
        with open(metrics_path, 'r') as f:
            return json.load(f)
    return {}


def get_sector_features(sector_id: str, data_dir: str = "data/") -> np.ndarray:
    """
    Load satellite imagery for a sector and compute feature vector.
    
    Args:
        sector_id: Sector identifier (e.g., "ATH-001-A")
        data_dir: Directory containing sector imagery
    
    Returns:
        Feature vector (n_features,) ready for model prediction
    """
    print(f"\nLoading imagery for sector {sector_id}...")
    
    # Load pre/post-fire imagery
    pre_img, post_img = load_sector_imagery(sector_id, data_dir)
    
    print(f"  Pre-fire image: {pre_img.shape}")
    print(f"  Post-fire image: {post_img.shape}")
    
    # Create patches and compute features
    patches = create_image_pairs(pre_img, post_img, patch_size=32, stride=16)
    
    if len(patches) == 0:
        print(f"  Warning: No patches created, using full images")
        patches = [(pre_img, post_img)]
    
    # Compute mean features across all patches
    all_features = []
    for pre_patch, post_patch in patches:
        features = compute_spectral_features(pre_patch, post_patch)
        all_features.append(features)
    
    mean_features = np.mean(all_features, axis=0)
    print(f"  Computed {len(all_features)} patches, aggregated to feature vector")
    
    return mean_features.reshape(1, -1)  # Reshape for sklearn prediction


def predict(model, features: np.ndarray) -> tuple:
    """
    Run model inference on features.
    
    Args:
        model: Trained RandomForestClassifier
        features: Feature vector (1, n_features)
    
    Returns:
        (prediction_class, max_probability, probabilities_per_class)
    """
    prediction = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]
    max_probability = probabilities.max()
    
    return prediction, max_probability, probabilities


def format_output(sector_id: str, 
                 prediction: int, 
                 confidence: float,
                 probabilities: np.ndarray,
                 model_metrics: dict = None) -> dict:
    """
    Format prediction as standardized ML output schema.
    
    Args:
        sector_id: Sector ID that was predicted
        prediction: Class prediction (0, 1, or 2)
        confidence: Max probability from model
        probabilities: Per-class probabilities
        model_metrics: Optional metrics from training
    
    Returns:
        Dict following ML_OUTPUT_SCHEMA.md
    """
    
    # Map class to risk label
    label_map = {0: "Low", 1: "Medium", 2: "High"}
    risk_label = label_map.get(prediction, "Unknown")
    
    # Risk score: use probability of predicted class
    risk_score = float(confidence)
    
    output = {
        "sector_id": sector_id,
        "model_version": "v1.0",
        "simulation_type": "change_detection",
        "risk_score": risk_score,
        "risk_label": risk_label,
        "contaminant_vector": {
            "direction_deg": 0.0,
            "velocity": 0.0
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "confidence": float(confidence),
        "class_probabilities": {}
    }
    
    # Add per-class probabilities (handle variable number of classes)
    class_names = ["no_change", "medium_change", "high_change"]
    for i, class_name in enumerate(class_names):
        if i < len(probabilities):
            output["class_probabilities"][class_name] = float(probabilities[i])
        else:
            output["class_probabilities"][class_name] = 0.0
    
    # Add model metadata if available
    if model_metrics:
        output["model_metadata"] = {
            "training_f1_score": model_metrics.get("f1_macro"),
            "training_date": model_metrics.get("training_date"),
            "training_samples": model_metrics.get("dataset", {}).get("n_samples")
        }
    
    return output


def save_output(output: dict, output_path: str):
    """Save prediction output to JSON file."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"✓ Prediction saved to {output_path}")


def main():
    """Command-line interface for model inference."""
    parser = argparse.ArgumentParser(
        description="Run change detection model inference on satellite imagery"
    )
    parser.add_argument(
        "--model", type=str, default="models/change_detection/model_v1.pkl",
        help="Path to trained model file"
    )
    parser.add_argument(
        "--sector", type=str, required=True,
        help="Sector ID to predict (e.g., ATH-001-A)"
    )
    parser.add_argument(
        "--data", type=str, default="data/",
        help="Directory containing sector imagery"
    )
    parser.add_argument(
        "--output", type=str,
        help="Output file path (JSON). If not specified, prints to console"
    )
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("PROJECT JASPER — Change Detection Model Inference")
    print("=" * 70)
    
    # Load model
    model = load_model(args.model)
    model_metrics = load_model_metrics(args.model)
    
    if model_metrics:
        print(f"\nModel training metrics:")
        print(f"  F1 Score (macro): {model_metrics.get('f1_macro', 'N/A'):.4f}")
        print(f"  Training date: {model_metrics.get('training_date', 'N/A')}")
    
    # Get sector features
    features = get_sector_features(args.sector, args.data)
    
    # Run prediction
    print(f"\nRunning inference...")
    prediction, confidence, probabilities = predict(model, features)
    
    # Format output
    output = format_output(
        args.sector, 
        prediction, 
        confidence, 
        probabilities,
        model_metrics
    )
    
    # Display results
    print(f"\n{'='*70}")
    print(f"Prediction Results for Sector: {args.sector}")
    print(f"{'='*70}")
    print(f"Risk Label:       {output['risk_label']}")
    print(f"Risk Score:       {output['risk_score']:.4f}")
    print(f"Confidence:       {output['confidence']:.4f}")
    print(f"Timestamp:        {output['timestamp']}")
    print(f"\nClass Probabilities:")
    for class_name, prob in output['class_probabilities'].items():
        print(f"  {class_name:15s}: {prob:.4f}")
    print(f"{'='*70}\n")
    
    # Save or print output
    if args.output:
        save_output(output, args.output)
    else:
        print("Prediction Output (JSON):")
        print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()


if __name__ == "__main__":
    main()
