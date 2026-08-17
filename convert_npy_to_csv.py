import os
from pathlib import Path

import numpy as np

# Anchor to this script's own directory (not the caller's cwd) so it behaves
# the same regardless of where it's invoked from.
BASE_DIR   = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "trendlens_outputs"

# ── CLIP Embeddings ────────────────────────────────────────────────────────────
npy_one_file_path = OUTPUT_DIR / "embeddings.npy"

if os.path.exists(npy_one_file_path):
    data = np.load(npy_one_file_path)
    np.savetxt(OUTPUT_DIR / "embeddings.csv", data, delimiter=",")
    print(f"✓ Saved → {OUTPUT_DIR / 'embeddings.csv'}")
else:
    print(f"⚠ Skipped embeddings.csv — {npy_one_file_path} not found")

# ── UMAP 2d ────────────────────────────────────────────────────────────
npy_two_file_path = OUTPUT_DIR / "umap_2d.npy"

if os.path.exists(npy_two_file_path):
    data = np.load(npy_two_file_path)
    np.savetxt(OUTPUT_DIR / "umap_2d.csv", data, delimiter=",")
    print(f"✓ Saved → {OUTPUT_DIR / 'umap_2d.csv'}")
else:
    print(f"⚠ Skipped umap_2d.csv — {npy_two_file_path} not found")

# ── UMAP 10d ────────────────────────────────────────────────────────────
npy_three_file_path = OUTPUT_DIR / "umap_10d.npy"

if os.path.exists(npy_three_file_path):
    data = np.load(npy_three_file_path)
    np.savetxt(OUTPUT_DIR / "umap_10d.csv", data, delimiter=",")
    print(f"✓ Saved → {OUTPUT_DIR / 'umap_10d.csv'}")
else:
    print(f"⚠ Skipped umap_10d.csv — {npy_three_file_path} not found")
