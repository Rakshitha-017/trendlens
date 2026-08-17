"""
generate_temporal_trends.py
----------------------------------------------------------------------
Step 5 of the TrendLens pipeline: Temporal Trend Tracking.

Run AFTER generate_clusters.py.

METHODOLOGY:
    For each post, we have:
      - timestamp         : when the photo was posted (category-biased
                            Gaussian over 2010-2019)
      - trend_active_until: when the trend expires (engagement-driven)

    Together these define an "active window" per post:
        [timestamp  →  trend_active_until]

    For each quarter we count how many posts are simultaneously active.
    The quarter with the highest overlap count = PEAK QUARTER.

LIFECYCLE CLASSIFICATION (slope-based):
    Rather than using peak position alone (which caused all clusters to
    be labeled Declining when their visual mix happened to peak early),
    we compute the **normalised growth slope** of the activity curve:

        slope = mean(last_third) - mean(first_third)
                ─────────────────────────────────────
                         max(curve) + ε

    Then:
        slope >  RISE_THRESHOLD  → Rising   (growing toward end)
        slope < -DECL_THRESHOLD  → Declining (heavy early activity)
        otherwise                → Stable

    This detects emerging trends even if their absolute activity is low,
    and correctly labels visually-mixed clusters that happen to have
    uniform cross-era spread as Stable.

Inputs  (trendlens_outputs/):
    - metadata_clustered.csv

Outputs (trendlens_outputs/):
    - trend_metrics.csv            per-cluster peak + lifecycle stats
    - trend_graphs/                activity curve PNG per cluster
    - trend_summary.png            top 20 Rising trends overview
----------------------------------------------------------------------
"""

from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

# ----------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------
# Anchor to this script's own directory (not the caller's cwd) so it behaves
# the same regardless of where it's invoked from.
BASE_DIR    = Path(__file__).parent
OUTPUT_DIR  = BASE_DIR / "trendlens_outputs"
GRAPHS_DIR  = OUTPUT_DIR / "trend_graphs"
GRAPHS_DIR.mkdir(parents=True, exist_ok=True)

METADATA_PATH  = OUTPUT_DIR / "metadata_clustered.csv"
MIN_SIZE       = 50   # skip tiny clusters

# Lifecycle classification uses RELATIVE percentile ranking across clusters.
# This ensures meaningful Rising/Stable/Declining splits even when the
# dataset's synthetic timestamps push all activity curves to peak early.
#
# We rank every cluster by its normalised slope AND by its recency fraction,
# then combine them into a single score and split into tertiles:
#   Top    33 %  → Rising
#   Middle 34 %  → Stable
#   Bottom 33 %  → Declining
#
# This guarantees a ~33 / 34 / 33 split regardless of the absolute slope values.
RISE_PERCENTILE = 66.7   # above this combined-score percentile → Rising
DECL_PERCENTILE = 33.3   # below this percentile → Declining

# ----------------------------------------------------------------------
# 1. Load data
# ----------------------------------------------------------------------
meta = pd.read_csv(METADATA_PATH)
meta = meta[meta["cluster"] != -1].copy()

# Parse both time columns — strip timezone for simplicity
meta["ts_start"] = pd.to_datetime(
    meta["timestamp"], utc=True
).dt.tz_localize(None)

meta["ts_end"] = pd.to_datetime(
    meta["trend_active_until"], utc=True
).dt.tz_localize(None)

print(f"Loaded {len(meta):,} clustered images across "
      f"{meta['cluster'].nunique()} clusters\n")

# ----------------------------------------------------------------------
# 2. Build quarterly activity curves
#    For each quarter Q, count posts where ts_start <= Q <= ts_end
# ----------------------------------------------------------------------
quarters = pd.date_range(
    start="2010-01-01", end="2021-01-01", freq="QS"
)
N_Q = len(quarters)

def activity_curve(cluster_df):
    """Count active posts per quarter for one cluster."""
    counts = []
    for q in quarters:
        q_end = q + pd.offsets.QuarterEnd(1)
        n = ((cluster_df["ts_start"] <= q_end) &
             (cluster_df["ts_end"]   >= q)).sum()
        counts.append(int(n))
    return pd.Series(counts, index=quarters)

# ----------------------------------------------------------------------
# 3. Compute slope-based lifecycle and per-cluster metrics
# ----------------------------------------------------------------------
# ── Pass 1: compute raw metrics for every qualifying cluster ──────────────
raw_records = []

for cluster_id, group in meta.groupby("cluster"):
    if len(group) < MIN_SIZE:
        continue

    curve       = activity_curve(group)
    curve_arr   = curve.values.astype(float)
    curve_max   = curve_arr.max()

    peak_idx     = int(curve_arr.argmax())
    peak_quarter = quarters[peak_idx]
    peak_count   = int(curve_arr[peak_idx])

    third = N_Q // 3
    first_mean = curve_arr[:third].mean()
    last_mean  = curve_arr[-third:].mean()

    norm_denom   = max(curve_max, 1.0)
    slope        = (last_mean - first_mean) / norm_denom
    recency_frac = curve_arr[-third:].sum() / max(curve_arr.sum(), 1)

    # Active window
    active_quarters = quarters[curve > 0]
    window_start    = str(active_quarters[0].date())  if len(active_quarters) > 0 else "N/A"
    window_end      = str(active_quarters[-1].date()) if len(active_quarters) > 0 else "N/A"

    dominant_cat  = group["category"].mode().iloc[0]
    mean_eng      = float(group["engagement_rate"].mean())
    viral_rate    = float(group["is_viral"].mean())
    mean_duration = float(group["trend_duration_days"].mean())
    total_posts   = int(len(group))

    raw_records.append({
        "cluster":                  cluster_id,
        "dominant_category":        dominant_cat,
        "total_posts":              total_posts,
        "peak_quarter":             str(peak_quarter.date()),
        "peak_active_posts":        peak_count,
        "slope_normalised":         float(slope),
        "recency_fraction":         float(recency_frac),
        "trend_window_start":       window_start,
        "trend_window_end":         window_end,
        "mean_engagement_rate":     round(mean_eng, 4),
        "viral_rate":               round(viral_rate, 4),
        "mean_trend_duration_days": round(mean_duration, 2),
    })

# ── Pass 2: relative percentile lifecycle classification ──────────────────
# Combine slope and recency into a single trend-growth score, then split
# into Rising / Stable / Declining using percentile tertiles.
import pandas as _pd_inner
_tmp = _pd_inner.DataFrame(raw_records)

# Rank-normalise each signal to [0,1]
_tmp["slope_rank"]   = _tmp["slope_normalised"].rank(pct=True)
_tmp["recency_rank"] = _tmp["recency_fraction"].rank(pct=True)
# Weighted combined score (slope carries 60 %, recency 40 %)
_tmp["growth_score"] = 0.60 * _tmp["slope_rank"] + 0.40 * _tmp["recency_rank"]

rise_cut = np.percentile(_tmp["growth_score"], RISE_PERCENTILE)
decl_cut = np.percentile(_tmp["growth_score"], DECL_PERCENTILE)

def _classify(score):
    if score >= rise_cut:
        return "Rising"
    elif score <= decl_cut:
        return "Declining"
    return "Stable"

_tmp["lifecycle_stage"] = _tmp["growth_score"].apply(_classify)

# Build final records list with lifecycle labels
records = []
for _, r in _tmp.iterrows():
    records.append({
        "cluster":                  int(r["cluster"]),
        "dominant_category":        r["dominant_category"],
        "total_posts":              int(r["total_posts"]),
        "peak_quarter":             r["peak_quarter"],
        "peak_active_posts":        int(r["peak_active_posts"]),
        "lifecycle_stage":          r["lifecycle_stage"],
        "slope_normalised":         round(r["slope_normalised"], 4),
        "recency_fraction":         round(r["recency_fraction"], 4),
        "trend_window_start":       r["trend_window_start"],
        "trend_window_end":         r["trend_window_end"],
        "mean_engagement_rate":     r["mean_engagement_rate"],
        "viral_rate":               r["viral_rate"],
        "mean_trend_duration_days": r["mean_trend_duration_days"],
    })

trend_df = pd.DataFrame(records).sort_values(
    ["lifecycle_stage", "mean_engagement_rate"],
    ascending=[True, False]
)
trend_df.to_csv(OUTPUT_DIR / "trend_metrics.csv", index=False)

# Print summary
counts = trend_df["lifecycle_stage"].value_counts()
print("Trend lifecycle classification:")
for stage in ["Rising", "Stable", "Declining"]:
    print(f"  {stage:10s}: {counts.get(stage, 0)} clusters")
print()

# ----------------------------------------------------------------------
# 4. Per-cluster activity curve graphs
# ----------------------------------------------------------------------
color_map = {
    "Rising":   "#2ecc71",
    "Stable":   "#3498db",
    "Declining":"#e74c3c",
}

for row in trend_df.itertuples():
    cid      = row.cluster
    stage    = row.lifecycle_stage
    color    = color_map[stage]
    group    = meta[meta["cluster"] == cid]
    curve    = activity_curve(group)

    fig, ax1 = plt.subplots(figsize=(11, 4))

    # Activity curve (main)
    ax1.fill_between(quarters, curve.values, alpha=0.25, color=color)
    ax1.plot(quarters, curve.values, color=color, linewidth=2,
             label="Active posts (overlap count)")
    ax1.set_ylabel("Simultaneously Active Posts", fontsize=10)
    ax1.yaxis.set_major_locator(mticker.MaxNLocator(integer=True))

    # Mark peak
    peak_q = pd.Timestamp(row.peak_quarter)
    peak_v = int(curve[quarters == peak_q].iloc[0]) if any(quarters == peak_q) else 0
    ax1.axvline(peak_q, color="black", linewidth=1.2,
                linestyle="--", alpha=0.6, label=f"Peak: {row.peak_quarter}")
    ax1.annotate(
        f"PEAK\n{row.peak_quarter}",
        xy=(peak_q, peak_v),
        xytext=(15, 10), textcoords="offset points",
        fontsize=8, color="black",
        arrowprops=dict(arrowstyle="->", color="black", lw=0.8),
    )

    # Shade the "rising window" (last third)
    third_dt = quarters[-(len(quarters) // 3)]
    ax1.axvspan(third_dt, quarters[-1], alpha=0.06, color="#2ecc71",
                label="Recency window (last third)")

    # Engagement rate overlay
    eng_ts = (
        group.assign(
            qtr=group["ts_start"].dt.to_period("Q").dt.to_timestamp()
        )
        .groupby("qtr")["engagement_rate"].mean()
        .reindex(quarters, fill_value=np.nan)
    )
    ax2 = ax1.twinx()
    ax2.plot(quarters, eng_ts.values, color="gray", linewidth=1,
             linestyle="--", alpha=0.6, label="Avg engagement rate (%)")
    ax2.set_ylabel("Avg Engagement Rate (%)", fontsize=9, color="gray")
    ax2.tick_params(axis="y", labelcolor="gray")

    ax1.set_title(
        f"Cluster {cid}  |  {row.dominant_category}  |  {stage}  "
        f"[slope={row.slope_normalised:+.3f}, recency={row.recency_fraction:.2f}]\n"
        f"Peak: {row.peak_quarter}  |  "
        f"Window: {row.trend_window_start} → {row.trend_window_end}  |  "
        f"Engagement: {row.mean_engagement_rate:.2f}%  |  "
        f"Viral: {row.viral_rate:.1%}  |  n={row.total_posts:,}",
        fontsize=9,
    )
    ax1.set_xlabel("Quarter")

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2,
               loc="upper left", fontsize=8)

    plt.tight_layout()
    plt.savefig(
        GRAPHS_DIR / f"cluster_{cid:03d}_{stage.lower()}.png",
        dpi=120,
    )
    plt.close()

print(f"Per-cluster graphs saved → {GRAPHS_DIR.resolve()}")

# ----------------------------------------------------------------------
# 5. Summary chart — top 20 Rising clusters
# ----------------------------------------------------------------------
rising = trend_df[trend_df["lifecycle_stage"] == "Rising"].nlargest(
    20, "mean_engagement_rate"
)

if len(rising) > 0:
    fig, ax = plt.subplots(figsize=(12, 7))
    labels  = [
        f"C{r.cluster} · {r.dominant_category} (peak {r.peak_quarter})"
        for r in rising.itertuples()
    ]
    bars = ax.barh(
        labels,
        rising["mean_engagement_rate"],
        color="#2ecc71", edgecolor="white", linewidth=0.5,
    )
    ax.bar_label(bars, fmt="%.2f%%", padding=4, fontsize=8)
    ax.set_xlabel("Mean Engagement Rate (%)")
    ax.set_title(
        "Top 20 Rising Visual Trends\n"
        "Ranked by Mean Engagement Rate — Peak Quarter Shown",
        fontsize=12,
    )
    ax.invert_yaxis()
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "trend_summary.png", dpi=150)
    plt.close()
    print("Summary chart saved → trend_summary.png")
else:
    print("⚠  No Rising clusters found — check slope thresholds.")

# ----------------------------------------------------------------------
# 6. Console summary
# ----------------------------------------------------------------------
print("\nTop 5 Rising clusters:")
rising_top5 = trend_df[trend_df["lifecycle_stage"] == "Rising"]
if not rising_top5.empty:
    print(
        rising_top5[["cluster", "dominant_category", "peak_quarter",
                      "slope_normalised", "mean_engagement_rate",
                      "viral_rate", "total_posts"]]
        .head()
        .to_string(index=False)
    )
else:
    print("  (none found)")

print("\nTop 5 Stable clusters:")
stable_top5 = trend_df[trend_df["lifecycle_stage"] == "Stable"]
if not stable_top5.empty:
    print(
        stable_top5[["cluster", "dominant_category", "peak_quarter",
                      "slope_normalised", "mean_engagement_rate",
                      "viral_rate", "total_posts"]]
        .head()
        .to_string(index=False)
    )
else:
    print("  (none found)")

print("\nTop 5 Declining clusters:")
declining_top5 = trend_df[trend_df["lifecycle_stage"] == "Declining"]
if not declining_top5.empty:
    print(
        declining_top5[["cluster", "dominant_category", "peak_quarter",
                         "slope_normalised", "mean_engagement_rate",
                         "viral_rate", "total_posts"]]
        .head()
        .to_string(index=False)
    )
else:
    print("  (none found)")

print("\nDone. New files in trendlens_outputs/:")
print("  - trend_metrics.csv")
print("  - trend_summary.png")
print(f"  - trend_graphs/  ({len(trend_df)} cluster graphs)")