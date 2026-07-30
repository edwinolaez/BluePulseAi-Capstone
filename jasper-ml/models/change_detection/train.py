"""
train.py — Train the Change Detection RandomForest Classifier

This script trains a scikit-learn RandomForestClassifier on pre/post-fire
satellite imagery pairs extracted from the Athabasca watershed sectors.
It is the "offline" training step that produces the model_v1.pkl file that
the live API (model_endpoint.py) loads at startup.

Workflow:
  1. load_training_data()  — loads GeoTIFFs for each sector and builds a
                             feature matrix using data_loader.py.
  2. train_model()         — splits the data, trains the RandomForest, and
                             computes precision / recall / F1 on the test set.
  3. save_model()          — serialises the trained model to a .pkl file and
                             saves the metrics alongside it as JSON.

Usage:
    python train.py --data data/ --epochs 100 --output models/change_detection/model_v1.pkl
    python train.py --sectors ATH-001-A ATH-001-B ATH-002-A --output model_v1.pkl

The M2 milestone target is macro F1 >= 0.75 on the held-out test set.
"""

import argparse
import pickle
import json
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score, precision_score, recall_score, confusion_matrix, classification_report
import time
from datetime import datetime
from pathlib import Path
import sys
import os

# Make data_loader importable from the same directory
sys.path.insert(0, str(Path(__file__).parent))
from data_loader import prepare_training_dataset


def load_training_data(data_dir: str = "data/", sectors: list = None) -> tuple:
    """
    Load pre/post-fire imagery for the specified sectors and return a combined
    feature matrix, label vector, and metadata dictionary.

    Delegates to prepare_training_dataset() in data_loader.py, which handles
    GeoTIFF reading, patch extraction, feature computation, and train/test
    splitting.  This function then re-merges the train and test splits so the
    caller (train_model) can do its own stratified split.

    Args:
        data_dir — directory containing the GeoTIFF files.
        sectors  — list of sector IDs to include.  Defaults to three core ATH
                   sectors if not specified.

    Returns:
        X_all        — feature matrix shaped (n_samples, n_features).
        y_all        — integer label vector shaped (n_samples,).
        dataset_info — dict with n_samples, n_features, sectors, and timestamp.
    """
    print(f"Loading training data from {data_dir}...")

    if sectors is None:
        sectors = ["ATH-001-A", "ATH-001-B", "ATH-002-A"]

    dataset = prepare_training_dataset(
        data_dir=data_dir,
        sectors=sectors,
        patch_size=32,
        test_split=0.2
    )

    # Re-merge train and test so train_model() can make its own stratified split.
    # This avoids double-splitting the data.
    X_all = np.vstack([dataset["X_train"], dataset["X_test"]])
    y_all = np.hstack([dataset["y_train"], dataset["y_test"]])

    print(f"✓ Loaded {dataset['n_samples']} training samples")
    print(f"  Features per sample: {dataset['n_features']}")
    print(f"  Sectors included: {', '.join(sectors)}")
    print(f"  Class distribution: No Change={np.sum(y_all==0)}, " +
          f"Medium={np.sum(y_all==1)}, High={np.sum(y_all==2)}")

    dataset_info = {
        "n_samples": dataset['n_samples'],
        "n_features": dataset['n_features'],
        "sectors": sectors,
        "timestamp": datetime.utcnow().isoformat(),
    }

    return X_all, y_all, dataset_info


def train_model(X: np.ndarray, y: np.ndarray,
                hyperparams: dict = None) -> tuple:
    """
    Train a RandomForestClassifier and evaluate it on a held-out test set.

    Steps:
      1. Apply an 80/20 stratified split (same class proportions in both halves).
      2. Fit the RandomForestClassifier on the training split.
      3. Compute macro and weighted F1, precision, recall, accuracy, per-class
         metrics, and a confusion matrix on the test split.

    The stratify=y argument in train_test_split is important: without it, a
    lucky random split could accidentally put all "High Change" samples in the
    training set and none in the test set, making evaluation misleading.

    Args:
        X          — feature matrix (n_samples, n_features).
        y          — label vector (n_samples,).
        hyperparams — dict of RandomForest keyword arguments.  Uses sensible
                      defaults if not provided.

    Returns:
        model   — the trained RandomForestClassifier.
        metrics — dict with all computed performance metrics.
    """
    if hyperparams is None:
        hyperparams = {
            "n_estimators": 100,
            "max_depth": 15,
            "min_samples_split": 10,
            "random_state": 42,
            "n_jobs": -1   # use all CPU cores
        }

    print(f"\nTraining model with hyperparameters:")
    for k, v in hyperparams.items():
        print(f"  {k}: {v}")

    # Stratified split ensures each class is proportionally represented in
    # both train and test sets, even when class counts are imbalanced.
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"\nDataset split:")
    print(f"  Train set: {X_train.shape[0]} samples")
    print(f"  Test set: {X_test.shape[0]} samples")

    model = RandomForestClassifier(**hyperparams)

    print("\nTraining...")
    start_time = time.time()
    model.fit(X_train, y_train)
    training_time = time.time() - start_time

    print(f"✓ Model trained in {training_time:.2f} seconds")

    # --- Evaluation on the held-out test set ---
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)

    # Macro averages treat each class equally regardless of sample count.
    # Weighted averages account for class imbalance.
    f1_macro = f1_score(y_test, y_pred, average='macro')
    f1_weighted = f1_score(y_test, y_pred, average='weighted')
    precision_macro = precision_score(y_test, y_pred, average='macro', zero_division=0)
    recall_macro = recall_score(y_test, y_pred, average='macro', zero_division=0)
    accuracy = np.mean(y_pred == y_test)

    # Per-class breakdown helps identify which burn category the model
    # struggles with most (typically "Medium Change" due to ambiguity).
    f1_per_class = f1_score(y_test, y_pred, average=None, zero_division=0)
    precision_per_class = precision_score(y_test, y_pred, average=None, zero_division=0)
    recall_per_class = recall_score(y_test, y_pred, average=None, zero_division=0)

    # Confusion matrix shows counts of true vs predicted labels — useful for
    # spotting systematic errors (e.g. "High" being predicted as "Medium").
    cm = confusion_matrix(y_test, y_pred)

    metrics = {
        "training_time_sec": training_time,
        "test_set_size": len(y_test),
        "f1_macro": float(f1_macro),
        "f1_weighted": float(f1_weighted),
        "precision_macro": float(precision_macro),
        "recall_macro": float(recall_macro),
        "accuracy": float(accuracy),
        "per_class": {
            "f1": [float(x) for x in f1_per_class],
            "precision": [float(x) for x in precision_per_class],
            "recall": [float(x) for x in recall_per_class],
        },
        "confusion_matrix": cm.tolist(),
        # Feature importance shows which of the 8 spectral features contributed
        # most to the model's decisions — useful for understanding what drives
        # the burn-risk classification.
        "feature_importance": model.feature_importances_.tolist(),
    }

    # Print a human-readable summary for the training run log
    print(f"\n{'='*60}")
    print("Test Set Performance")
    print(f"{'='*60}")
    print(f"  F1 Score (macro):     {f1_macro:.4f}")
    print(f"  F1 Score (weighted):  {f1_weighted:.4f}")
    print(f"  Precision (macro):    {precision_macro:.4f}")
    print(f"  Recall (macro):       {recall_macro:.4f}")
    print(f"  Accuracy:             {accuracy:.4f}")

    print(f"\nPer-Class Performance:")
    class_names = ["No Change", "Medium Change", "High Change"]
    for i, f1 in enumerate(f1_per_class):
        name = class_names[i] if i < len(class_names) else f"Class {i}"
        print(f"  {name:15s} — F1: {f1:.4f}, " +
              f"Precision: {precision_per_class[i]:.4f}, " +
              f"Recall: {recall_per_class[i]:.4f}")

    print(f"\nConfusion Matrix:")
    print(cm)

    print(f"\nTop 5 Feature Importances:")
    importance = model.feature_importances_
    # argsort gives ascending order; [::-1] reverses to descending; [-5:] takes top 5
    top_indices = np.argsort(importance)[-5:][::-1]
    for rank, idx in enumerate(top_indices, 1):
        print(f"  {rank}. Feature {idx}: {importance[idx]:.4f}")

    print(f"{'='*60}")

    return model, metrics


def save_model(model: RandomForestClassifier, output_path: str, metrics: dict = None):
    """
    Serialise the trained model to a pickle file and save metrics as JSON.

    The metrics JSON is saved alongside the pickle with "_metrics" appended to
    the stem, e.g. model_v1.pkl → model_v1_metrics.json.  This makes it easy
    to find the metrics for any given model checkpoint.

    Args:
        model       — trained RandomForestClassifier.
        output_path — where to write the .pkl file.
                      Parent directories are created if they don't exist.
        metrics     — optional metrics dict from train_model().
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"\n✓ Model saved to {output_path}")

    if metrics:
        # Construct the metrics path by appending "_metrics" to the model stem
        metrics_path = output_path.with_stem(output_path.stem + "_metrics").with_suffix(".json")
        with open(metrics_path, 'w') as f:
            json.dump(metrics, f, indent=2)
        print(f"✓ Metrics saved to {metrics_path}")


def main():
    """
    Command-line entry point for training a new model checkpoint.

    Parses CLI arguments, runs the full training pipeline, and saves the
    resulting model and metrics files.
    """
    parser = argparse.ArgumentParser(
        description="Train change detection model on satellite imagery"
    )
    parser.add_argument(
        "--data", type=str, default="data/",
        help="Directory containing sector imagery"
    )
    parser.add_argument(
        "--sectors", type=str, nargs="+",
        default=["ATH-001-A", "ATH-001-B", "ATH-002-A"],
        help="List of sector IDs to use for training"
    )
    parser.add_argument(
        "--n-estimators", type=int, default=100,
        help="Number of trees in Random Forest"
    )
    parser.add_argument(
        "--max-depth", type=int, default=15,
        help="Maximum tree depth"
    )
    parser.add_argument(
        "--min-samples-split", type=int, default=10,
        help="Minimum samples to split a node"
    )
    parser.add_argument(
        "--output", type=str, default="models/change_detection/model_v1.pkl",
        help="Output path for trained model"
    )

    args = parser.parse_args()

    print("="*60)
    print("Change Detection Model Training")
    print("="*60)

    # Step 1: load and merge data from all requested sectors
    X, y, dataset_info = load_training_data(
        data_dir=args.data,
        sectors=args.sectors
    )

    # Step 2: wire up hyperparameters from CLI flags
    hyperparams = {
        "n_estimators": args.n_estimators,
        "max_depth": args.max_depth,
        "min_samples_split": args.min_samples_split,
        "random_state": 42,   # fixed for reproducibility
        "n_jobs": -1
    }

    # Step 3: train and evaluate
    model, metrics = train_model(X, y, hyperparams)

    # Step 4: attach provenance info to the metrics before saving
    metrics["dataset"] = dataset_info
    metrics["hyperparameters"] = hyperparams
    metrics["training_date"] = datetime.utcnow().isoformat()

    # Step 5: persist model and metrics to disk
    save_model(model, args.output, metrics)

    print("\n✓ Training complete!")


if __name__ == "__main__":
    main()
