"""
config.py — Model Configuration

Centralized configuration for model hyperparameters, data paths, and training settings.
"""

from dataclasses import dataclass
from typing import List, Dict, Any


@dataclass
class ModelConfig:
    """RandomForest model hyperparameters."""
    
    # Model hyperparameters
    n_estimators: int = 100
    max_depth: int = 15
    min_samples_split: int = 10
    min_samples_leaf: int = 4
    random_state: int = 42
    n_jobs: int = -1
    
    # Training configuration
    test_split: float = 0.2
    val_split: float = 0.1
    random_seed: int = 42
    
    # Data configuration
    patch_size: int = 32
    patch_stride: int = 16
    normalize_bands: bool = True
    
    # Accuracy targets (M2 milestone: June 20)
    min_f1_score: float = 0.75
    min_precision: float = 0.75
    min_recall: float = 0.75
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary."""
        return {
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "min_samples_split": self.min_samples_split,
            "min_samples_leaf": self.min_samples_leaf,
            "random_state": self.random_state,
            "n_jobs": self.n_jobs,
            "test_split": self.test_split,
            "patch_size": self.patch_size,
            "patch_stride": self.patch_stride,
        }


@dataclass
class DataConfig:
    """Data loading configuration."""
    
    # Data paths
    data_dir: str = "data/"
    model_output_dir: str = "models/change_detection/"
    
    # Training sectors
    train_sectors: List[str] = None
    
    # Imagery specifications
    n_bands: int = 4  # RGB + NIR
    imagery_resolution_m: int = 30  # Landsat resolution
    
    def __post_init__(self):
        if self.train_sectors is None:
            self.train_sectors = [
                "ATH-001-A",
                "ATH-001-B",
                "ATH-002-A",
                "ATH-002-B",
            ]


# Default configurations
DEFAULT_MODEL_CONFIG = ModelConfig()
DEFAULT_DATA_CONFIG = DataConfig()


# Sprint 2 specific configurations
SPRINT_2_MODEL_CONFIG = ModelConfig(
    n_estimators=100,
    max_depth=15,
    min_samples_split=10,
    min_f1_score=0.75,  # M2 baseline target
)

SPRINT_2_DATA_CONFIG = DataConfig(
    train_sectors=[
        "ATH-001-A",
        "ATH-001-B",
        "ATH-002-A",
    ],
    imagery_resolution_m=30,
)


if __name__ == "__main__":
    print("Model Configuration")
    print("="*60)
    print("\nDefault Model Config:")
    for key, value in DEFAULT_MODEL_CONFIG.to_dict().items():
        print(f"  {key}: {value}")
    
    print("\nDefault Data Config:")
    print(f"  data_dir: {DEFAULT_DATA_CONFIG.data_dir}")
    print(f"  model_output_dir: {DEFAULT_DATA_CONFIG.model_output_dir}")
    print(f"  train_sectors: {DEFAULT_DATA_CONFIG.train_sectors}")
    print(f"  n_bands: {DEFAULT_DATA_CONFIG.n_bands}")
    
    print("\nSprint 2 Targets:")
    print(f"  Min F1 Score: {SPRINT_2_MODEL_CONFIG.min_f1_score}")
    print(f"  Min Precision: {SPRINT_2_MODEL_CONFIG.min_precision}")
    print(f"  Min Recall: {SPRINT_2_MODEL_CONFIG.min_recall}")
    print(f"  Milestone: M2 (July 4, 2026)")
