"""
generate_clusters.py
----------------------------------------------------------------------
Step 4 of the TrendLens pipeline: HDBSCAN Visual Trend Cluster Discovery.

Run AFTER generate_umap.py.

Inputs  (trendlens_outputs/):
    - umap_10d.npy      (N x 10, float32)  -- HDBSCAN clustering input
    - umap_2d.npy       (N x 2,  float32)  -- visualization
    - metadata.csv      (N x 25)

Outputs (trendlens_outputs/):
    - metadata_clustered.csv     metadata.csv + ['cluster', 'cluster_prob']
    - cluster_summary.csv        per-cluster size / engagement / category stats
    - cluster_representatives.json   top-probability image per cluster
    - cluster_scatter.png        umap_2d scatter coloured by cluster
    - cluster_representatives.png    image grid of cluster representatives
----------------------------------------------------------------------
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import hdbscan
import matplotlib.pyplot as plt
from PIL import Image

# ----------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------
OUTPUT_DIR = Path("trendlens_outputs")

UMAP_10D_PATH = OUTPUT_DIR / "umap_10d.npy"
UMAP_2D_PATH = OUTPUT_DIR / "umap_2d.npy"
METADATA_PATH = OUTPUT_DIR / "metadata.csv"

MIN_CLUSTER_SIZE = 512   # ~0.14% of 69,226 rows -- tune via sweep, see notes below
MIN_SAMPLES = 10
METRIC = "euclidean"     # umap_10d is already a UMAP output -> Euclidean space
RANDOM_STATE = 42        # kept for consistency with the rest of the pipeline

# ----------------------------------------------------------------------
# Load inputs
# ----------------------------------------------------------------------
emb_10d = np.load(UMAP_10D_PATH)
emb_2d = np.load(UMAP_2D_PATH)
meta = pd.read_csv(METADATA_PATH)

assert emb_10d.shape[0] == len(meta), "umap_10d row count mismatch with metadata.csv"
assert emb_2d.shape[0] == len(meta), "umap_2d row count mismatch with metadata.csv"
print(f"Loaded {len(meta)} rows | umap_10d {emb_10d.shape} | umap_2d {emb_2d.shape}")

# ----------------------------------------------------------------------
# HDBSCAN clustering
# ----------------------------------------------------------------------
clusterer = hdbscan.HDBSCAN(
    min_cluster_size=MIN_CLUSTER_SIZE,
    min_samples=MIN_SAMPLES,
    metric=METRIC,
    cluster_selection_method="eom",
    prediction_data=True,
)
labels = clusterer.fit_predict(emb_10d)
probs = clusterer.probabilities_

meta["cluster"] = labels
meta["cluster_prob"] = probs

n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
n_noise = int((labels == -1).sum())
print(f"Clusters found : {n_clusters}")
print(f"Noise points   : {n_noise} ({n_noise / len(labels):.1%})")

# ----------------------------------------------------------------------
# Per-cluster summary (size, dominant category, engagement stats)
# ----------------------------------------------------------------------
summary_rows = []
for c in sorted(set(labels)):
    if c == -1:
        continue
    sub = meta[meta["cluster"] == c]
    dominant_cat = sub["category"].mode().iloc[0]
    summary_rows.append({
        "cluster": int(c),
        "size": len(sub),
        "dominant_category": dominant_cat,
        "category_purity": float((sub["category"] == dominant_cat).mean()),
        "mean_engagement_rate": float(sub["engagement_rate"].mean()),
        "viral_rate": float(sub["is_viral"].mean()),
        "mean_trend_duration_days": float(sub["trend_duration_days"].mean()),
        "avg_membership_prob": float(sub["cluster_prob"].mean()),
    })

cluster_summary = pd.DataFrame(summary_rows).sort_values("size", ascending=False)
cluster_summary.to_csv(OUTPUT_DIR / "cluster_summary.csv", index=False)

# ----------------------------------------------------------------------
# Representative image per cluster (highest membership probability)
# ----------------------------------------------------------------------
representatives = {}
for c in sorted(set(labels)):
    if c == -1:
        continue
    sub = meta[meta["cluster"] == c]
    top_row = sub.loc[sub["cluster_prob"].idxmax()]
    representatives[int(c)] = {
        "image_path": top_row["image_path"],
        "category": top_row["category"],
        "size": int(len(sub)),
        "mean_engagement_rate": float(sub["engagement_rate"].mean()),
    }

with open(OUTPUT_DIR / "cluster_representatives.json", "w") as f:
    json.dump(representatives, f, indent=2)

# ----------------------------------------------------------------------
# Save clustered metadata (feeds Step 5: Temporal Trend Tracking)
# ----------------------------------------------------------------------
meta.to_csv(OUTPUT_DIR / "metadata_clustered.csv", index=False)

# ----------------------------------------------------------------------
# Visualization 1: umap_2d scatter coloured by cluster
# ----------------------------------------------------------------------
plt.figure(figsize=(10, 8))
noise_mask = labels == -1
plt.scatter(emb_2d[noise_mask, 0], emb_2d[noise_mask, 1],
            c="lightgray", s=4, label="noise")
plt.scatter(emb_2d[~noise_mask, 0], emb_2d[~noise_mask, 1],
            c=labels[~noise_mask], cmap="tab20", s=6)
plt.title(f"HDBSCAN Visual Trend Clusters — {n_clusters} clusters, "
          f"{n_noise / len(labels):.1%} noise")
plt.legend()
plt.savefig(OUTPUT_DIR / "cluster_scatter.png", dpi=150, bbox_inches="tight")
plt.close()

# ----------------------------------------------------------------------
# Visualization 2: representative image grid
# ----------------------------------------------------------------------
n = len(representatives)
if n > 0:
    cols = min(5, n)
    rows = (n + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(cols * 3, rows * 3))
    axes = np.array(axes).reshape(-1)

    for ax, (c, info) in zip(axes, representatives.items()):
        try:
            img = Image.open(info["image_path"])
            ax.imshow(img)
        except Exception:
            ax.text(0.5, 0.5, "missing", ha="center")
        ax.set_title(
            f"#{c} | {info['category']} (n={info['size']}, "
            f"eng={info['mean_engagement_rate']:.2f}%)",
            fontsize=8,
        )
        ax.axis("off")

    for ax in axes[n:]:
        ax.axis("off")

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "cluster_representatives.png", dpi=150)
    plt.close()

print("\nDone. New files in trendlens_outputs/:")
print(" - metadata_clustered.csv")
print(" - cluster_summary.csv")
print(" - cluster_representatives.json")
print(" - cluster_scatter.png")
print(" - cluster_representatives.png")