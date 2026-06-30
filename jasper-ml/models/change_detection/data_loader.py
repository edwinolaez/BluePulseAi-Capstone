"""
data_loader.py — Load and preprocess satellite imagery for model training

Handles GeoTIFF loading, preprocessing, and creation of training samples
from pre/post-fire satellite imagery pairs.
"""

import numpy as np
from typing import Tuple, List, Dict
import os
from pathlib import Path


def load_geotiff_array(filepath: str) -> Tuple[np.ndarray, Dict]:
    """
    Load GeoTIFF file and return pixel array with metadata.
    
    Args:
        filepath: Path to GeoTIFF file
    
    Returns:
        (pixel_array, metadata)
        - pixel_array: shape (height, width, bands)
        - metadata: dict with geospatial info
    """
    try:
        import rasterio
        with rasterio.open(filepath) as src:
            data = src.read()  # shape (bands, height, width)
            metadata = src.meta
            # Transpose to (height, width, bands)
            data = np.transpose(data, (1, 2, 0))
            return data, metadata
    except ImportError:
        print("Warning: rasterio not available, using synthetic data")
        return _create_synthetic_imagery(256, 4), {}


def _create_synthetic_imagery(size: int = 256, bands: int = 4) -> np.ndarray:
    """
    Create synthetic satellite imagery for development/testing.
    
    Args:
        size: Image dimensions (size x size)
        bands: Number of spectral bands (4 = RGBN)
    
    Returns:
        Synthetic imagery array (size, size, bands)
    """
    np.random.seed(42)
    synthetic = np.random.randint(0, 256, (size, size, bands), dtype=np.uint8)
    return synthetic.astype(np.float32) / 255.0


def create_image_pairs(pre_fire_image: np.ndarray,
                      post_fire_image: np.ndarray,
                      patch_size: int = 32,
                      stride: int = 16) -> List[Tuple[np.ndarray, np.ndarray]]:
    """
    Create overlapping patch pairs from pre/post-fire images.
    
    Args:
        pre_fire_image: Pre-fire imagery (height, width, bands)
        post_fire_image: Post-fire imagery (height, width, bands)
        patch_size: Size of patches to extract
        stride: Step size for sliding window
    
    Returns:
        List of (pre_patch, post_patch) tuples
    """
    patches = []
    height, width = pre_fire_image.shape[:2]
    
    for i in range(0, height - patch_size, stride):
        for j in range(0, width - patch_size, stride):
            pre_patch = pre_fire_image[i:i+patch_size, j:j+patch_size, :]
            post_patch = post_fire_image[i:i+patch_size, j:j+patch_size, :]
            
            if pre_patch.shape == (patch_size, patch_size, pre_fire_image.shape[2]):
                patches.append((pre_patch, post_patch))
    
    return patches


def compute_spectral_features(pre_patch: np.ndarray,
                             post_patch: np.ndarray) -> np.ndarray:
    """
    Compute spectral change features from image patches.
    
    Args:
        pre_patch: Pre-fire patch (patch_size, patch_size, bands)
        post_patch: Post-fire patch (patch_size, patch_size, bands)
    
    Returns:
        Feature vector (8,) containing:
        - Mean RGB difference
        - NDVI difference
        - Overall spectral angle
        - Brightness change
        - Variance measures
    """
    # Normalize patches to [0, 1]
    pre_patch = np.clip(pre_patch, 0, 1)
    post_patch = np.clip(post_patch, 0, 1)
    
    # RGB channels (usually first 3 bands)
    pre_rgb = pre_patch[:, :, :3] if pre_patch.shape[2] >= 3 else pre_patch[:, :, :1]
    post_rgb = post_patch[:, :, :3] if post_patch.shape[2] >= 3 else post_patch[:, :, :1]
    
    # NIR channel (usually last band)
    pre_nir = pre_patch[:, :, -1] if pre_patch.shape[2] >= 4 else pre_patch[:, :, 0]
    post_nir = post_patch[:, :, -1] if post_patch.shape[2] >= 4 else post_patch[:, :, 0]
    
    # Compute NDVI for both images
    # NDVI = (NIR - Red) / (NIR + Red)
    pre_red = pre_patch[:, :, 0] if pre_patch.shape[2] >= 3 else pre_patch[:, :, 0]
    post_red = post_patch[:, :, 0] if post_patch.shape[2] >= 3 else post_patch[:, :, 0]
    
    pre_ndvi = (pre_nir - pre_red) / (pre_nir + pre_red + 1e-8)
    post_ndvi = (post_nir - post_red) / (post_nir + post_red + 1e-8)
    
    # Features
    features = [
        np.mean(np.abs(post_rgb - pre_rgb)),  # Mean RGB difference
        np.mean(np.abs(post_ndvi - pre_ndvi)),  # NDVI difference
        np.mean(np.abs(post_nir - pre_nir)),  # NIR difference
        np.mean(post_rgb),  # Post-fire brightness
        np.std(post_ndvi),  # Vegetation variability
        np.std(pre_ndvi),
        np.mean(post_ndvi),
        np.mean(pre_ndvi),
    ]
    
    return np.array(features, dtype=np.float32)


def create_training_samples(image_pairs: List[Tuple[np.ndarray, np.ndarray]],
                           burn_labels: List[int] = None) -> Tuple[np.ndarray, np.ndarray]:
    """
    Convert image pairs to feature vectors and labels for training.
    
    Args:
        image_pairs: List of (pre_patch, post_patch) tuples
        burn_labels: Optional labels for each pair
                    0 = No Change, 1 = Medium Change, 2 = High Change
    
    Returns:
        (features, labels) where:
        - features: shape (n_samples, n_features)
        - labels: shape (n_samples,)
    """
    features_list = []
    labels_list = []
    
    for idx, (pre_patch, post_patch) in enumerate(image_pairs):
        features = compute_spectral_features(pre_patch, post_patch)
        features_list.append(features)
        
        # If labels not provided, generate synthetic labels based on spectral change
        if burn_labels is None:
            # Synthetic label: higher spectral change = higher burn category
            change_magnitude = np.mean(np.abs(post_patch - pre_patch))
            if change_magnitude > 0.3:
                label = 2  # High Change
            elif change_magnitude > 0.15:
                label = 1  # Medium Change
            else:
                label = 0  # No Change
            labels_list.append(label)
        else:
            labels_list.append(burn_labels[idx])
    
    features_array = np.array(features_list, dtype=np.float32)
    labels_array = np.array(labels_list, dtype=np.int32)
    
    return features_array, labels_array


def load_sector_imagery(sector_id: str, data_dir: str = "data/") -> Tuple[np.ndarray, np.ndarray]:
    """
    Load pre/post-fire imagery for a given sector.
    
    Args:
        sector_id: Sector identifier (e.g., "ATH-001-A")
        data_dir: Directory containing imagery
    
    Returns:
        (pre_fire_image, post_fire_image) or synthetic if files not found
    """
    pre_path = os.path.join(data_dir, f"{sector_id}_pre.tif")
    post_path = os.path.join(data_dir, f"{sector_id}_post.tif")
    
    if os.path.exists(pre_path) and os.path.exists(post_path):
        pre_img, _ = load_geotiff_array(pre_path)
        post_img, _ = load_geotiff_array(post_path)
        return pre_img, post_img
    else:
        # Synthetic data for development
        print(f"Imagery not found for {sector_id}, using synthetic data")
        pre_img = _create_synthetic_imagery(256, 4)
        post_img = _create_synthetic_imagery(256, 4)
        # Add synthetic change to post-fire image
        post_img = post_img * 0.7 + np.random.normal(0, 0.1, post_img.shape)
        return pre_img, post_img


def prepare_training_dataset(data_dir: str = "data/",
                            sectors: List[str] = None,
                            patch_size: int = 32,
                            test_split: float = 0.2) -> Dict:
    """
    Prepare full training dataset from multiple sectors.
    
    Args:
        data_dir: Directory containing sector imagery
        sectors: List of sector IDs to include
        patch_size: Size of patches to extract
        test_split: Fraction for test set
    
    Returns:
        {
            "X_train": features,
            "y_train": labels,
            "X_test": features,
            "y_test": labels,
            "n_samples": int
        }
    """
    if sectors is None:
        sectors = ["ATH-001-A", "ATH-001-B", "ATH-002-A"]
    
    all_features = []
    all_labels = []
    
    for sector in sectors:
        pre_img, post_img = load_sector_imagery(sector, data_dir)
        pairs = create_image_pairs(pre_img, post_img, patch_size=patch_size)
        features, labels = create_training_samples(pairs)
        all_features.append(features)
        all_labels.append(labels)
    
    # Concatenate all sectors
    X = np.vstack(all_features) if all_features else np.array([])
    y = np.hstack(all_labels) if all_labels else np.array([])
    
    # Train/test split
    if len(X) > 0:
        n_samples = len(X)
        indices = np.random.permutation(n_samples)
        split_idx = int(n_samples * (1 - test_split))
        
        train_idx = indices[:split_idx]
        test_idx = indices[split_idx:]
        
        return {
            "X_train": X[train_idx],
            "y_train": y[train_idx],
            "X_test": X[test_idx],
            "y_test": y[test_idx],
            "n_samples": n_samples,
            "n_features": X.shape[1],
        }
    else:
        return {
            "X_train": np.array([]),
            "y_train": np.array([]),
            "X_test": np.array([]),
            "y_test": np.array([]),
            "n_samples": 0,
            "n_features": 0,
        }


if __name__ == "__main__":
    # Quick test
    print("Testing data loader...")
    dataset = prepare_training_dataset(sectors=["ATH-001-A", "ATH-001-B"])
    print(f"✓ Dataset loaded: {dataset['n_samples']} samples, {dataset['n_features']} features")
    print(f"  Train set: {len(dataset['X_train'])} samples")
    print(f"  Test set: {len(dataset['X_test'])} samples")
