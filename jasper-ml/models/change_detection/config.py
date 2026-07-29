"""
config.py — Model Configuration for Change Detection

This file is the single source of truth for every tunable number in the
change-detection training pipeline.  Instead of scattering magic numbers
across train.py and predict.py, they all live here as typed dataclass fields.

Two pre-built configuration objects are exported for everyday use:
  - DEFAULT_MODEL_CONFIG / DEFAULT_DATA_CONFIG  — sensible starting points
  - SPRINT_2_MODEL_CONFIG / SPRINT_2_DATA_CONFIG — settings locked in for the
    M2 milestone (target F1 >= 0.75 by July 4 2026)

Run this file directly (`python config.py`) to print the active configuration
values to the terminal for a quick sanity check.
"""

from dataclasses import dataclass
from typing import List, Dict, Any


@dataclass
class ModelConfig:
    """
    Hyperparameters that control how the RandomForest classifier is built and
    how its performance is evaluated.

    Fields:
        n_estimators       — number of decision trees in the forest.  More trees
                             = better accuracy but slower training and inference.
        max_depth          — maximum depth of each tree.  Limits overfitting.
        min_samples_split  — minimum number of training samples required to
                             split an internal tree node.  Higher = smoother model.
        min_samples_leaf   — minimum samples required at a leaf node.
        random_state       — seed for reproducibility across runs.
        n_jobs             — CPU cores to use (-1 = all available).
        test_split         — fraction of data held out for final evaluation.
        val_split          — fraction of training data used for validation
                             (currently unused in the training loop but kept
                             for future cross-validation work).
        random_seed        — second seed used in data splitting (matches random_state).
        patch_size         — side length (pixels) of image patches extracted
                             from each satellite scene.
        patch_stride       — step size for the sliding window.  A stride smaller
                             than patch_size produces overlapping patches, which
                             increases training data at the cost of redundancy.
        normalize_bands    — whether to normalise pixel values to [0, 1].
        min_f1_score       — minimum acceptable macro F1 score on the test set.
                             Training is considered successful only above this bar.
        min_precision      — minimum acceptable macro precision.
        min_recall         — minimum acceptable macro recall.
    """

    # Model hyperparameters
    n_estimators: int = 100
    max_depth: int = 15
    min_samples_split: int = 10
    min_samples_leaf: int = 4
    random_state: int = 42
    n_jobs: int = -1           # -1 = use all CPU cores

    # Training configuration
    test_split: float = 0.2    # 20% of samples held out for the test set
    val_split: float = 0.1
    random_seed: int = 42

    # Data configuration
    patch_size: int = 32       # 32x32 pixel crops from the satellite imagery
    patch_stride: int = 16     # 50% overlap between adjacent patches
    normalize_bands: bool = True

    # Accuracy targets (M2 milestone: June 20)
    min_f1_score: float = 0.75
    min_precision: float = 0.75
    min_recall: float = 0.75

    def to_dict(self) -> Dict[str, Any]:
        """
        Serialize the configuration to a plain dictionary.

        Used when saving training metrics alongside the model file so reviewers
        can see exactly which settings produced a given model checkpoint.
        """
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
    """
    Configuration for the data-loading pipeline.

    Controls where training imagery is found, which sectors to include, and
    what the imagery looks like (number of spectral bands, resolution).

    Fields:
        data_dir           — directory containing pre/post-fire GeoTIFF pairs,
                             named as {sector_id}_pre.tif and {sector_id}_post.tif.
        model_output_dir   — where trained model pickles are written.
        train_sectors      — list of sector IDs to load during training.
                             Defaults to the four core ATH sectors if not set.
        n_bands            — number of spectral bands in each image.
                             4 = Red, Green, Blue, Near-Infrared (standard Landsat).
        imagery_resolution_m — ground sampling distance in metres.
                               30 m is standard Landsat 8/9 resolution.
    """

    # Data paths
    data_dir: str = "data/"
    model_output_dir: str = "models/change_detection/"

    # Training sectors — populated in __post_init__ if not provided
    train_sectors: List[str] = None

    # Imagery specifications
    n_bands: int = 4              # RGB + NIR
    imagery_resolution_m: int = 30  # Landsat resolution in metres

    def __post_init__(self):
        # Use a mutable default here rather than a mutable default argument
        # (Python dataclass gotcha: mutable defaults must go in __post_init__).
        if self.train_sectors is None:
            self.train_sectors = [
                "ATH-001-A",
                "ATH-001-B",
                "ATH-002-A",
                "ATH-002-B",
            ]


# ---------------------------------------------------------------------------
# Pre-built configuration objects
# ---------------------------------------------------------------------------

# Sensible defaults for development and ad-hoc experiments
DEFAULT_MODEL_CONFIG = ModelConfig()
DEFAULT_DATA_CONFIG = DataConfig()


# Sprint 2 settings — locked in for the M2 milestone (July 4 2026).
# These are the exact hyperparameters that must produce F1 >= 0.75.
SPRINT_2_MODEL_CONFIG = ModelConfig(
    n_estimators=100,
    max_depth=15,
    min_samples_split=10,
    min_f1_score=0.75,  # M2 baseline target
)

# Sprint 2 uses three sectors for training (ATH-001-A, ATH-001-B, ATH-002-A)
# because ATH-002-B imagery was not available at the time of the milestone.
SPRINT_2_DATA_CONFIG = DataConfig(
    train_sectors=[
        "ATH-001-A",
        "ATH-001-B",
        "ATH-002-A",
    ],
    imagery_resolution_m=30,
)


if __name__ == "__main__":
    # Quick sanity-check: print the active configuration to the terminal.
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
