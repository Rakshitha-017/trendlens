"""
preprocessing.py
----------------
Robust image loading for the embedding pipeline.

* corrupt-image handling (load with Pillow, verify, convert to RGB)
* configurable resize
* batched loading with progress bars
* deterministic validation cache (avoid re-scanning 69K files)
* memory-safe: one image loaded at a time, never the whole dataset
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Callable, Iterable, Iterator

import numpy as np
from PIL import Image, UnidentifiedImageError
from tqdm.auto import tqdm

import config


# ──────────────────────────────────────────────────────────────────────────
# Single-image helpers
# ──────────────────────────────────────────────────────────────────────────
def resolve_path(path: str | Path, image_root: Path | None = None) -> Path:
    """
    Join a dataset path onto the image root.

    Falls back to the project-root-relative path when the prefixed path
    does not exist (handles datasets whose paths already carry a prefix
    such as ``train/...``).
    """
    p = Path(path)
    if p.is_absolute():
        return p
    root = image_root or config.IMAGE_ROOT
    candidate = root / p
    if candidate.exists():
        return candidate
    root_rel = config.ROOT / p
    return root_rel


def load_image(
    path: str | Path,
    image_root: Path | None = None,
    convert: str = "RGB",
    resize: tuple[int, int] | None = None,
) -> Image.Image:
    """
    Load and validate an image.

    Raises ``OSError`` for unreadable/corrupt files and
    ``UnidentifiedImageError`` for non-images, so callers can skip them.
    """
    full = resolve_path(path, image_root)
    img = Image.open(full)
    img.load()  # force full decode to surface corruption
    if convert is not None:
        img = img.convert(convert)
    if resize is not None:
        img = img.resize(resize, Image.BILINEAR)
    return img


def validate_image(
    path: str | Path, image_root: Path | None = None
) -> tuple[bool, str]:
    """Return (is_valid, reason) for one image path. Never raises."""
    try:
        load_image(path, image_root)
        return True, ""
    except FileNotFoundError:
        return False, "missing"
    except (UnidentifiedImageError, OSError, ValueError):
        return False, "corrupt"


def image_dimensions(
    path: str | Path, image_root: Path | None = None
) -> tuple[int, int] | None:
    """Return (width, height) without fully decoding the pixel data."""
    try:
        with Image.open(resolve_path(path, image_root)) as img:
            return img.size
    except (FileNotFoundError, UnidentifiedImageError, OSError, ValueError):
        return None


# ──────────────────────────────────────────────────────────────────────────
# Batch utilities
# ──────────────────────────────────────────────────────────────────────────
class ImageBatchLoader:
    """
    Iterate over many image paths in batches, yielding valid PIL images.

    Corrupt/missing images are skipped and counted. Validation results are
    cached to a JSON file so repeated runs skip already-known-bad files.
    """

    def __init__(
        self,
        paths: Iterable[str],
        batch_size: int = 64,
        image_root: Path | None = None,
        resize: tuple[int, int] | None = None,
        cache_validated: bool | None = None,
        cache_path: Path | None = None,
        show_progress: bool = True,
    ):
        self.paths = list(paths)
        self.batch_size = int(batch_size)
        self.image_root = image_root
        self.resize = resize
        self.cache_validated = (
            bool(config.CACHE_VALIDATED_PATHS)
            if cache_validated is None
            else bool(cache_validated)
        )
        self.cache_path = cache_path or (config.PROCESSED_DIR / "validated_images.json")
        self.show_progress = show_progress
        self.bad: dict[str, str] = {}
        self.loaded_count = 0

    # -- validation cache -------------------------------------------------
    def _load_cache(self) -> dict[str, str]:
        if not self.cache_validated or not self.cache_path.exists():
            return {}
        try:
            return json.loads(self.cache_path.read_text())
        except (json.JSONDecodeError, OSError):
            return {}

    def _save_cache(self) -> None:
        if not self.cache_validated:
            return
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(json.dumps(self.bad, indent=1))

    def _is_bad(self, p: str, cache: dict[str, str]) -> str | None:
        if p in cache:
            return cache[p]
        if not self.cache_validated:
            return None
        ok, reason = validate_image(p, self.image_root)
        if not ok:
            return reason
        return None

    # -- core iteration ---------------------------------------------------
    def iter_images(self) -> Iterator[Image.Image]:
        cache = self._load_cache()
        iterator = tqdm(self.paths, desc="Loading images", disable=not self.show_progress)
        for i in range(0, len(self.paths), self.batch_size):
            batch = self.paths[i : i + self.batch_size]
            for p in batch:
                reason = self._is_bad(p, cache)
                if reason:
                    self.bad[p] = reason
                    continue
                try:
                    img = load_image(p, self.image_root, resize=self.resize)
                except (FileNotFoundError, UnidentifiedImageError, OSError, ValueError):
                    self.bad[p] = "corrupt"
                    continue
                self.loaded_count += 1
                yield img
            iterator.update(len(batch))
        self._save_cache()

    def load_all(self) -> list[Image.Image]:
        """Load every valid image into memory (only for small subsets)."""
        return list(self.iter_images())

    def as_arrays(
        self, dtype: str = "uint8", normalize: bool = False
    ) -> np.ndarray:
        """Stack loaded images as a single NumPy array (N, H, W, C)."""
        arrays = [np.asarray(img, dtype=dtype) for img in self.iter_images()]
        if not arrays:
            return np.zeros((0,), dtype=dtype)
        out = np.stack(arrays, axis=0)
        if normalize:
            out = out.astype("float32") / 255.0
        return out


def sample_image_dimensions(
    paths: Iterable[str],
    image_root: Path | None = None,
    n: int = 16,
    seed: int | None = None,
) -> dict[str, tuple[int, int]]:
    """Return width×height for a deterministic sample of images."""
    seed = int(seed) if seed is not None else int(config.RANDOM_SEED)
    rng = random.Random(seed)
    sample = list(paths)
    if len(sample) > n:
        rng.shuffle(sample)
        sample = sample[:n]
    result: dict[str, tuple[int, int]] = {}
    for p in sample:
        dim = image_dimensions(p, image_root)
        if dim:
            result[str(p)] = dim
    return result


# ──────────────────────────────────────────────────────────────────────────
# Export helpers
# ──────────────────────────────────────────────────────────────────────────
def export_preprocess_manifest(
    df,
    image_root: Path | None = None,
    output: Path | None = None,
) -> Path:
    """
    Attach a validation column (valid_image) to the metadata frame and save
    the ready-to-embed subset to ``data/processed/valid_images.parquet``.
    """
    image_root = image_root or config.IMAGE_ROOT
    rows = []
    for p in tqdm(df["image_path"], desc="Validating images"):
        ok, _ = validate_image(p, image_root)
        rows.append(ok)
    out_df = df.copy()
    out_df["valid_image"] = rows
    output = output or (config.PROCESSED_DIR / "valid_images.parquet")
    out_df.to_parquet(output, index=False)
    return output
