"""
synthetic_data.py
-----------------
DATA-INTEGRITY FIX for the legacy metadata.

The legacy pipeline assigned timestamps with a category-biased Gaussian
design whose explicit goal was to *force* Rising / Stable / Declining
lifecycles (categories were mapped to era-biased distributions). That rigs
the trend experiment and is unacceptable under the project's integrity
rules.

This module replaces those timestamps with **neutral, deterministic,
uniform** ones over the original span (2010–2019). Clusters will therefore
show only noise-level temporal variation — the honest result for synthetic
demo data. Nothing derived from these timestamps is a research finding.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

import config

START_TS = pd.Timestamp("2010-01-01", tz="UTC")
END_TS = pd.Timestamp("2019-12-31", tz="UTC")
TIMESTAMP_SOURCE_COLUMN = "timestamp_source"
TIMESTAMP_SOURCE = "neutral-synthetic"


def honest_timestamps(
    n: int,
    seed: int | None = None,
    start: pd.Timestamp | None = None,
    end: pd.Timestamp | None = None,
) -> pd.Series:
    """
    Generate ``n`` deterministic pseudo-uniform UTC timestamps within
    ``[start, end]``. Same seed => identical output.
    """
    seed = int(seed) if seed is not None else int(config.RANDOM_SEED)
    start = start or START_TS
    end = end or END_TS
    rng = np.random.default_rng(seed)
    total_s = int((end - start).total_seconds())
    offsets = rng.integers(0, total_s, size=n, dtype="int64")
    return pd.Series(start + pd.to_timedelta(offsets, unit="s"))


def neutralize_metadata(
    df: pd.DataFrame,
    seed: int | None = None,
    out_path: Path | None = None,
) -> pd.DataFrame:
    """
    Return a copy of ``df`` with neutral synthetic timestamps and a
    ``timestamp_source`` provenance column, persisted to parquet.
    Row order and index are preserved.
    """
    out = df.copy()
    out["timestamp"] = honest_timestamps(len(out), seed=seed)
    out[TIMESTAMP_SOURCE_COLUMN] = TIMESTAMP_SOURCE
    out_path = Path(out_path) if out_path else config.METADATA_PARQUET_PATH
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(out_path, index=False)
    return out


def load_canonical_metadata(path: Path | None = None) -> pd.DataFrame:
    """Load the canonical (neutralized) metadata parquet."""
    path = Path(path) if path else config.METADATA_PARQUET_PATH
    if not path.exists():
        raise FileNotFoundError(
            f"Canonical metadata not found at {path}. Run "
            "`python -m src.synthetic_data` first."
        )
    return pd.read_parquet(path)


if __name__ == "__main__":
    from src.data_loader import apply_dataset_config, load_metadata, sample_posts

    print(f"Loading legacy metadata from {config.METADATA_CSV_PATH} ...")
    df = load_metadata()
    out = apply_dataset_config(df, config.DATASET_CONFIG)
    print(f"Rows: {len(out):,} | sample post_id order: "
          f"{out['post_id'].iloc[:3].tolist()}")

    canon = neutralize_metadata(out, seed=config.RANDOM_SEED)
    print(f"Wrote canonical metadata: {config.METADATA_PARQUET_PATH}")
    print("Old timestamp range: "
          f"{df['timestamp'].min()} .. {df['timestamp'].max()}")
    print("New timestamp range: "
          f"{canon['timestamp'].min()} .. {canon['timestamp'].max()}")

    # Rebuild the 5K manifest from the neutralised frame (same seed/order).
    manifest = sample_posts(canon, n=config.N_IMAGES, seed=config.RANDOM_SEED)
    emb_meta = pd.read_parquet(config.EMBEDDINGS_DIR / "metadata.parquet")
    same = manifest["post_id"].tolist() == emb_meta["post_id"].tolist()
    assert same, "Manifest order changed — embeddings alignment would break!"
    print("Manifest order identical to existing embedding metadata:", same)

    manifest.to_parquet(config.PROCESSED_DIR / "sample_metadata.parquet", index=False)
    manifest.to_parquet(config.EMBEDDINGS_DIR / "metadata.parquet", index=False)
    print("Updated sample manifest + embedding metadata (neutral timestamps).")
    print("\n" + config.SYNTHETIC_DATA_WARNING)
