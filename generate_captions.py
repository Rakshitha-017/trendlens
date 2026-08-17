"""
generate_captions.py
----------------------------------------------------------------------
Step 7 of the TrendLens pipeline: Cluster Captioning using BLIP-2.

Run AFTER generate_temporal_trends.py (and optionally after
predict_popularity.py).

METHODOLOGY:
    Two-stage captioning per cluster:

    Stage A — BLIP-2 Visual Captioning
        Loads Salesforce/blip2-opt-2.7b (or blip2-flan-t5-xl for
        CPU fallback). Runs inference on the representative image
        (highest cluster-probability member) of each cluster.
        Produces a genuine vision-language description.

    Stage B — Metadata Template Enrichment
        Augments the BLIP-2 caption with structured metadata:
          - Dominant & secondary content categories
          - Lifecycle stage + peak quarter
          - Engagement & virality statistics
          - Top hashtags extracted from cluster posts
          - Geographic hotspots
          - Trend duration characteristics

    The final cluster record stores:
        blip2_caption    — raw BLIP-2 output
        caption          — template-enriched full description
        (+ all metadata fields)

HARDWARE:
    GPU (CUDA): uses blip2-opt-2.7b in 8-bit mode (~6 GB VRAM)
    CPU only  : uses blip2-flan-t5-xl (lighter) at full precision;
                expect ~60 s / image

Inputs  (trendlens_outputs/):
    - metadata_clustered.csv
    - cluster_summary.csv
    - trend_metrics.csv
    - popularity_cluster_predictions.csv  (optional; cluster-level, from
      predict_popularity.py) -- falls back to aggregating
      popularity_predictions.csv on the fly if the cluster-level file
      isn't present (e.g. an older predict_popularity.py run)
    - actual representative images on disk

Outputs (trendlens_outputs/):
    - cluster_captions.json      structured captions + metadata
    - captions_report.md         human-readable markdown report
----------------------------------------------------------------------
"""

import json
import warnings
from pathlib import Path
from collections import Counter

import numpy as np
import pandas as pd
import torch
from PIL import Image
from transformers import (
    Blip2Processor, Blip2ForConditionalGeneration,
    BlipProcessor, BlipForConditionalGeneration,
)

warnings.filterwarnings("ignore")

# -----------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------
BASE_DIR    = Path(__file__).parent
OUTPUT_DIR  = BASE_DIR / "trendlens_outputs"
MIN_TAG_FREQ = 2

# Model selection based on hardware.
# GPU : BLIP-2 (Salesforce/blip2-opt-2.7b) in 8-bit — best quality.
# CPU : BLIP-1 (Salesforce/blip-image-captioning-base, ~900 MB) —
#        lightweight, fast, and reliable without a GPU.
USE_GPU = torch.cuda.is_available()
if USE_GPU:
    BLIP_MODEL_ID = "Salesforce/blip2-opt-2.7b"
    USE_BLIP2     = True
    LOAD_IN_8BIT  = True
    DTYPE         = torch.float16
    print("[BLIP-2] GPU detected — loading blip2-opt-2.7b in 8-bit mode")
else:
    BLIP_MODEL_ID = "Salesforce/blip-image-captioning-base"
    USE_BLIP2     = False
    LOAD_IN_8BIT  = False
    DTYPE         = torch.float32
    print("[BLIP] CPU mode — loading blip-image-captioning-base (~900 MB)")

# -----------------------------------------------------------------------
# 1. Load pipeline inputs
# -----------------------------------------------------------------------
print("=" * 60)
print("Step 7 — Cluster Captioning (BLIP-2)")
print("=" * 60)

meta_c    = pd.read_csv(OUTPUT_DIR / "metadata_clustered.csv")
cluster_s = pd.read_csv(OUTPUT_DIR / "cluster_summary.csv")
trend_m   = pd.read_csv(OUTPUT_DIR / "trend_metrics.csv")

# Prefer the cluster-level predictions file (written by predict_popularity.py).
# Fall back to aggregating the post-level file on the fly for compatibility
# with older predict_popularity.py runs that only wrote post-level rows.
cluster_pred_path = OUTPUT_DIR / "popularity_cluster_predictions.csv"
post_pred_path    = OUTPUT_DIR / "popularity_predictions.csv"

pred_df = None
if cluster_pred_path.exists():
    pred_df = pd.read_csv(cluster_pred_path)
elif post_pred_path.exists():
    post_pred_df = pd.read_csv(post_pred_path)
    if {"cluster", "pred_engagement_rate"}.issubset(post_pred_df.columns):
        pred_df = (
            post_pred_df.groupby("cluster")["pred_engagement_rate"]
            .mean()
            .round(4)
            .reset_index()
        )
        print("  ⚠ popularity_cluster_predictions.csv not found — aggregated "
              "cluster-level predictions from popularity_predictions.csv instead.")
    else:
        print("  ⚠ popularity_predictions.csv has no `cluster`/`pred_engagement_rate` "
              "columns — skipping predicted-engagement enrichment.")

# Filter noise cluster
meta_c = meta_c[meta_c["cluster"] != -1].copy()

def parse_tags(tag_str):
    if pd.isna(tag_str):
        return []
    try:
        return json.loads(tag_str)
    except Exception:
        return [t.strip() for t in str(tag_str).split(",") if t.strip()]

meta_c["tags_list"] = meta_c["tags"].apply(parse_tags)

print(f"\nLoaded {len(meta_c):,} clustered posts across "
      f"{meta_c['cluster'].nunique()} clusters")

# Merge cluster-level tables
cluster_df = pd.merge(cluster_s, trend_m, on="cluster", how="inner",
                      suffixes=("_summary", "_trend"))

# Resolve duplicate columns
for col, prefer in [
    ("dominant_category",        "_trend"),
    ("mean_engagement_rate",     "_trend"),
    ("viral_rate",               "_summary"),
    ("mean_trend_duration_days", "_summary"),
]:
    src_s = f"{col}_summary"
    src_t = f"{col}_trend"
    if src_s in cluster_df.columns and src_t in cluster_df.columns:
        cluster_df[col] = cluster_df[src_t if prefer == "_trend" else src_s]
        cluster_df.drop(columns=[src_s, src_t], errors="ignore", inplace=True)

if pred_df is not None and "pred_engagement_rate" in pred_df.columns:
    cluster_df = pd.merge(
        cluster_df,
        pred_df[["cluster", "pred_engagement_rate"]],
        on="cluster", how="left"
    )

print(f"Cluster table: {cluster_df.shape[0]} rows × {cluster_df.shape[1]} cols\n")

# -----------------------------------------------------------------------
# 2. Load BLIP-2 model
# -----------------------------------------------------------------------
print(f"[BLIP] Loading processor + model: {BLIP_MODEL_ID} …")
print("  (This may take a minute on first run — model will cache)")

if USE_BLIP2:
    blip_processor = Blip2Processor.from_pretrained(BLIP_MODEL_ID)
    blip_model     = Blip2ForConditionalGeneration.from_pretrained(
        BLIP_MODEL_ID,
        load_in_8bit=True,
        device_map="auto",
        torch_dtype=DTYPE,
    )
else:
    blip_processor = BlipProcessor.from_pretrained(BLIP_MODEL_ID)
    blip_model     = BlipForConditionalGeneration.from_pretrained(
        BLIP_MODEL_ID,
        torch_dtype=DTYPE,
    ).to("cpu")

blip_model.eval()
print("[BLIP] Model ready.\n")


@torch.no_grad()
def generate_blip2_caption(image_path: str, prompt: str = None) -> str:
    """
    Run BLIP/BLIP-2 on a single image and return the generated caption.
    Falls back to an empty string on any error.
    """
    try:
        img = Image.open(image_path).convert("RGB")
        if USE_BLIP2:
            # BLIP-2 path — VQA prompt
            if prompt:
                inputs = blip_processor(images=img, text=prompt, return_tensors="pt")
            else:
                inputs = blip_processor(images=img, return_tensors="pt")
            out = blip_model.generate(**inputs, max_new_tokens=60, num_beams=4, min_length=8)
            caption = blip_processor.decode(out[0], skip_special_tokens=True)
        else:
            # BLIP-1 path (CPU) — unconditional captioning works best
            inputs = blip_processor(images=img, return_tensors="pt").to("cpu")
            out = blip_model.generate(**inputs, max_new_tokens=50, num_beams=4)
            caption = blip_processor.decode(out[0], skip_special_tokens=True)
        return caption.strip()
    except Exception as exc:
        print(f"    ⚠ BLIP caption failed for {image_path}: {exc}")
        return ""


# -----------------------------------------------------------------------
# 3. Caption template helpers (Stage B)
# -----------------------------------------------------------------------
LIFECYCLE_PHRASES = {
    "Rising":    "rapidly gaining traction",
    "Stable":    "maintaining steady engagement",
    "Declining": "having peaked earlier",
}

ENGAGEMENT_TIERS = [(3.5, "exceptional"), (2.5, "strong"),
                    (1.5, "moderate"), (0.0, "low")]

def engagement_tier(rate: float) -> str:
    for threshold, label in ENGAGEMENT_TIERS:
        if rate >= threshold:
            return label
    return "minimal"


VIRAL_TIERS = [(0.40, "highly viral"), (0.25, "frequently viral"),
               (0.12, "occasionally viral"), (0.0, "rarely viral")]

def viral_tier(rate: float) -> str:
    for threshold, label in VIRAL_TIERS:
        if rate >= threshold:
            return label
    return "rarely viral"


DURATION_TIERS = [(60, "long-lasting (months)"), (30, "sustained (weeks to a month)"),
                  (14, "short-cycle (1–2 weeks)"), (0, "ephemeral (days)")]

def duration_tier(days: float) -> str:
    for threshold, label in DURATION_TIERS:
        if days >= threshold:
            return label
    return "ephemeral"


def format_quarter(q_str: str) -> str:
    try:
        dt = pd.Timestamp(q_str)
        q  = (dt.month - 1) // 3 + 1
        return f"Q{q} {dt.year}"
    except Exception:
        return str(q_str)


def top_cities(group: pd.DataFrame, n: int = 3) -> list:
    cities = group["geo_city"].dropna()
    return [c for c, _ in Counter(cities).most_common(n)] if not cities.empty else []


def top_tags(group: pd.DataFrame, n: int = 8) -> list:
    all_tags = []
    for tags in group["tags_list"]:
        all_tags.extend(tags)
    counts  = Counter(all_tags)
    generic = {"photo", "image", "picture", "photography", "flickr"}
    return [f"#{t}" for t, c in counts.most_common(20)
            if c >= MIN_TAG_FREQ and t.lower() not in generic][:n]


def secondary_categories(group: pd.DataFrame, dominant: str, n: int = 2) -> list:
    cats = group["category"].value_counts()
    cats = cats[cats.index != dominant]
    return list(cats.head(n).index)


def make_title(cluster_id, dominant_cat, lifecycle, peak_q, engagement_rate):
    eng = engagement_tier(engagement_rate).title()
    life_adj = {
        "Rising":   "🚀 Rising",
        "Stable":   "📊 Stable",
        "Declining":"📉 Declining"
    }.get(lifecycle, lifecycle)
    return (f"Cluster {cluster_id} — {dominant_cat.title()} · "
            f"{life_adj} · {eng} Engagement · Peak {format_quarter(peak_q)}")


def make_template_caption(row, group: pd.DataFrame) -> str:
    dominant  = row["dominant_category"]
    lifecycle = row["lifecycle_stage"]
    eng_rate  = row["mean_engagement_rate"]
    viral_r   = row["viral_rate"]
    duration  = row["mean_trend_duration_days"]
    peak_q    = row["peak_quarter"]
    total     = row["total_posts"]
    window_s  = row.get("trend_window_start", "N/A")
    window_e  = row.get("trend_window_end", "N/A")

    sec_cats = secondary_categories(group, dominant)
    cities   = top_cities(group)
    tags     = top_tags(group)

    sec_str  = f", with influences from {' and '.join(sec_cats)}" if sec_cats else ""
    caption  = (
        f"This is a {dominant} visual trend cluster{sec_str}, comprising {total:,} posts "
        f"and {LIFECYCLE_PHRASES.get(lifecycle, lifecycle)}."
    )
    caption += (
        f" The trend peaked in {format_quarter(peak_q)}, with activity spanning "
        f"{format_quarter(window_s)} through {format_quarter(window_e)}."
    )
    caption += (
        f" Content in this cluster achieves {engagement_tier(eng_rate)} engagement "
        f"(avg {eng_rate:.2f}%) and is {viral_tier(viral_r)} ({viral_r:.0%} of posts go viral)."
    )
    caption += (
        f" Individual posts tend to remain trend-relevant for an average of {duration:.1f} days "
        f"({duration_tier(duration)})."
    )
    if cities:
        caption += f" The trend shows strong geographic concentration in {', '.join(cities)}."
    if tags:
        caption += f" Top associated tags: {', '.join(tags[:6])}."

    return caption


# -----------------------------------------------------------------------
# 4. Main captioning loop
# -----------------------------------------------------------------------
captions = {}
n_clusters = len(cluster_df)

print(f"Generating captions for {n_clusters} clusters …\n")

for idx, (_, row) in enumerate(cluster_df.iterrows()):
    cid   = int(row["cluster"])
    group = meta_c[meta_c["cluster"] == cid]

    if group.empty:
        continue

    # Representative image = highest cluster membership probability
    rep_idx   = group["cluster_prob"].idxmax()
    rep_image = group.loc[rep_idx, "image_path"]

    # Resolve absolute path
    abs_rep = str(BASE_DIR / rep_image) if not rep_image.startswith("/") else rep_image

    print(f"  [{idx+1}/{n_clusters}] Cluster {cid} ({row['dominant_category']}, "
          f"{row['lifecycle_stage']}) — {rep_image}")

    # ── Stage A: BLIP visual caption ─────────────────────────────────
    # For BLIP-2 on GPU: use VQA prompt; for BLIP-1 on CPU: unconditional
    blip_prompt = "Question: What is shown in this image? Answer:" if USE_BLIP2 else None
    blip2_cap   = generate_blip2_caption(abs_rep, prompt=blip_prompt)
    print(f"    BLIP: {blip2_cap[:100]}" if blip2_cap else "    BLIP: (failed)")

    # ── Stage B: Metadata template caption ──────────────────────────
    template_cap = make_template_caption(row, group)

    # ── Combine: BLIP-2 description + metadata context ─────────────
    if blip2_cap:
        full_caption = (
            f"[Visual]: {blip2_cap} "
            f"[Trend Context]: {template_cap}"
        )
    else:
        full_caption = template_cap

    title    = make_title(cid, row["dominant_category"], row["lifecycle_stage"],
                          row["peak_quarter"], row["mean_engagement_rate"])
    kws      = top_tags(group, n=10)
    cities   = top_cities(group)
    sec_cats = secondary_categories(group, row["dominant_category"])

    pred_eng = None
    if "pred_engagement_rate" in row and not pd.isna(row.get("pred_engagement_rate")):
        pred_eng = float(row["pred_engagement_rate"])

    captions[cid] = {
        "cluster_id":               cid,
        "title":                    title,
        "blip2_caption":            blip2_cap,
        "caption":                  full_caption,
        "template_caption":         template_cap,
        "keywords":                 kws,
        "dominant_category":        row["dominant_category"],
        "secondary_categories":     sec_cats,
        "lifecycle_stage":          row["lifecycle_stage"],
        "peak_quarter":             str(row["peak_quarter"]),
        "trend_window":             f"{row['trend_window_start']} → {row['trend_window_end']}",
        "geographic_hotspots":      cities,
        "representative_image":     rep_image,
        "stats": {
            "total_posts":              int(row["total_posts"]),
            "mean_engagement_rate":     round(float(row["mean_engagement_rate"]), 4),
            "viral_rate":               round(float(row["viral_rate"]), 4),
            "mean_trend_duration_days": round(float(row["mean_trend_duration_days"]), 2),
            "category_purity":          round(float(row.get("category_purity", 0.0)), 4),
            "avg_membership_prob":      round(float(row.get("avg_membership_prob", 0.0)), 4),
            "pred_engagement_rate":     round(pred_eng, 4) if pred_eng is not None else None,
        }
    }

print(f"\nGenerated captions for {len(captions)} clusters")

# -----------------------------------------------------------------------
# 5. Save JSON
# -----------------------------------------------------------------------
with open(OUTPUT_DIR / "cluster_captions.json", "w") as f:
    json.dump(captions, f, indent=2, ensure_ascii=False)
print("  → cluster_captions.json")

# -----------------------------------------------------------------------
# 6. Generate Markdown Report
# -----------------------------------------------------------------------
LIFECYCLE_EMOJI = {"Rising": "🚀", "Stable": "📊", "Declining": "📉"}

md_lines = [
    "# TrendLens — Visual Trend Cluster Caption Report",
    "",
    "> **Generated by:** `generate_captions.py` · TrendLens Pipeline Step 7  ",
    f"> **Clusters captioned:** {len(captions)}  ",
    "> **Method:** BLIP-2 visual captioning + metadata template enrichment",
    "",
    "---",
    "",
    "## Summary Table",
    "",
    "| Cluster | Category | Stage | Peak | Engagement | Viral | Posts |",
    "|---------|----------|-------|------|-----------|-------|-------|",
]

for cid, cap in sorted(captions.items()):
    s   = cap["stats"]
    emo = LIFECYCLE_EMOJI.get(cap["lifecycle_stage"], "")
    md_lines.append(
        f"| **{cid}** | {cap['dominant_category']} | {emo} {cap['lifecycle_stage']} "
        f"| {format_quarter(cap['peak_quarter'])} "
        f"| {s['mean_engagement_rate']:.2f}% "
        f"| {s['viral_rate']:.0%} "
        f"| {s['total_posts']:,} |"
    )

md_lines += ["", "---", "", "## Detailed Cluster Profiles", ""]

for cid, cap in sorted(captions.items()):
    s   = cap["stats"]
    emo = LIFECYCLE_EMOJI.get(cap["lifecycle_stage"], "")

    md_lines += [
        f"### {cap['title']}",
        "",
        f"**BLIP-2 Visual Caption:**",
        f"> {cap['blip2_caption'] if cap['blip2_caption'] else '*(model unavailable)*'}",
        "",
        f"**Trend Context:**",
        f"> {cap['template_caption']}",
        "",
        f"**Stats:**",
        f"- Lifecycle: **{emo} {cap['lifecycle_stage']}** · Peak: `{format_quarter(cap['peak_quarter'])}`",
        f"- Trend window: `{cap['trend_window']}`",
        f"- Posts: **{s['total_posts']:,}** · Engagement: **{s['mean_engagement_rate']:.2f}%** · Viral: **{s['viral_rate']:.0%}**",
        f"- Avg trend duration: **{s['mean_trend_duration_days']:.1f} days**",
        f"- Category purity: **{s['category_purity']:.0%}** · Membership confidence: **{s['avg_membership_prob']:.0%}**",
    ]

    if s.get("pred_engagement_rate") is not None:
        md_lines.append(f"- Predicted engagement: **{s['pred_engagement_rate']:.2f}%**")

    if cap["geographic_hotspots"]:
        md_lines.append(f"- Geographic hotspots: {', '.join(cap['geographic_hotspots'])}")

    if cap["keywords"]:
        md_lines.append(f"- Keywords: {' '.join(cap['keywords'][:8])}")

    if cap["secondary_categories"]:
        md_lines.append(f"- Secondary categories: {', '.join(cap['secondary_categories'])}")

    md_lines += [
        f"- Representative image: `{cap['representative_image']}`",
        "",
        "---",
        "",
    ]

report_text = "\n".join(md_lines)
with open(OUTPUT_DIR / "captions_report.md", "w") as f:
    f.write(report_text)
print("  → captions_report.md")

# -----------------------------------------------------------------------
# 7. Console preview — top 3 by engagement
# -----------------------------------------------------------------------
print("\n=== Sample Captions (top 3 clusters by engagement) ===\n")
top3 = sorted(captions.values(),
              key=lambda x: x["stats"]["mean_engagement_rate"], reverse=True)[:3]
for cap in top3:
    print(f"[Cluster {cap['cluster_id']}] {cap['title']}")
    if cap["blip2_caption"]:
        print(f"  BLIP-2: {cap['blip2_caption'][:120]}")
    print(f"  Context: {cap['template_caption'][:200]}...")
    print()

blip2_success = sum(1 for c in captions.values() if c["blip2_caption"])
print("=" * 60)
print("Step 7 Complete — Cluster Captioning (BLIP-2)")
print("=" * 60)
print(f"  Clusters captioned : {len(captions)}")
print(f"  BLIP-2 successes   : {blip2_success} / {len(captions)}")
print("\nNew files in trendlens_outputs/:")
print("  - cluster_captions.json  (blip2_caption + caption fields)")
print("  - captions_report.md")
