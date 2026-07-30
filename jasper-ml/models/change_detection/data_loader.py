"""
data_loader.py — Load and preprocess satellite imagery for model training

This module sits between raw GeoTIFF files on disk and the training pipeline.
Its job is to read pre-fire and post-fire satellite images, slice them into
small overlapping patches, compute spectral change features from each patch
pair, and return a labelled feature matrix ready for the RandomForest classifier.

Typical call sequence:
  1. load_sector_imagery()       — reads the two GeoTIFFs for one sector.
  2. create_image_pairs()        — slices them into (pre, post) patch pairs.
  3. create_training_samples()   — extracts spectral features and assigns labels.
  4. prepare_training_dataset()  — does all of the above for multiple sectors
                                    and returns a ready-to-use train/test split.

If real GeoTIFF files are not yet available (development mode), every function
falls back to synthetic random imagery so the rest of the pipeline can still run.
"""

import numpy as np
from typing import Tuple, List, Dict
import os
from pathlib import Path


def load_geotiff_array(filepath: str) -> Tuple[np.ndarray, Dict]:
    """
    Read a GeoTIFF file from disk and return its pixel data as a NumPy array.

    Uses the `rasterio` library if it is installed.  Falls back to a synthetic
    random image if rasterio is not available (useful for CI environments where
    GDAL dependencies are not installed).

    Args:
        filepath — absolute or relative path to a .tif file.

    Returns:
        pixel_array — float32 array shaped (height, width, bands).
                      Values are raw digital numbers from the GeoTIFF.
        metadata    — dict with geospatial info (CRS, transform, etc.)
                      from rasterio, or an empty dict in synthetic mode.
    """
    try:
        import rasterio
        with rasterio.open(filepath) as src:
            data = src.read()  # rasterio reads as (bands, height, width)
            metadata = src.meta
            # Transpose to (height, width, bands) — the convention used
            # throughout this codebase and by most image processing libraries.
            data = np.transpose(data, (1, 2, 0))
            return data, metadata
    except ImportError:
        print("Warning: rasterio not available, using synthetic data")
        return _create_synthetic_imagery(256, 4), {}


def _create_synthetic_imagery(size: int = 256, bands: int = 4) -> np.ndarray:
    """
    Generate a random satellite image for development and testing.

    The values are uniformly distributed integers in [0, 255] normalised to
    [0, 1] float32, which mimics the range of real reflectance imagery after
    preprocessing.  The fixed random seed ensures the same "image" is produced
    on every run, making test results deterministic.

    Args:
        size  — height and width of the square image in pixels.
        bands — number of spectral bands (4 = Red, Green, Blue, NIR).

    Returns:
        float32 array shaped (size, size, bands) with values in [0, 1].
    """
    np.random.seed(42)  # fixed seed for reproducible synthetic data
    synthetic = np.random.randint(0, 256, (size, size, bands), dtype=np.uint8)
    return synthetic.astype(np.float32) / 255.0


def create_image_pairs(pre_fire_image: np.ndarray,
                      post_fire_image: np.ndarray,
                      patch_size: int = 32,
                      stride: int = 16) -> List[Tuple[np.ndarray, np.ndarray]]:
    """
    Slice a pair of full-scene images into a list of small patch pairs using
    a sliding window.

    A stride smaller than patch_size produces overlapping patches.  For example,
    patch_size=32 and stride=16 means each patch shares half its pixels with
    its neighbours.  This doubles the number of training samples at the cost of
    some redundancy, which is acceptable because the model still sees each unique
    region of the image.

    Patches that would extend beyond the image boundary are discarded (the loop
    stops at `height - patch_size` and `width - patch_size`).

    Args:
        pre_fire_image  — full pre-fire scene, shape (height, width, bands).
        post_fire_image — full post-fire scene, same shape.
        patch_size      — side length (pixels) of each square patch.
        stride          — step size of the sliding window.

    Returns:
        List of (pre_patch, post_patch) tuples, each shaped (patch_size, patch_size, bands).
    """
    patches = []
    height, width = pre_fire_image.shape[:2]

    for i in range(0, height - patch_size, stride):
        for j in range(0, width - patch_size, stride):
            pre_patch = pre_fire_image[i:i+patch_size, j:j+patch_size, :]
            post_patch = post_fire_image[i:i+patch_size, j:j+patch_size, :]

            # Guard against edge patches that came out the wrong size
            if pre_patch.shape == (patch_size, patch_size, pre_fire_image.shape[2]):
                patches.append((pre_patch, post_patch))

    return patches


def compute_spectral_features(pre_patch: np.ndarray,
                             post_patch: np.ndarray) -> np.ndarray:
    """
    Compute an 8-element feature vector that describes how much a patch changed
    between the pre-fire and post-fire images.

    The features are designed to capture different aspects of burn damage:
      - RGB difference: visible colour change (smoke-blackened ground, ash).
      - NDVI difference: vegetation loss (NDVI drops sharply after fire).
      - NIR difference: near-infrared response drops in burned vegetation.
      - Post-fire brightness: burned areas are often brighter in visible bands.
      - Vegetation variability: high std deviation in NDVI suggests patchy burning.
      - Pre/post mean NDVI: baseline and current vegetation health.

    NDVI formula: (NIR - Red) / (NIR + Red + epsilon)
    The epsilon (1e-8) prevents division by zero in dark or shadowed pixels.

    Args:
        pre_patch  — pre-fire image patch, shape (patch_size, patch_size, bands).
        post_patch — post-fire image patch, same shape.

    Returns:
        float32 array of length 8 containing the computed features.
    """
    # Clip to [0, 1] to handle any out-of-range values from normalisation
    pre_patch = np.clip(pre_patch, 0, 1)
    post_patch = np.clip(post_patch, 0, 1)

    # Split into RGB channels (first 3 bands) and NIR (last band).
    # Gracefully handles single-band images by reusing band 0.
    pre_rgb = pre_patch[:, :, :3] if pre_patch.shape[2] >= 3 else pre_patch[:, :, :1]
    post_rgb = post_patch[:, :, :3] if post_patch.shape[2] >= 3 else post_patch[:, :, :1]

    pre_nir = pre_patch[:, :, -1] if pre_patch.shape[2] >= 4 else pre_patch[:, :, 0]
    post_nir = post_patch[:, :, -1] if post_patch.shape[2] >= 4 else post_patch[:, :, 0]

    # Red channel is band 0 in standard RGB-NIR Landsat ordering
    pre_red = pre_patch[:, :, 0]
    post_red = post_patch[:, :, 0]

    # NDVI = (NIR - Red) / (NIR + Red)
    # Values range from -1 (water/bare soil) to +1 (dense vegetation).
    # A large drop from pre to post indicates fire-related vegetation loss.
    pre_ndvi = (pre_nir - pre_red) / (pre_nir + pre_red + 1e-8)
    post_ndvi = (post_nir - post_red) / (post_nir + post_red + 1e-8)

    features = [
        np.mean(np.abs(post_rgb - pre_rgb)),   # overall visible colour change
        np.mean(np.abs(post_ndvi - pre_ndvi)), # vegetation index change (key burn indicator)
        np.mean(np.abs(post_nir - pre_nir)),   # NIR channel change
        np.mean(post_rgb),                     # post-fire brightness
        np.std(post_ndvi),                     # spatial variability of post-fire NDVI
        np.std(pre_ndvi),                      # spatial variability of pre-fire NDVI
        np.mean(post_ndvi),                    # mean post-fire vegetation health
        np.mean(pre_ndvi),                     # mean pre-fire vegetation health (baseline)
    ]

    return np.array(features, dtype=np.float32)


def create_training_samples(image_pairs: List[Tuple[np.ndarray, np.ndarray]],
                           burn_labels: List[int] = None) -> Tuple[np.ndarray, np.ndarray]:
    """
    Convert a list of image patch pairs into a feature matrix and label vector
    suitable for training a scikit-learn classifier.

    If real labels are not provided (burn_labels=None), synthetic labels are
    generated by thresholding the mean absolute pixel change:
      - change > 0.30 → class 2 (High Change / severe burn)
      - change > 0.15 → class 1 (Medium Change / partial burn)
      - otherwise     → class 0 (No Change)

    Args:
        image_pairs — list of (pre_patch, post_patch) tuples.
        burn_labels — optional list of integer labels (0, 1, or 2) aligned
                      with image_pairs.  Provide real labels from field data
                      or expert annotation when available.

    Returns:
        features — float32 array shaped (n_samples, 8).
        labels   — int32 array shaped (n_samples,).
    """
    features_list = []
    labels_list = []

    for idx, (pre_patch, post_patch) in enumerate(image_pairs):
        features = compute_spectral_features(pre_patch, post_patch)
        features_list.append(features)

        if burn_labels is None:
            # Synthetic label: higher spectral change → higher burn category.
            # This is a heuristic — real labels from field surveys would be
            # much more reliable but are not yet available for the ATH sectors.
            change_magnitude = np.mean(np.abs(post_patch - pre_patch))
            if change_magnitude > 0.3:
                label = 2  # High Change (severe burn)
            elif change_magnitude > 0.15:
                label = 1  # Medium Change (moderate burn)
            else:
                label = 0  # No Change (unburned or negligible change)
            labels_list.append(label)
        else:
            labels_list.append(burn_labels[idx])

    features_array = np.array(features_list, dtype=np.float32)
    labels_array = np.array(labels_list, dtype=np.int32)

    return features_array, labels_array


def load_sector_imagery(sector_id: str, data_dir: str = "data/") -> Tuple[np.ndarray, np.ndarray]:
    """
    Load pre-fire and post-fire satellite images for a single sector.

    Looks for files named {sector_id}_pre.tif and {sector_id}_post.tif in
    data_dir.  If either file is missing, falls back to synthetic imagery so
    the training pipeline can still run without real data.

    Args:
        sector_id — e.g. "ATH-001-A".  Used to construct the file names.
        data_dir  — directory that contains the GeoTIFF files.

    Returns:
        (pre_fire_image, post_fire_image) — each shaped (height, width, bands).
    """
    pre_path = os.path.join(data_dir, f"{sector_id}_pre.tif")
    post_path = os.path.join(data_dir, f"{sector_id}_post.tif")

    if os.path.exists(pre_path) and os.path.exists(post_path):
        pre_img, _ = load_geotiff_array(pre_path)
        post_img, _ = load_geotiff_array(post_path)
        return pre_img, post_img
    else:
        # Real imagery not yet available — generate plausible-looking synthetic
        # data so the rest of the pipeline can be exercised.
        print(f"Imagery not found for {sector_id}, using synthetic data")
        pre_img = _create_synthetic_imagery(256, 4)
        post_img = _create_synthetic_imagery(256, 4)
        # Simulate a burn by dimming the post-fire image (multiply by 0.7) and
        # adding Gaussian noise to mimic fire-related spectral change.
        post_img = post_img * 0.7 + np.random.normal(0, 0.1, post_img.shape)
        return pre_img, post_img


def prepare_training_dataset(data_dir: str = "data/",
                            sectors: List[str] = None,
                            patch_size: int = 32,
                            test_split: float = 0.2) -> Dict:
    """
    Build a complete, shuffled, train/test-split dataset from one or more sectors.

    This is the top-level function called by train.py.  It loops over all
    provided sectors, loads imagery, creates patches, extracts features, and
    concatenates everything into a single matrix before splitting.

    The random split uses numpy's permutation rather than sklearn's
    train_test_split so that the caller controls the numpy random state.

    Args:
        data_dir    — directory containing GeoTIFF files.
        sectors     — list of sector IDs to include.  Defaults to the three
                      core ATH sectors if not specified.
        patch_size  — patch side length in pixels.
        test_split  — fraction of samples held out for testing (e.g. 0.2 = 20%).

    Returns:
        Dictionary with keys:
            X_train, y_train — training features and labels.
            X_test,  y_test  — test features and labels.
            n_samples        — total number of patches across all sectors.
            n_features       — number of features per patch (always 8).
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

    # Stack all sectors into one big matrix before splitting.
    # vstack/hstack handle the case where all_features is empty gracefully.
    X = np.vstack(all_features) if all_features else np.array([])
    y = np.hstack(all_labels) if all_labels else np.array([])

    if len(X) > 0:
        n_samples = len(X)
        # Shuffle before splitting so that the test set isn't accidentally all
        # from the last sector loaded.
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
        # Return empty arrays if no data was loaded at all
        return {
            "X_train": np.array([]),
            "y_train": np.array([]),
            "X_test": np.array([]),
            "y_test": np.array([]),
            "n_samples": 0,
            "n_features": 0,
        }


if __name__ == "__main__":
    # Quick smoke test — run directly to verify the loader works end to end
    print("Testing data loader...")
    dataset = prepare_training_dataset(sectors=["ATH-001-A", "ATH-001-B"])
    print(f"✓ Dataset loaded: {dataset['n_samples']} samples, {dataset['n_features']} features")
    print(f"  Train set: {len(dataset['X_train'])} samples")
    print(f"  Test set: {len(dataset['X_test'])} samples")
