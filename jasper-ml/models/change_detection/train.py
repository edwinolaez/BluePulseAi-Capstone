"""
train.py — Train Change Detection Model

Trains Random Forest classifier on pre/post-fire satellite imagery pairs.

Usage:
    python train.py --data data/ --epochs 100 --output models/change_detection/model_v1.pkl
    python train.py --sectors ATH-001-A ATH-001-B ATH-002-A --output model_v1.pkl
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

# Add parent directory to path for data_loader import
sys.path.insert(0, str(Path(__file__).parent))
from data_loader import prepare_training_dataset


def load_training_data(data_dir: str = "data/", sectors: list = None) -> tuple:
    """
    Load pre/post-fire imagery training pairs from sectors.
    
    Args:
        data_dir: Directory containing sector imagery
        sectors: List of sector IDs to include
    
    Returns:
        (X, y, dataset_info) where:
        - X: feature matrix (n_samples, n_features)
        - y: label vector (n_samples,)
        - dataset_info: metadata dict
    """
    print(f"Loading training data from {data_dir}...")
    
    if sectors is None:
        sectors = ["ATH-001-A", "ATH-001-B", "ATH-002-A"]
    
    # Load and preprocess data
    dataset = prepare_training_dataset(
        data_dir=data_dir,
        sectors=sectors,
        patch_size=32,
        test_split=0.2
    )
    
    # Combine train and test for now (will re-split later)
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
    Train Random Forest classifier on satellite imagery features.
    
    Args:
        X: Feature matrix (n_samples, n_features)
        y: Label vector (n_samples,)
        hyperparams: Dictionary of RandomForest hyperparameters
    
    Returns:
        (model, metrics_dict) where:
        - model: trained RandomForestClassifier
        - metrics_dict: performance metrics on test set
    """
    
    if hyperparams is None:
        hyperparams = {
            "n_estimators": 100,
            "max_depth": 15,
            "min_samples_split": 10,
            "random_state": 42,
            "n_jobs": -1
        }
    
    print(f"\nTraining model with hyperparameters:")
    for k, v in hyperparams.items():
        print(f"  {k}: {v}")
    
    # Split data (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nDataset split:")
    print(f"  Train set: {X_train.shape[0]} samples")
    print(f"  Test set: {X_test.shape[0]} samples")
    
    # Train model
    model = RandomForestClassifier(**hyperparams)
    
    print("\nTraining...")
    start_time = time.time()
    model.fit(X_train, y_train)
    training_time = time.time() - start_time
    
    print(f"✓ Model trained in {training_time:.2f} seconds")
    
    # Evaluate on test set
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)
    
    # Calculate metrics
    f1_macro = f1_score(y_test, y_pred, average='macro')
    f1_weighted = f1_score(y_test, y_pred, average='weighted')
    precision_macro = precision_score(y_test, y_pred, average='macro', zero_division=0)
    recall_macro = recall_score(y_test, y_pred, average='macro', zero_division=0)
    accuracy = np.mean(y_pred == y_test)
    
    # Per-class metrics
    f1_per_class = f1_score(y_test, y_pred, average=None, zero_division=0)
    precision_per_class = precision_score(y_test, y_pred, average=None, zero_division=0)
    recall_per_class = recall_score(y_test, y_pred, average=None, zero_division=0)
    
    # Confusion matrix
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
        "feature_importance": model.feature_importances_.tolist(),
    }
    
    # Print results
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
    top_indices = np.argsort(importance)[-5:][::-1]
    for rank, idx in enumerate(top_indices, 1):
        print(f"  {rank}. Feature {idx}: {importance[idx]:.4f}")
    
    print(f"{'='*60}")
    
    return model, metrics


def save_model(model: RandomForestClassifier, output_path: str, metrics: dict = None):
    """
    Save trained model to disk.
    
    Args:
        model: Trained RandomForestClassifier
        output_path: Path where model will be saved
        metrics: Optional metrics dict to save alongside
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Save model
    with open(output_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"\n✓ Model saved to {output_path}")
    
    # Save metrics if provided
    if metrics:
        metrics_path = output_path.with_stem(output_path.stem + "_metrics").with_suffix(".json")
        with open(metrics_path, 'w') as f:
            json.dump(metrics, f, indent=2)
        print(f"✓ Metrics saved to {metrics_path}")


def main():
    """Command-line interface for model training."""
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
    
    # Load data
    X, y, dataset_info = load_training_data(
        data_dir=args.data,
        sectors=args.sectors
    )
    
    # Configure hyperparameters
    hyperparams = {
        "n_estimators": args.n_estimators,
        "max_depth": args.max_depth,
        "min_samples_split": args.min_samples_split,
        "random_state": 42,
        "n_jobs": -1
    }
    
    # Train model
    model, metrics = train_model(X, y, hyperparams)
    
    # Add dataset info to metrics
    metrics["dataset"] = dataset_info
    metrics["hyperparameters"] = hyperparams
    metrics["training_date"] = datetime.utcnow().isoformat()
    
    # Save model
    save_model(model, args.output, metrics)
    
    print("\n✓ Training complete!")


if __name__ == "__main__":
    main()


def main():
    parser = argparse.ArgumentParser(description="Train change detection model")
    parser.add_argument("--data", default="data/sample", help="Path to training data")
    parser.add_argument("--epochs", type=int, default=100, help="Number of training epochs")
    parser.add_argument("--output", default="models/change_detection/model_v1.pkl", 
                       help="Path to save trained model")
    args = parser.parse_args()
    
    print("=" * 70)
    print("PROJECT JASPER — Change Detection Model Training")
    print("=" * 70)
    
    # Load data
    X, y = load_training_data(args.data)
    
    # Train model
    model, X_test, y_test = train_model(X, y)
    
    # Save model
    save_model(model, args.output)
    
    print("\n" + "=" * 70)
    print("✅ Training complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
