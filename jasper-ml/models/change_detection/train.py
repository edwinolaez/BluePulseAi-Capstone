"""
train.py — Train Change Detection Model

Trains Random Forest classifier on pre/post-fire satellite imagery pairs.

Usage:
    python train.py --epochs 100 --output models/change_detection/model_v1.pkl
"""

import argparse
import pickle
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score, precision_score, recall_score, classification_report
import time


def load_training_data(data_path: str = "data/sample"):
    """
    Load pre/post-fire imagery training pairs.
    
    TODO (Sprint 2):
    - Fetch training data from Feven's ingest pipeline
    - Handle GeoTIFF format with rasterio
    - Align image pairs geometrically
    - Create feature matrix and labels
    """
    print(f"Loading training data from {data_path}...")
    
    # Placeholder: generate synthetic training data
    n_samples = 10000
    n_features = 8  # 4 bands pre + 4 bands post
    
    X = np.random.randn(n_samples, n_features).astype(np.float32)
    y = np.random.randint(0, 3, n_samples)  # 3 classes
    
    print(f"✓ Loaded {n_samples} training samples with {n_features} features")
    print(f"  Class distribution: {np.bincount(y)}")
    
    return X, y


def train_model(X, y, hyperparams: dict = None) -> RandomForestClassifier:
    """Train Random Forest classifier."""
    
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
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nTrain set: {X_train.shape[0]} samples")
    print(f"Test set: {X_test.shape[0]} samples")
    
    # Train model
    model = RandomForestClassifier(**hyperparams)
    
    start_time = time.time()
    model.fit(X_train, y_train)
    training_time = time.time() - start_time
    
    print(f"\n✓ Model trained in {training_time:.2f} seconds")
    
    # Evaluate
    y_pred = model.predict(X_test)
    f1 = f1_score(y_test, y_pred, average='macro')
    precision = precision_score(y_test, y_pred, average='macro')
    recall = recall_score(y_test, y_pred, average='macro')
    
    print(f"\nTest Set Performance:")
    print(f"  F1 Score (macro): {f1:.4f}")
    print(f"  Precision (macro): {precision:.4f}")
    print(f"  Recall (macro): {recall:.4f}")
    
    print(f"\nDetailed Classification Report:")
    print(classification_report(y_test, y_pred, 
                              target_names=["No Change", "Medium Change", "Burn Scar"]))
    
    return model, X_test, y_test


def save_model(model: RandomForestClassifier, output_path: str):
    """Save trained model to disk."""
    with open(output_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"\n✓ Model saved to {output_path}")


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
