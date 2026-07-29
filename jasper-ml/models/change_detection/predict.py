"""
predict.py — Run Change Detection Model Inference

This script loads a trained RandomForest model from disk and runs it against
the satellite imagery for a given sector to produce a burn-risk prediction.

It can be called from the command line for one-off predictions, or its
functions (load_model, get_sector_features, predict) can be imported by
model_endpoint.py when real Landsat imagery becomes available.

Usage:
    python predict.py --model models/change_detection/model_v1.pkl --sector ATH-001-A
    python predict.py --model model_v1.pkl --sector ATH-001-A --output prediction.json

Output format follows the ML_OUTPUT_SCHEMA.md specification so that the result
JSON is compatible with the Jasper frontend and database ingest pipeline.
"""

import argparse
import pickle
import numpy as np
from pathlib import Path
from datetime import datetime, timezone
import json
import sys
import os

# Make data_loader importable without installing the package
sys.path.insert(0, str(Path(__file__).parent))
from data_loader import load_sector_imagery, compute_spectral_features, create_image_pairs


def load_model(model_path: str):
    """
    Deserialize a trained RandomForest model from a pickle file.

    Args:
        model_path — path to the .pkl file written by train.py.

    Returns:
        The trained RandomForestClassifier object.

    Raises:
        FileNotFoundError if the file does not exist.
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
    Load the training metrics JSON saved alongside the model pickle.

    train.py saves a {model_stem}_metrics.json file next to every model pickle.
    This function looks for that file and returns its contents so predictions
    can include training-time metadata (F1 score, training date, dataset size).

    Args:
        model_path — path to the .pkl file (used to construct the metrics path).

    Returns:
        Dict of metrics, or an empty dict if the metrics file is not found.
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
    Load satellite imagery for a sector and compute a single feature vector
    that the model can use for prediction.

    The process:
      1. Load the pre-fire and post-fire GeoTIFFs for the sector.
      2. Slice the images into overlapping 32x32 patches.
      3. Compute 8 spectral-change features per patch pair.
      4. Average all patch feature vectors into one representative vector.

    Averaging across all patches gives the model a sector-level view rather
    than a single-patch view, which is more robust to localised noise.

    Args:
        sector_id — e.g. "ATH-001-A".  Used to find the GeoTIFF files.
        data_dir  — directory containing the sector imagery.

    Returns:
        float32 array shaped (1, n_features) — the extra dimension is required
        by scikit-learn's predict() which expects a 2D input.
    """
    print(f"\nLoading imagery for sector {sector_id}...")

    # Load pre/post-fire imagery (falls back to synthetic if files missing)
    pre_img, post_img = load_sector_imagery(sector_id, data_dir)

    print(f"  Pre-fire image: {pre_img.shape}")
    print(f"  Post-fire image: {post_img.shape}")

    # Create overlapping patches to sample the full scene
    patches = create_image_pairs(pre_img, post_img, patch_size=32, stride=16)

    if len(patches) == 0:
        # Fallback: if the image is too small for any patches, treat the full
        # image as a single patch.
        print(f"  Warning: No patches created, using full images")
        patches = [(pre_img, post_img)]

    # Compute per-patch features, then average them across all patches
    all_features = []
    for pre_patch, post_patch in patches:
        features = compute_spectral_features(pre_patch, post_patch)
        all_features.append(features)

    mean_features = np.mean(all_features, axis=0)
    print(f"  Computed {len(all_features)} patches, aggregated to feature vector")

    # Reshape to (1, n_features) — scikit-learn expects a 2D array for predict()
    return mean_features.reshape(1, -1)


def predict(model, features: np.ndarray) -> tuple:
    """
    Run the trained model on a feature vector and return the predicted class
    along with confidence information.

    Args:
        model    — trained RandomForestClassifier from load_model().
        features — array shaped (1, n_features) from get_sector_features().

    Returns:
        prediction      — integer class label (0 = Low, 1 = Medium, 2 = High).
        max_probability — the probability assigned to the predicted class (0–1).
        probabilities   — full per-class probability array (length = n_classes).
    """
    prediction = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]
    # max_probability is the model's confidence in its chosen class
    max_probability = probabilities.max()

    return prediction, max_probability, probabilities


def format_output(sector_id: str,
                 prediction: int,
                 confidence: float,
                 probabilities: np.ndarray,
                 model_metrics: dict = None) -> dict:
    """
    Package a raw model prediction into the standardised ML output schema.

    The schema matches ML_OUTPUT_SCHEMA.md and is compatible with the Jasper
    frontend's TypeScript types and the ml_model_outputs database table.

    Args:
        sector_id      — the sector that was predicted.
        prediction     — class integer (0, 1, or 2).
        confidence     — max class probability from the model.
        probabilities  — full per-class probability array.
        model_metrics  — optional dict from load_model_metrics(); adds training
                         metadata to the output for auditability.

    Returns:
        Dict ready to be serialised to JSON.
    """
    # Map integer classes to human-readable risk labels
    label_map = {0: "Low", 1: "Medium", 2: "High"}
    risk_label = label_map.get(prediction, "Unknown")

    # The risk_score equals the probability of the predicted class so it
    # represents how confident the model is, not just which class won.
    risk_score = float(confidence)

    output = {
        "sector_id": sector_id,
        "model_version": "v1.0",
        "simulation_type": "change_detection",
        "risk_score": risk_score,
        "risk_label": risk_label,
        # direction_deg and velocity are zero for change detection — these
        # fields only carry meaning in the contaminant simulation output.
        "contaminant_vector": {
            "direction_deg": 0.0,
            "velocity": 0.0
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "confidence": float(confidence),
        "class_probabilities": {}
    }

    # Add per-class probabilities.  The loop safely handles models trained on
    # fewer than three classes (e.g. if only "Low" and "High" samples existed).
    class_names = ["no_change", "medium_change", "high_change"]
    for i, class_name in enumerate(class_names):
        if i < len(probabilities):
            output["class_probabilities"][class_name] = float(probabilities[i])
        else:
            output["class_probabilities"][class_name] = 0.0

    # Attach training metadata if available — useful for reviewers who want to
    # know when the model was trained and how well it performed at the time.
    if model_metrics:
        output["model_metadata"] = {
            "training_f1_score": model_metrics.get("f1_macro"),
            "training_date": model_metrics.get("training_date"),
            "training_samples": model_metrics.get("dataset", {}).get("n_samples")
        }

    return output


def save_output(output: dict, output_path: str):
    """
    Write the prediction output dictionary to a JSON file.

    Creates any missing parent directories so callers don't need to mkdir first.

    Args:
        output      — dict from format_output().
        output_path — destination file path (will be overwritten if it exists).
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"✓ Prediction saved to {output_path}")


def main():
    """
    Command-line interface for running a single change-detection prediction.

    Parses arguments, loads the model and imagery, runs inference, and either
    prints the result to the console or saves it to a JSON file.
    """
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

    # Load model and optional training metrics
    model = load_model(args.model)
    model_metrics = load_model_metrics(args.model)

    if model_metrics:
        print(f"\nModel training metrics:")
        print(f"  F1 Score (macro): {model_metrics.get('f1_macro', 'N/A'):.4f}")
        print(f"  Training date: {model_metrics.get('training_date', 'N/A')}")

    # Build the feature vector for the requested sector
    features = get_sector_features(args.sector, args.data)

    # Run inference
    print(f"\nRunning inference...")
    prediction, confidence, probabilities = predict(model, features)

    # Format result into the standard output schema
    output = format_output(
        args.sector,
        prediction,
        confidence,
        probabilities,
        model_metrics
    )

    # Display a human-readable summary in the terminal
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

    # Save to file or print raw JSON
    if args.output:
        save_output(output, args.output)
    else:
        print("Prediction Output (JSON):")
        print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
