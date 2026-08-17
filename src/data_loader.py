"""
data_loader.py
--------------
Loading, schema inspection, dataset reporting and deterministic sampling
for the SMPD images and their (synthetic demo) engagement metadata.

Column names are never hard-coded here — the canonical field names come
from ``config.DATASET_CONFIG``.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

import config

_CANONICAL_FIELDS = [
    "image_path",
    "caption",
    "timestamp",
    "likes",
    "comments",
    "post_id",
    "user_id",
]

# canonical field → DATASET_CONFIG key
_CONFIG_KEY = {"image_path": "image_column"}


# ──────────────────────────────────────────────────────────────────────────
# Loading
# ──────────────────────────────────────────────────────────────────────────
def load_path_list(path: Path | None = None) -> pd.DataFrame:
    """Load the raw image-path index (train_img_filepath.txt)."""
    path = Path(path) if path else config.IMAGE_PATH_LIST
    if not path.exists():
        raise FileNotFoundError(f"Path index not found: {path}")
    with open(path, "r") as fh:
        paths = [line.strip() for line in fh if line.strip()]
    return pd.DataFrame({"image_path": paths})


def load_metadata(path: Path | None = None) -> pd.DataFrame:
    """Load the engagement metadata CSV/parquet for the current run."""
    path = Path(path) if path else config.METADATA_CSV_PATH
    if not path.exists():
        raise FileNotFoundError(
            f"Metadata not found at {path}. Run the legacy pipeline or point "
            "config.METADATA_CSV_PATH at your dataset."
        )
    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    return pd.read_csv(path)


def apply_dataset_config(df: pd.DataFrame, cfg: dict | None = None) -> pd.DataFrame:
    """
    Map a dataset's raw column names onto TrendLens canonical fields using
    ``config.DATASET_CONFIG``. Non-canonical columns are preserved.

    Returns a copy; rows/order are unchanged so index alignment to
    embeddings is preserved.
    """
    cfg = cfg or config.DATASET_CONFIG
    out = df.copy()

    for canonical in _CANONICAL_FIELDS:
        source_col = cfg.get(_CONFIG_KEY.get(canonical, canonical + "_column"))
        if source_col is None:
            if canonical not in out.columns:
                out[canonical] = np.nan
            continue
        if source_col not in out.columns:
            raise ValueError(
                f"Column '{source_col}' (for '{canonical}') not found in dataset. "
                f"Available columns: {list(out.columns)}"
            )
        out[canonical] = out[source_col]

    # Normalise timestamp to tz-aware UTC pandas datetime (naive = UTC).
    if "timestamp" in out.columns and pd.api.types.is_string_dtype(out["timestamp"]):
        out["timestamp"] = pd.to_datetime(out["timestamp"], errors="coerce", utc=True)

    # Store the per-field mapping for provenance.
    out.attrs["dataset_config"] = cfg
    return out


def parse_tags(tags: Any) -> list[str]:
    """Parse a tags cell which may be a JSON string, list, or NaN."""
    if isinstance(tags, list):
        return [str(t) for t in tags]
    if isinstance(tags, str):
        try:
            return [str(t) for t in json.loads(tags)]
        except (json.JSONDecodeError, TypeError):
            return [t.strip() for t in tags.split(",") if t.strip()]
    return []


# ──────────────────────────────────────────────────────────────────────────
# Dataset report
# ──────────────────────────────────────────────────────────────────────────
def dataset_report(
    df: pd.DataFrame,
    cfg: dict | None = None,
    image_root: Path | None = None,
    sample: int | None = 16,
) -> dict[str, Any]:
    """
    Print a clear, complete dataset report and return the stats dict.

    Covers: post/user/image counts, date range, missing values, caption &
    timestamp coverage, engagement statistics, sampled image dimensions and
    a posts-over-time distribution.
    """
    cfg = cfg or config.DATASET_CONFIG
    image_root = image_root or config.IMAGE_ROOT
    out = apply_dataset_config(df, cfg)

    stats: dict[str, Any] = {
        "n_posts": int(len(out)),
        "n_images": int(out["image_path"].nunique()),
        "n_users": int(out["user_id"].nunique()),
        "synthetic_metadata": bool((out.get("is_synthetic", pd.Series([False])).astype(bool)).all())
        if "is_synthetic" in out.columns
        else None,
    }

    lines: list[str] = ["=" * 70, "TRENDLENS — DATASET REPORT", "=" * 70]
    lines.append(f"Posts              : {stats['n_posts']:,}")
    lines.append(f"Unique images      : {stats['n_images']:,}")
    lines.append(f"Unique users       : {stats['n_users']:,}")

    # Date range
    ts = out["timestamp"] if "timestamp" in out.columns else pd.Series(dtype=object)
    ts_ok = pd.notna(ts)
    stats["timestamp_coverage"] = float(ts_ok.mean())
    lines.append(f"Timestamp coverage : {stats['timestamp_coverage']:.1%}")
    if ts_ok.any():
        t = ts.dropna()
        stats["date_min"] = t.min().isoformat()
        stats["date_max"] = t.max().isoformat()
        lines.append(f"Date range         : {t.min().isoformat()} → {t.max().isoformat()}")
    else:
        stats["date_min"] = stats["date_max"] = None
        lines.append("Date range         : NONE (no usable timestamps)")

    # Missing values
    missing = out.isna().mean().sort_values(ascending=False)
    missing = missing[missing > 0]
    lines.append("\nMissing-value rate (nonzero):")
    if len(missing) == 0:
        lines.append("  none")
    else:
        for col, rate in missing.items():
            lines.append(f"  {col:<28} {rate:.1%}")

    # Caption coverage (may be entirely absent)
    caption_cov = (
        float(out["caption"].notna().mean()) if "caption" in out.columns else 0.0
    )
    stats["caption_coverage"] = caption_cov
    lines.append(f"\nCaption coverage   : {caption_cov:.1%}  "
                 "(caption_column in DATASET_CONFIG is "
                 f"{'set' if cfg.get('caption_column') else 'None/absent'})")

    # Engagement statistics
    if {"likes", "comments"}.issubset(out.columns):
        eng = out["likes"].fillna(0) + out["comments"].fillna(0)
        stats["engagement"] = {
            "mean": float(eng.mean()),
            "median": float(eng.median()),
            "max": float(eng.max()),
            "p90": float(eng.quantile(0.90)),
        }
        lines.append("\nEngagement (likes+comments):")
        lines.append(f"  mean   : {stats['engagement']['mean']:.1f}")
        lines.append(f"  median : {stats['engagement']['median']:.1f}")
        lines.append(f"  p90    : {stats['engagement']['p90']:.1f}")
        lines.append(f"  max    : {stats['engagement']['max']:.1f}")

    # Image dimensions on a sample of existing files
    if sample and image_root is not None:
        import src.preprocessing as pp

        stats["image_dimensions"] = pp.sample_image_dimensions(
            out["image_path"], image_root, n=sample
        )
        lines.append("\nSampled image dimensions:")
        for path, dim in stats["image_dimensions"].items():
            lines.append(f"  {path}  {dim}")

    # Distribution over time
    if ts_ok.any():
        t = ts.dropna()
        per_year = t.dt.year.value_counts().sort_index()
        t_naive = t.dt.tz_localize(None) if t.dt.tz is not None else t
        per_month = t_naive.dt.to_period("M").value_counts().sort_index()
        stats["posts_per_year"] = {str(k): int(v) for k, v in per_year.items()}
        stats["posts_per_month"] = {str(k): int(v) for k, v in per_month.items()}
        lines.append("\nPosts per year:")
        for k, v in per_year.items():
            lines.append(f"  {k}  {v:,}")

    if stats["synthetic_metadata"]:
        lines.append("\n" + "!" * 70)
        lines.append("! " + config.SYNTHETIC_DATA_WARNING)
        lines.append("!" * 70)

    lines.append("=" * 70)
    print("\n".join(lines))
    return stats


# ──────────────────────────────────────────────────────────────────────────
# Deterministic sampling
# ──────────────────────────────────────────────────────────────────────────
def sample_posts(
    df: pd.DataFrame,
    n: int | None = None,
    seed: int | None = None,
    by_user: bool = True,
) -> pd.DataFrame:
    """
    Deterministically sample ``n`` posts.

    * ``by_user=True`` (default): round-robin one post per user first, then
      fill the remainder — keeps user diversity at small subset sizes.
    * ``by_user=False``: plain seeded random sample.
    """
    n = int(n) if n else int(config.N_IMAGES)
    seed = int(seed) if seed is not None else int(config.RANDOM_SEED)
    if len(df) <= n:
        return df.sample(frac=1.0, random_state=seed)

    if not by_user:
        return df.sample(n=n, random_state=seed)

    rng = random.Random(seed)
    user_col = config.DATASET_CONFIG["user_id_column"] or "user_id"
    users = list(df[user_col].unique())
    rng.shuffle(users)

    remaining = set(df.index.tolist())
    grouped: dict[Any, list[int]] = {}
    for idx, u in zip(df.index, df[user_col]):
        grouped.setdefault(u, []).append(idx)

    # Round 1: one post per shuffled user (only from currently-unseen indices).
    round1: list[int] = []
    for u in users:
        for idx in grouped.get(u, []):
            if idx in remaining:
                round1.append(idx)
                remaining.discard(idx)
                break

    # Round 2: shuffle the rest and top up.
    rest = sorted(remaining)
    rng.shuffle(rest)

    chosen = round1[:n]
    for idx in rest:
        if len(chosen) >= n:
            break
        chosen.append(idx)

    return df.loc[chosen].copy().reset_index(drop=True)


def save_sample_manifest(df: pd.DataFrame, path: Path | None = None) -> Path:
    """Persist a sampled subset so expensive later stages can reuse it."""
    path = Path(path) if path else config.PROCESSED_DIR / "sample_metadata.parquet"
    df.to_parquet(path, index=False)
    return path
