"""
predict_popularity.py
----------------------------------------------------------------------
Step 6 of the TrendLens pipeline: Post-Level Popularity Prediction.

Run AFTER generate_temporal_trends.py.

METHODOLOGY:
    Predicts per-post popularity (likes + comments) using three
    feature groups — as specified in the pipeline design:

      1. CLIP EMBEDDINGS  (512-d visual features from embeddings.npy)
      2. CAPTION FEATURES (BERT text features from tags string → CLS
                          token PCA'd to 64-d)
      3. ENGAGEMENT METRICS (follower_count, category, timestamp, geo)

    Target : log1p(likes + comments)  — log-transform stabilises the
             heavy-tailed engagement distribution; predictions are
             back-transformed for human-readable reporting.

    Model  : LightGBM Regressor
    Eval   : 5-fold cross-validation → R², MAE (log-scale + original),
             RMSE

Inputs  (trendlens_outputs/):
    - embeddings.npy          (N × 512, CLIP visual features, float32)
    - metadata_clustered.csv  (N rows with likes, comments, tags, …)

Outputs (trendlens_outputs/):
    - popularity_model_regression.pkl      trained LightGBM model
    - popularity_bert_pca.pkl              PCA + encoders for inference
    - popularity_metrics.json             CV + train metrics
    - popularity_predictions.csv          FULL per-sample predictions (all
                                           SAMPLE_SIZE rows, incl. `cluster`
                                           and post-level `pred_engagement_rate`)
    - popularity_cluster_predictions.csv  predictions aggregated to cluster
                                           level -- this is what
                                           generate_captions.py consumes
    - feature_importance.png              top-20 feature importance
    - actual_vs_predicted.png             scatter: actual vs predicted
----------------------------------------------------------------------
"""

import json
import pickle
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.model_selection import KFold, cross_validate
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
from sklearn.preprocessing import LabelEncoder
import lightgbm as lgb
import torch
from transformers import BertTokenizer, BertModel

warnings.filterwarnings("ignore")

# -----------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------
# Anchor to the script's own directory (not the caller's cwd) so this
# script behaves the same no matter where it's invoked from -- matches
# generate_metadata.py / generate_embeddings.py.
BASE_DIR     = Path(__file__).parent
OUTPUT_DIR   = BASE_DIR / "trendlens_outputs"
RANDOM_STATE = 42
N_FOLDS      = 5
SAMPLE_SIZE  = 10_000    # posts to sample (stratified by category)
BERT_PCA_DIM = 64        # PCA components for BERT CLS embeddings
MAX_BERT_LEN = 64        # max tokens for tag strings
BERT_BATCH   = 64

LGBM_PARAMS = {
    "n_estimators":      500,
    "learning_rate":     0.05,
    "num_leaves":        63,
    "min_child_samples": 20,
    "subsample":         0.8,
    "colsample_bytree":  0.8,
    "random_state":      RANDOM_STATE,
    "verbose":           -1,
    "n_jobs":            -1,
}

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device: {device}")

# -----------------------------------------------------------------------
# 1. Load inputs
# -----------------------------------------------------------------------
print("=" * 60)
print("Step 6 — Post-Level Popularity Prediction Model")
print("=" * 60)

print("\n[1/6] Loading embeddings and metadata …")
embeddings_full = np.load(OUTPUT_DIR / "embeddings.npy")   # (N, 512)

meta_path = OUTPUT_DIR / "metadata_clustered.csv"
if not meta_path.exists():
    meta_path = OUTPUT_DIR / "metadata.csv"
    print(f"  ⚠ metadata_clustered.csv not found — using {meta_path.name}")

meta_full = pd.read_csv(meta_path)
N_TOTAL   = len(meta_full)
assert embeddings_full.shape[0] == N_TOTAL, (
    f"Row mismatch: embeddings {embeddings_full.shape[0]} vs metadata {N_TOTAL}"
)
print(f"  Loaded {N_TOTAL:,} rows  |  embeddings shape: {embeddings_full.shape}")

# Whether cluster-level output can be produced downstream (needs `cluster`
# column, which only exists in metadata_clustered.csv). generate_captions.py
# needs this to attach predicted engagement rate to each cluster.
HAS_CLUSTER = "cluster" in meta_full.columns
if not HAS_CLUSTER:
    print("  ⚠ No `cluster` column in metadata — cluster-level popularity "
          "predictions will be skipped (run generate_clusters.py first for "
          "full pipeline output).")

# -----------------------------------------------------------------------
# 2. Sample posts (stratified by category)
# -----------------------------------------------------------------------
print(f"\n[2/6] Sampling {SAMPLE_SIZE:,} posts (stratified by category) …")
rng = np.random.default_rng(RANDOM_STATE)

meta_full["_row_idx"] = np.arange(N_TOTAL)
cats   = meta_full["category"].unique()
per_cat = max(1, SAMPLE_SIZE // len(cats))

sampled_idx = []
for cat in cats:
    cat_idx = meta_full.index[meta_full["category"] == cat].tolist()
    n_take  = min(per_cat, len(cat_idx))
    chosen  = rng.choice(cat_idx, size=n_take, replace=False)
    sampled_idx.extend(chosen.tolist())

# Fill remainder
remaining = SAMPLE_SIZE - len(sampled_idx)
if remaining > 0:
    all_idx    = set(range(N_TOTAL))
    unused_idx = list(all_idx - set(sampled_idx))
    extra      = rng.choice(unused_idx, size=min(remaining, len(unused_idx)), replace=False)
    sampled_idx.extend(extra.tolist())

sampled_idx = sorted(set(sampled_idx))
meta    = meta_full.iloc[sampled_idx].copy().reset_index(drop=True)
emb_sub = embeddings_full[sampled_idx]   # (SAMPLE_SIZE, 512)
print(f"  Sample size: {len(meta):,}  |  embeddings: {emb_sub.shape}")

# -----------------------------------------------------------------------
# 3. Feature Engineering
# -----------------------------------------------------------------------
print("\n[3/6] Engineering features …")

# ── A. Target: log1p(likes + comments) ───────────────────────────────
y = np.log1p(
    meta["likes"].fillna(0).clip(lower=0) +
    meta["comments"].fillna(0).clip(lower=0)
).values.astype(np.float32)

# ── B. Engagement metadata features ──────────────────────────────────
meta["_ts"]        = pd.to_datetime(meta["timestamp"], errors="coerce")
meta["post_hour"]  = meta["_ts"].dt.hour.fillna(12).astype(float)
meta["post_month"] = meta["_ts"].dt.month.fillna(6).astype(float)
meta["post_year"]  = meta["_ts"].dt.year.fillna(2015).astype(float)

# Cyclic encoding
meta["hour_sin"]  = np.sin(2 * np.pi * meta["post_hour"]  / 24)
meta["hour_cos"]  = np.cos(2 * np.pi * meta["post_hour"]  / 24)
meta["month_sin"] = np.sin(2 * np.pi * meta["post_month"] / 12)
meta["month_cos"] = np.cos(2 * np.pi * meta["post_month"] / 12)

meta["log_followers"] = np.log1p(meta["follower_count"].fillna(0).clip(lower=0))
meta["has_geo"]       = meta["geo_lat"].notna().astype(float)
meta["log_views"]     = np.log1p(meta["views"].fillna(0).clip(lower=0))

# Category one-hot
le_cat  = LabelEncoder()
cat_enc = le_cat.fit_transform(meta["category"].fillna("unknown"))
cat_dummies = np.eye(len(le_cat.classes_), dtype=np.float32)[cat_enc]
cat_names   = [f"cat_{c}" for c in le_cat.classes_]

META_COLS = ["log_followers", "has_geo", "hour_sin", "hour_cos",
             "month_sin", "month_cos", "log_views", "post_year"]
X_meta = meta[META_COLS].fillna(0).values.astype(np.float32)
X_meta = np.hstack([X_meta, cat_dummies])   # (N, 8 + n_cats)
print(f"  Engagement metadata features: {X_meta.shape[1]} columns")

# ── C. BERT caption features from tags ───────────────────────────────
print("  Loading BERT (bert-base-uncased) for tag/caption text features …")
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
bert      = BertModel.from_pretrained("bert-base-uncased").eval().to(device)

def parse_tags(t):
    if pd.isna(t):
        return ""
    try:
        import json as _j
        lst = _j.loads(t)
        return " ".join(lst) if isinstance(lst, list) else str(t)
    except Exception:
        return str(t)

tag_texts = meta["tags"].apply(parse_tags).tolist()
print(f"  Encoding {len(tag_texts):,} tag strings with BERT …")

bert_vecs = []
with torch.no_grad():
    for i in range(0, len(tag_texts), BERT_BATCH):
        batch = tag_texts[i : i + BERT_BATCH]
        enc   = tokenizer(
            batch, padding=True, truncation=True,
            max_length=MAX_BERT_LEN, return_tensors="pt"
        ).to(device)
        out   = bert(**enc)
        cls   = out.last_hidden_state[:, 0, :].cpu().float().numpy()  # (B, 768)
        bert_vecs.append(cls)
        if (i // BERT_BATCH) % 20 == 0:
            print(f"    BERT batch {i // BERT_BATCH + 1}/"
                  f"{(len(tag_texts)-1)//BERT_BATCH+1}")

X_bert_raw = np.vstack(bert_vecs)   # (N, 768)
print(f"  BERT features raw: {X_bert_raw.shape}")

print(f"  Fitting PCA ({BERT_PCA_DIM}-d) on BERT features …")
pca    = PCA(n_components=BERT_PCA_DIM, random_state=RANDOM_STATE)
X_bert = pca.fit_transform(X_bert_raw).astype(np.float32)
print(f"  BERT PCA explained variance: {pca.explained_variance_ratio_.sum():.2%}")

with open(OUTPUT_DIR / "popularity_bert_pca.pkl", "wb") as f:
    pickle.dump({
        "pca":               pca,
        "label_encoder_cat": le_cat,
        "meta_cols":         META_COLS,
    }, f)
print("  → Saved popularity_bert_pca.pkl")

# ── D. Concatenate all feature groups ────────────────────────────────
#   [CLIP 512-d] + [BERT PCA 64-d] + [metadata 8+n_cats-d]
X = np.hstack([emb_sub, X_bert, X_meta]).astype(np.float32)

n_clip = emb_sub.shape[1]
n_bert = X_bert.shape[1]
n_meta = X_meta.shape[1]

print(f"\n  Feature matrix: {X.shape}")
print(f"    CLIP embeddings  : {n_clip}")
print(f"    BERT (PCA-{BERT_PCA_DIM})   : {n_bert}")
print(f"    Engagement meta  : {n_meta}")
print(f"    TOTAL            : {X.shape[1]}")

feat_names = (
    [f"clip_{i}" for i in range(n_clip)] +
    [f"bert_pc{i}" for i in range(n_bert)] +
    META_COLS + cat_names
)

# -----------------------------------------------------------------------
# 4. 5-fold Cross-Validation
# -----------------------------------------------------------------------
print("\n[4/6] 5-fold cross-validation …")
kf  = KFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_STATE)
reg = lgb.LGBMRegressor(**LGBM_PARAMS)

cv_results = cross_validate(
    reg, X, y, cv=kf,
    scoring=["r2", "neg_mean_absolute_error", "neg_root_mean_squared_error"],
    return_train_score=False,
    n_jobs=1,
)
cv_r2   = float(np.mean(cv_results["test_r2"]))
cv_mae  = float(-np.mean(cv_results["test_neg_mean_absolute_error"]))
cv_rmse = float(-np.mean(cv_results["test_neg_root_mean_squared_error"]))

print(f"  CV R²   = {cv_r2:.4f}")
print(f"  CV MAE  = {cv_mae:.4f}  (log-scale)")
print(f"  CV RMSE = {cv_rmse:.4f}  (log-scale)")

# Back-transform: convert log-scale MAE to approximate original-scale error
y_mean_bt = float(np.expm1(y).mean())
print(f"  Mean actual (likes+comments): {y_mean_bt:.1f}")

# -----------------------------------------------------------------------
# 5. Full-data fit + train metrics
# -----------------------------------------------------------------------
print("\n[5/6] Fitting final model on full sample …")
reg.fit(X, y)
y_pred     = reg.predict(X)
train_r2   = r2_score(y, y_pred)
train_mae  = mean_absolute_error(y, y_pred)
train_rmse = np.sqrt(mean_squared_error(y, y_pred))

print(f"  Train R²   = {train_r2:.4f}")
print(f"  Train MAE  = {train_mae:.4f}  (log-scale)")
print(f"  Train RMSE = {train_rmse:.4f}  (log-scale)")

# -----------------------------------------------------------------------
# 6. Save all outputs
# -----------------------------------------------------------------------
print("\n[6/6] Saving outputs …")

# ── Model pickle ────────────────────────────────────────────────────
with open(OUTPUT_DIR / "popularity_model_regression.pkl", "wb") as f:
    pickle.dump({
        "model":         reg,
        "feature_names": feat_names,
        "n_clip":        n_clip,
        "n_bert":        n_bert,
        "n_meta":        n_meta,
        "meta_cols":     META_COLS,
        "cat_names":     cat_names,
    }, f)
print("  → popularity_model_regression.pkl")

# ── Metrics JSON ─────────────────────────────────────────────────────
metrics = {
    "model":        "LightGBM Regressor (post-level)",
    "target":       "log1p(likes + comments)",
    "level":        "post",
    "n_samples":    len(meta),
    "n_features":   int(X.shape[1]),
    "feature_groups": {
        "clip_embeddings": n_clip,
        "bert_pca":        n_bert,
        "engagement_meta": n_meta,
    },
    "cv_folds":  N_FOLDS,
    "cv_r2":     round(cv_r2,   4),
    "cv_mae":    round(cv_mae,  4),
    "cv_rmse":   round(cv_rmse, 4),
    "train_r2":  round(train_r2,   4),
    "train_mae": round(train_mae,  4),
    "train_rmse":round(train_rmse, 4),
}
with open(OUTPUT_DIR / "popularity_metrics.json", "w") as f:
    json.dump(metrics, f, indent=2)
print("  → popularity_metrics.json")

# ── Per-sample predictions CSV (FULL sample, not truncated) ──────────
pred_cols = ["post_id", "category", "likes", "comments",
             "follower_count", "engagement_rate", "reach"]
if HAS_CLUSTER:
    pred_cols = ["cluster"] + pred_cols
pred_df = meta[pred_cols].copy()

pred_df["target_log1p"]          = np.round(y, 4)
pred_df["predicted_log1p"]       = np.round(y_pred, 4)
pred_df["actual_likes_comments"] = (
    meta["likes"].fillna(0) + meta["comments"].fillna(0)
).astype(int)
pred_df["pred_likes_comments"] = np.round(np.expm1(y_pred)).astype(int)
pred_df["residual_log"]        = np.round(y - y_pred, 4)

# Post-level predicted engagement rate, using the same definition as
# generate_metadata.py's `engagement_rate` -- (likes+comments+reposts)/reach*100.
# We don't predict reposts separately, so this is a slight underestimate of
# the true engagement_rate, but it's on the same scale and comparable
# across posts/clusters.
safe_reach = pred_df["reach"].clip(lower=1)
pred_df["pred_engagement_rate"] = np.round(
    pred_df["pred_likes_comments"] / safe_reach * 100, 4
)

# Save the FULL sample (all SAMPLE_SIZE rows), not just a 200-row preview --
# a preview silently discarded 98% of predictions and made cluster-level
# aggregation impossible.
pred_df.to_csv(OUTPUT_DIR / "popularity_predictions.csv", index=False)
print(f"  → popularity_predictions.csv  ({len(pred_df):,} rows, full sample)")

# ── Cluster-level aggregation ──────────────────────────────────────────
# This is the file generate_captions.py actually consumes to attach a
# predicted engagement rate to each cluster.
if HAS_CLUSTER:
    cluster_pred = (
        pred_df.groupby("cluster")
        .agg(
            pred_engagement_rate=("pred_engagement_rate", "mean"),
            mean_actual_engagement_rate=("engagement_rate", "mean"),
            n_samples=("post_id", "count"),
        )
        .reset_index()
    )
    cluster_pred["pred_engagement_rate"] = cluster_pred["pred_engagement_rate"].round(4)
    cluster_pred["mean_actual_engagement_rate"] = cluster_pred["mean_actual_engagement_rate"].round(4)
    cluster_pred.to_csv(OUTPUT_DIR / "popularity_cluster_predictions.csv", index=False)
    print(f"  → popularity_cluster_predictions.csv  ({len(cluster_pred):,} clusters)")
else:
    print("  ⚠ Skipped popularity_cluster_predictions.csv (no `cluster` column available)")

# ── Feature Importance Plot ──────────────────────────────────────────
importances = reg.feature_importances_
top_n   = 20
top_idx = np.argsort(importances)[::-1][:top_n]
top_names = [feat_names[i] for i in top_idx]
top_vals  = importances[top_idx]

def colour_by_group(name):
    if name.startswith("clip_"):  return "#3498db"
    if name.startswith("bert_"):  return "#9b59b6"
    if name.startswith("cat_"):   return "#e67e22"
    return "#2ecc71"

colours = [colour_by_group(n) for n in top_names]

fig, ax = plt.subplots(figsize=(10, 8))
ax.barh(range(top_n), top_vals[::-1], color=colours[::-1], alpha=0.85)
ax.set_yticks(range(top_n))
ax.set_yticklabels(top_names[::-1], fontsize=8)
ax.set_xlabel("Feature Importance (LightGBM split gain)", fontsize=9)
ax.set_title(
    f"Popularity Prediction — Top {top_n} Features\n"
    f"[CLIP {n_clip}-d  |  BERT-PCA {n_bert}-d  |  Engagement Meta {n_meta}-d]\n"
    f"CV R² = {cv_r2:.3f}  |  Train R² = {train_r2:.3f}",
    fontsize=10, fontweight="bold",
)
from matplotlib.patches import Patch
legend_elements = [
    Patch(facecolor="#3498db", label=f"CLIP embeddings ({n_clip}-d)"),
    Patch(facecolor="#9b59b6", label=f"BERT tag features PCA ({n_bert}-d)"),
    Patch(facecolor="#e67e22", label="Category (one-hot)"),
    Patch(facecolor="#2ecc71", label="Engagement metadata"),
]
ax.legend(handles=legend_elements, fontsize=8, loc="lower right")
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "feature_importance.png", dpi=150, bbox_inches="tight")
plt.close()
print("  → feature_importance.png")

# ── Actual vs Predicted Scatter ──────────────────────────────────────
sample_mask = rng.choice(len(y), size=min(2000, len(y)), replace=False)
y_plot  = y[sample_mask]
p_plot  = y_pred[sample_mask]
cats_plot  = meta["category"].iloc[sample_mask].values
uniq_cats  = sorted(set(cats_plot))
cmap       = plt.get_cmap("tab20")
c_idx      = {c: i / max(len(uniq_cats) - 1, 1) for i, c in enumerate(uniq_cats)}

fig2, ax2 = plt.subplots(figsize=(8, 6))
for cat in uniq_cats:
    mask = cats_plot == cat
    ax2.scatter(
        y_plot[mask], p_plot[mask],
        c=[cmap(c_idx[cat])], label=cat, s=15, alpha=0.6, edgecolors="none"
    )
mn = min(y_plot.min(), p_plot.min())
mx = max(y_plot.max(), p_plot.max())
ax2.plot([mn, mx], [mn, mx], "k--", lw=1, alpha=0.5, label="Perfect prediction")
ax2.set_xlabel("Actual  log1p(likes + comments)", fontsize=10)
ax2.set_ylabel("Predicted  log1p(likes + comments)", fontsize=10)
ax2.set_title(
    f"Post-Level Popularity Prediction\n"
    f"CV R² = {cv_r2:.3f}  |  CV MAE = {cv_mae:.3f}  |  n = {len(y):,}",
    fontsize=10
)
ax2.legend(fontsize=6, ncol=3, loc="upper left")
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "actual_vs_predicted.png", dpi=150)
plt.close()
print("  → actual_vs_predicted.png")

# ── Console Summary ──────────────────────────────────────────────────
print("\n" + "=" * 60)
print("Step 6 Complete — Post-Level Popularity Prediction")
print("=" * 60)
print(f"  Target          : log1p(likes + comments)  [post-level]")
print(f"  Features used:")
print(f"    CLIP visual embeddings : {n_clip}-d")
print(f"    BERT tag features (PCA): {n_bert}-d")
print(f"    Engagement metadata    : {n_meta} columns")
print(f"    TOTAL                  : {X.shape[1]} features")
print(f"  CV R²           : {cv_r2:.4f}")
print(f"  CV MAE          : {cv_mae:.4f}  (log-scale)")
print(f"  CV RMSE         : {cv_rmse:.4f}  (log-scale)")
print(f"  Train R²        : {train_r2:.4f}")

# Sample predictions
print("\n  Sample back-transformed predictions (likes+comments):")
for actual, pred in zip(np.expm1(y[:8]), np.expm1(y_pred[:8])):
    print(f"    actual={actual:.0f}  pred={pred:.0f}")
