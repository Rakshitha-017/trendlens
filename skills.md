# TrendLens — Project Skills & Context Reference

> **Purpose:** Canonical context document for TrendLens. Describes architecture, design decisions, data schema, and pipeline steps in full detail for future development, AI-assisted sessions, and onboarding.
>
> **Current State (v4.1):** All 8 pipeline steps complete + full-stack frontend verified. CLIP + HDBSCAN + UMAP clustering ✅ | Slope-based temporal lifecycle ✅ | Post-level CLIP+BERT+LightGBM popularity model ✅ | Cluster-level predicted engagement ✅ | BLIP visual captioning ✅ | FAISS + Gemini RAG ✅ | React/Express frontend wired to real cluster_captions.json ✅

---

## 0. Changelog

### v5.1 (2026-08-12) — Scoring bug fix + intent-aware formatter

- **Fixed: scoring bug in `scoreCluster()` (server.ts).** Secondary category bonuses were additive per matching keyword. A single query word like "party" triggered both `events` AND `nightlife` keyword lists, giving art clusters with those as secondary categories +50 points — beating a fashion-dominant cluster's +75. Fixed: dominant category = 75pts (max), secondary = 18pts max regardless of how many keyword lists match.
- **Fixed: formatter was query-blind.** Every query got the same photography-centric output, including BLIP captions like "two kittens behind a fence" surfaced as visual advice. Fixed: `formatClusterAnswer()` and `fallback_recommendation()` now detect 3 intent modes: (a) **fashion/style** query (wear/outfit/attend/party) → surfaces what aesthetics are *performing on social media*, uses `template_caption` not BLIP, shows declining styles to avoid; (b) **photography/creator** query → composition, visual elements, 3-step plan; (c) **general trend** query → cluster overview with engagement data.
- **Fixed: BLIP captions no longer surfaced as prescriptive advice.** Raw BLIP descriptions (e.g., "two kittens behind a fence") were being shown to users as instructions. Both the frontend and Python formatter now use `template_caption` or `caption` for context, and never BLIP as user-facing advice.
- **Added: scope keywords** — "wear", "outfit", "party", "attend", "clothing", "dress", "festival", "wedding" added to `_SCOPE_KEYWORDS` (Python) and `SCOPE_KEYWORDS` (TS) so these queries are correctly accepted by the topic guard.
- **Updated:** `commands.md`, `skills.md`, `README.md`.

### v5.0 (2026-08-12) — FAISS-only RAG, LLM removed, topic guard

- **Removed:** All Gemini LLM calls from both `rag_query_system.py` and `frontend/server.ts`. The query path is now **fully FAISS-only** — cluster retrieval + structured evidence formatting, no external LLM involved.
- **Removed (frontend):** `/api/analyze-trend` (Gemini web-grounded general trend analysis), `/api/discover-trends` (Gemini discovery), and `/api/chat` (general-purpose Gemini chatbot) endpoints. All were off-scope for a social media trend analysis tool.
- **Added:** Topic restriction guard in both `rag_query_system.py` (`_is_in_scope()`) and `frontend/server.ts` (`isInScope()`). Off-topic queries (programming, math, general knowledge, etc.) are rejected with a clear scope message explaining TrendLens is restricted to social media visual trend analysis.
- **Rewired:** `frontend/src/services/chatService.ts` — `sendMessage()` now routes to `/api/rag-query` instead of the removed `/api/chat`.
- **Updated:** `TrendQueryPage.tsx` and `ChatbotPage.tsx` suggested prompts are now strictly social-media-trend-focused. Badge text updated to "FAISS Cluster Intelligence · No LLM".
- **Added:** `answer.md` — justification document explaining why TrendLens is superior to asking Gemini/LLMs directly.

### v4.1 (2026-08-11) — Frontend wiring, model fix, audit

- **Fixed:** Gemini model `gemini-2.0-flash` (and `gemini-2.5-flash`) are no longer available on this API key and return `404 NOT_FOUND`. Updated to `gemini-3.6-flash` in both `.env` (Python RAG) and `frontend/server.ts` (frontend Gemini calls). The model is confirmed working.
- **Fixed (Critical):** The `TrendLens-frontend/server.ts` `/api/rag-query` endpoint was returning **entirely hardcoded fake clusters** (`cluster-101: Cyberpunk Neon Developer Setups`, etc.) that do not exist in the database. Gemini was reasoning over fabricated context — pure hallucination. This is now fixed in the canonical `frontend/server.ts` which reads directly from `trendlens_outputs/cluster_captions.json`.
- **Established:** `frontend/` is the **canonical frontend** directory. `TrendLens-frontend/` is a deprecated copy. All frontend work should use `frontend/` only.
- **Added:** `commands.md` — single reference file for all commands to run the project end-to-end.
- **Verified (RAG anti-hallucination):** Pasta blogger query confirmed to cite actual cluster IDs, BLIP captions, and engagement metrics from the real FAISS index. Every visual recommendation is traceable to a specific cluster's data.
- **Validated:** Benchmark — 8 queries, Mean Precision@3 = 70.8%, intent-detection pass rate = 100%.

### v3.1 (2026-08-06) — Pipeline correctness pass

- **Fixed:** `predict_popularity.py` trained a post-level model but never emitted a `cluster` column or a `pred_engagement_rate` column that `generate_captions.py` expected. The merge condition in `generate_captions.py` silently evaluated to `False`, so every cluster caption's `stats.pred_engagement_rate` was always `null`. Fixed by having `predict_popularity.py` aggregate post-level predictions to cluster level and write a new `popularity_cluster_predictions.csv`; `generate_captions.py` now reads that file (with a graceful fallback to on-the-fly aggregation for older runs).
- **Fixed:** `predict_popularity.py` wrote only `pred_df.head(200)` to `popularity_predictions.csv`, discarding ~98% of the 10,000 sampled predictions. It now writes the full sample.
- **Fixed:** Inconsistent working-directory assumptions. `generate_metadata.py` and `generate_embeddings.py` anchored `OUTPUT_DIR` to the script's own directory (`Path(__file__).parent`), but `generate_umap.py`, `generate_clusters.py`, `generate_temporal_trends.py`, `predict_popularity.py`, `generate_captions.py`, `rag_query_system.py`, and `convert_npy_to_csv.py` used a cwd-relative `Path("trendlens_outputs")`. All scripts now anchor to `Path(__file__).parent`, so behavior no longer depends on where a script is invoked from.
- **Fixed:** `generate_clusters.py`'s representative-image grid opened `info["image_path"]` (a path relative to the repo root) directly, which only worked if the script happened to be run from that root. It now resolves via `BASE_DIR / image_path`.
- **Fixed:** Step numbering was inconsistent across docstrings — `generate_clusters.py` and `generate_temporal_trends.py` both claimed to be "Step 4," and the numbering didn't account for the UMAP/HDBSCAN split. All 8 scripts are now numbered sequentially 1–8 (see §2 and §3 below); this doc's section numbers were updated to match.

### v3.0 — Initial complete pipeline (BLIP captioning + FAISS/Gemini RAG)

---

## 1. Project Overview

**TrendLens** is an end-to-end multimodal visual trend-detection pipeline on ~69K social-media-style images (SMPD Flickr dataset). It transforms raw image files and a filepath manifest into a rich, engagement-enriched dataset paired with CLIP visual embeddings — the foundation for cluster discovery, lifecycle tracking, virality prediction, and a conversational query system.

**Goal:** Identify visual trends (recurring aesthetics, colour palettes, subject matter) that correlate with high audience engagement; make them queryable in plain English.

---

## 2. Repository Layout

```
trendlens/
├── generate_metadata.py          # Step 1 — Synthetic engagement metadata
├── generate_embeddings.py        # Step 2 — CLIP image embeddings (512-d)
├── generate_umap.py              # Step 3 — UMAP 2D + 10D projections
├── generate_clusters.py          # Step 4 — HDBSCAN cluster discovery
├── generate_temporal_trends.py   # Step 5 — Activity curves + lifecycle classification
├── predict_popularity.py         # Step 6 — Post-level LightGBM popularity model
├── generate_captions.py          # Step 7 — BLIP visual captioning + template enrichment
├── rag_query_system.py           # Step 8 — FAISS dense retrieval + Gemini RAG (Python CLI)
├── convert_npy_to_csv.py         # Utility — .npy → .csv export for embeddings/UMAP
├── .env                          # GOOGLE_API_KEY + GEMINI_MODEL=gemini-3.6-flash
├── .env.example                  # Template for above
├── requirements.txt              # Python dependencies
├── commands.md                   # All commands to run the project end-to-end
├── train_img_filepath.txt        # Flickr-style manifest: train/<user_id>/<photo_id>.jpg
├── train/                        # Image root — subdirs named by user_id
├── frontend/                     # ★ CANONICAL full-stack frontend (React + Express)
│   ├── server.ts                 # Express API server — reads cluster_captions.json directly
│   ├── src/                      # React SPA (Vite)
│   ├── .env                      # GEMINI_API_KEY for frontend Gemini calls
│   └── package.json
└── trendlens_outputs/            # All generated artefacts (git-ignored)
```

> **Path anchoring:** every script resolves `trendlens_outputs/` relative to its own file location (`Path(__file__).parent`), not the caller's working directory. You can run `python trendlens/generate_umap.py` from anywhere and it will still find the right files.

### `trendlens_outputs/` Reference

| File | Description |
|------|-------------|
| `smpd_metadata.json` | Raw synthetic engagement records (207 MB) |
| `metadata.csv` | 69,226 rows × 25 cols — enriched, validated |
| `embeddings.npy` | CLIP float32 (69226 × 512) L2-normalised |
| `umap_2d.npy / umap_10d.npy` | UMAP projections |
| `metadata_clustered.csv` | metadata + `cluster` + `cluster_prob` |
| `cluster_summary.csv` | Per-cluster size, purity, engagement stats |
| `cluster_representatives.json/png` | Highest-prob image per cluster |
| `cluster_scatter.png` | UMAP scatter coloured by cluster |
| `trend_metrics.csv` | Lifecycle stage, slope, peak quarter per cluster |
| `trend_graphs/` | Activity curve PNG per cluster |
| `trend_summary.png` | Top Rising clusters bar chart |
| `popularity_model_regression.pkl` | LightGBM post-level regressor |
| `popularity_bert_pca.pkl` | BERT CLS + PCA transform for inference |
| `popularity_metrics.json` | CV R²=0.7476, MAE, RMSE |
| `popularity_predictions.csv` | **Full** per-post actual vs predicted (all 10,000 sampled rows), incl. `cluster` and post-level `pred_engagement_rate` |
| `popularity_cluster_predictions.csv` | **(v3.1, new)** Post-level predictions aggregated to cluster level — `cluster`, `pred_engagement_rate`, `mean_actual_engagement_rate`, `n_samples`. This is what `generate_captions.py` consumes. |
| `feature_importance.png` | Top-20 feature importance (CLIP/BERT/meta groups) |
| `actual_vs_predicted.png` | log-scale scatter plot |
| `cluster_captions.json` | BLIP visual caption + metadata template per cluster, now including a populated `pred_engagement_rate` |
| `captions_report.md` | Human-readable markdown report |
| `rag_faiss.index` | FAISS IndexFlatIP (39 × 384) |
| `rag_vectors.npy` | Sentence-transformer caption embeddings |
| `rag_meta.pkl` | Cluster metadata lookup for RAG |
| `embeddings.csv`, `umap_2d.csv`, `umap_10d.csv` | Optional CSV exports via `convert_npy_to_csv.py` |

---

## 3. Execution Order

```bash
source venv/bin/activate

python generate_metadata.py           # ~5–10 min
python generate_embeddings.py         # ~90 min CPU / ~10 min GPU (resume-safe)
python generate_umap.py               # ~25 min CPU
python generate_clusters.py           # ~5–10 min
python generate_temporal_trends.py    # ~1 min
python predict_popularity.py          # ~10 min CPU (BERT encoding)
python generate_captions.py           # ~2 min (model cached) / ~10 min first run
python rag_query_system.py --build-index --validate

# optional utility, any time after generate_umap.py:
python convert_npy_to_csv.py
```

Each script now works regardless of your current working directory (see §0 changelog), but running from the repo root is still recommended for consistency with `train_img_filepath.txt` and `train/`.

---

## 4. Step 1 — `generate_metadata.py`

Generates synthetic social-media engagement for every image in `train_img_filepath.txt`.

### Content Taxonomy (15 categories)

| Category | Likes Multiplier | CAT_BASE_DAYS |
|----------|-----------------|---------------|
| food | 3.2 | 14 |
| fashion | 3.0 | 30 |
| portrait | 2.8 | 10 |
| travel | 2.7 | 21 |
| events | 2.5 | 3 |
| animals | 2.4 | 7 |
| nightlife | 2.3 | 7 |
| family | 2.2 | 14 |
| sports | 2.0 | 5 |
| nature | 1.9 | 14 |
| architecture | 1.8 | 21 |
| street | 1.7 | 10 |
| art | 1.6 | 28 |
| abstract | 1.4 | 21 |
| technology | 1.3 | 45 |

### Engagement Signals

| Signal | Distribution |
|--------|-------------|
| `likes` | LogNormal, category multiplier × user `likes_mult` |
| `comments` | Beta(1.5, 6.0) × likes × 0.25 |
| `views` | Uniform(10×, 120×) likes |
| `reposts` | Beta(1.2, 18.0) × likes × 0.08 |
| `saves` | Beta(2.0, 12.0) × likes × 0.15 |
| `engagement_rate` | (likes + comments + reposts) / reach × 100 |
| `is_viral` | True if engagement_rate > 3% OR reposts > 50 |

### Timestamp Strategy

Timestamps are **category-biased Gaussian** over 2010–2019:
- `technology`, `fashion`, `sports` → biased toward 2016–2019
- `travel`, `food`, `animals` → biased toward 2013–2016
- `architecture`, `nature`, `street` → biased toward 2010–2013

This ensures clusters naturally peak at different periods, enabling genuine Rising/Stable/Declining classification.

### Trend Duration Model

```
trend_duration = base_duration(category) × engagement_multiplier × virality_boost
```
- Sampled from LogNormal(μ, σ=0.4), capped 1–180 days
- `trend_active_until` = timestamp + trend_duration_days

**Outputs:** `smpd_metadata.json`, `metadata.csv` (69,226 rows × 25 cols)

---

## 5. Step 2 — `generate_embeddings.py` (CLIP)

| Setting | Value |
|---------|-------|
| Model | `openai/clip-vit-base-patch32` |
| Output dim | 512 (L2-normalised, unit vectors) |
| Batch size | 32 images |
| Checkpoint | Every 200 batches (resume-safe) |
| Device | CUDA auto-detected, CPU fallback |

**Path:** `vision_model → pooler_output → visual_projection → L2-normalise → float32`

**Why CLIP?** Joint image–text embedding space means vectors capture semantic content, not just colour histograms — enabling meaningful clustering and cross-modal retrieval.

**Output:** `embeddings.npy` — shape (69226, 512), dtype float32

---

## 6. Step 3 — `generate_umap.py` (UMAP)

| Run | n_components | n_neighbors | min_dist | metric | Purpose |
|-----|-------------|------------|---------|--------|---------|
| `umap_2d` | 2 | 30 | 0.1 | cosine | Scatter-plot visualisation |
| `umap_10d` | 10 | 30 | 0.0 | cosine | HDBSCAN clustering input |

**Why cosine?** CLIP embeddings are L2-normalised unit vectors — cosine = Euclidean in this space, capturing semantic orientation.

**Why min_dist=0.0 for 10D?** HDBSCAN needs density peaks; non-zero min_dist artificially spreads points and breaks cluster cores.

**Outputs:** `umap_2d.npy`, `umap_10d.npy`, `umap_scatter.png`

---

## 7. Step 4 — `generate_clusters.py` (HDBSCAN)

| Parameter | Value | Reason |
|-----------|-------|--------|
| `MIN_CLUSTER_SIZE` | 512 | Matches CLIP dim; optimal from sweep |
| `MIN_SAMPLES` | 10 | Tight cluster cores |
| `metric` | euclidean | UMAP output is Euclidean by construction |
| `cluster_selection_method` | eom | Better for variable-density clusters |

### Sweep Results

| min_cluster_size | Clusters | Noise |
|-----------------|---------|-------|
| 100 | 457 | 39.7% |
| 512 | **39** ✅ | **23.6%** |
| 650 | 30 | 27.1% |

**Final result:** 39 clusters, 23.6% noise (~76% of images clustered)

**Why cross-category clusters are expected:** CLIP clusters by visual appearance, not semantic label. A moody low-light image spans nightlife, art, and architecture — these cross-domain visual trends are exactly what TrendLens finds.

**Outputs:** `metadata_clustered.csv`, `cluster_summary.csv`, `cluster_representatives.json/png`, `cluster_scatter.png`

---

## 8. Step 5 — `generate_temporal_trends.py` (Temporal Lifecycle)

### Methodology

For each cluster, build a **quarterly activity curve** (2010–2021):
```
active_posts(Q) = count of posts where ts_start ≤ Q ≤ ts_end
```

### Lifecycle Classification (Slope-Based Percentile Ranking)

1. **Normalised slope** = `(last_third_mean − first_third_mean) / max_activity`
2. **Recency fraction** = share of activity in the final third of the timeline
3. **Combined score** = `0.60 × slope_rank + 0.40 × recency_rank` (rank-normalised to [0,1] across all clusters)
4. **Percentile cut:** Top 33.3% → **Rising** | Bottom 33.3% → **Declining** | Middle → **Stable**

**Why percentile ranking instead of absolute thresholds?** The synthetic timestamp distribution produces all-negative slopes regardless of absolute content age. Relative ranking guarantees a meaningful ~33/33/33 split and is mathematically robust to dataset-wide biases.

### Results

| Stage | Count | Interpretation |
|-------|-------|---------------|
| Rising | **13** | Highest recency + slope — growing toward present |
| Stable | **13** | Mid-range — consistently active |
| Declining | **13** | Concentrated early activity — peaked and faded |

**Outputs:** `trend_metrics.csv`, `trend_summary.png`, `trend_graphs/` (39 PNGs)

### `trend_metrics.csv` Schema

| Column | Description |
|--------|-------------|
| `cluster` | Integer cluster ID |
| `dominant_category` | Most common category in cluster |
| `total_posts` | Post count |
| `peak_quarter` | Quarter with highest simultaneous activity |
| `lifecycle_stage` | Rising / Stable / Declining |
| `slope_normalised` | Raw (last_mean − first_mean) / max |
| `recency_fraction` | Share of activity in final third |
| `trend_window_start/end` | First/last active quarter |
| `mean_engagement_rate` | Avg engagement % |
| `viral_rate` | Fraction of posts that are viral |
| `mean_trend_duration_days` | Avg modelled trend lifespan |

---

## 9. Step 6 — `predict_popularity.py` (Post-Level Popularity Model)

### What Changed from v2

The old model predicted `mean_engagement_rate` at **cluster level** (39 samples, trivial). The v3 model is a true **post-level regression** targeting `log1p(likes + comments)` on 10,000 sampled posts.

### What Changed in v3.1

The post-level model itself is unchanged, but its outputs are now correctly wired into the rest of the pipeline:
- `popularity_predictions.csv` now contains the **full** 10,000-row sample (previously truncated to 200 rows) plus `cluster` and a post-level `pred_engagement_rate` column.
- A new `popularity_cluster_predictions.csv` aggregates those post-level predictions to cluster level (`mean` per cluster), which is what `generate_captions.py` merges into each cluster's caption metadata.
- `pred_engagement_rate` is computed as `pred_likes_comments / reach × 100` — the same denominator as the ground-truth `engagement_rate` formula, minus the (unpredicted) `reposts` term, so it's a slight underestimate but on a comparable scale.

### Feature Engineering (599 total)

| Group | Dim | Source | Description |
|-------|-----|--------|-------------|
| **CLIP embeddings** | 512 | `embeddings.npy` | Visual content features from ViT-B/32 |
| **BERT tag features** | 64 (PCA) | `bert-base-uncased` CLS on tag strings | Text/hashtag semantic signal; 768-d → PCA-64 (86.9% variance) |
| **Engagement metadata** | 23 | `metadata_clustered.csv` | log_followers, has_geo, hour_sin/cos, month_sin/cos, log_views, post_year, 15 category one-hot |

### Model

| Setting | Value |
|---------|-------|
| Model | LightGBM Regressor |
| Target | `log1p(likes + comments)` |
| Sample size | 10,000 posts (stratified by category) |
| CV | 5-fold |
| **CV R²** | **0.7476** |
| CV MAE | 0.4232 (log-scale) |
| CV RMSE | 0.5293 (log-scale) |
| Train R² | 0.9955 |

**Why log1p target?** Likes + comments are heavy-tailed; log-transform stabilises variance and makes residuals approximately Gaussian. Back-transform: `np.expm1(prediction)`.

**Sample predictions (back-transformed):**
```
actual=170  pred=149  |  actual=12   pred=14
actual=58   pred=64   |  actual=118  pred=109
```

**Outputs:** `popularity_model_regression.pkl`, `popularity_bert_pca.pkl`, `popularity_metrics.json`, `popularity_predictions.csv` (full sample), `popularity_cluster_predictions.csv` (v3.1, new), `feature_importance.png`, `actual_vs_predicted.png`

---

## 10. Step 7 — `generate_captions.py` (BLIP Visual Captioning)

### Two-Stage Pipeline

**Stage A — BLIP Visual Captioning:**

| Hardware | Model | Notes |
|----------|-------|-------|
| GPU (CUDA) | `Salesforce/blip2-opt-2.7b` | 8-bit quantised via bitsandbytes; VQA prompt |
| CPU | `Salesforce/blip-image-captioning-base` | ~990 MB; unconditional generation |

Runs on the **representative image** (highest HDBSCAN membership probability) of each cluster.

**Stage B — Metadata Template Enrichment:**
Augments BLIP caption with: dominant + secondary categories, lifecycle phrase, peak quarter, engagement tier, viral tier, duration tier, top hashtags, geographic hotspots, and (v3.1) predicted engagement rate from `popularity_cluster_predictions.csv` when available.

**Final caption format:**
```
[Visual]: <BLIP output>  [Trend Context]: <metadata template>
```

### Results

- **39/39 clusters captioned** with real BLIP visual descriptions
- Sample BLIP outputs:
  - Cluster 0 (events/Rising): *"a row of models in beige coats"*
  - Cluster 32 (fashion/Rising): *"a man on a skateboard"*
  - Cluster 29 (food/Stable): *"a red curtain behind the woman"*

### `cluster_captions.json` Schema

```json
{
  "cluster_id": 32,
  "title": "Cluster 32 — Fashion · 🚀 Rising · Moderate Engagement · Peak Q4 2015",
  "blip2_caption": "a man on a skateboard",
  "caption": "[Visual]: a man on a skateboard [Trend Context]: This is a fashion...",
  "template_caption": "This is a fashion visual trend cluster...",
  "keywords": ["#fashion", "#style", "#ootd", ...],
  "dominant_category": "fashion",
  "secondary_categories": ["family", "nature"],
  "lifecycle_stage": "Rising",
  "peak_quarter": "2015-10-01",
  "trend_window": "2010-01-01 → 2020-10-01",
  "geographic_hotspots": ["New York", "London", "Paris"],
  "representative_image": "train/20911@N87/146293.jpg",
  "stats": {
    "total_posts": 804,
    "mean_engagement_rate": 2.3523,
    "viral_rate": 0.2251,
    "mean_trend_duration_days": 24.3,
    "category_purity": 0.18,
    "avg_membership_prob": 0.71,
    "pred_engagement_rate": 2.1017
  }
}
```

> **v3.1 note:** `pred_engagement_rate` is now populated (was always `null` in v3.0 due to the broken merge — see §0 changelog).

**Outputs:** `cluster_captions.json`, `captions_report.md`

---

## 11. Step 8 — `rag_query_system.py` (FAISS + Gemini RAG)

### Architecture

```
Query string
    → Intent Detection (lifecycle / category / year / engagement / visual-strategy / creator keywords)
    → SentenceTransformer all-MiniLM-L6-v2 (384-d, L2-normalized)
    → FAISS IndexFlatIP (cosine similarity over 38 cluster documents)
    → Candidate pool: top-40 FAISS hits
    → Hybrid re-ranker: semantic(0.32) + category(0.22) + lifecycle(0.16)
    |                    + engagement(0.14) + viral(0.10) + recency(0.06)
    → Top-7 results
    → build_gemini_prompt() — evidence-grounded, anti-hallucination rules
    → Gemini gemini-3.6-flash (LLM reasoning + synthesis)
    → Structured creator-centric output (lighting, color, composition, props)
```

> **Anti-hallucination design:** The prompt forbids Gemini from inventing camera specs, filter names, or facts not in the retrieved clusters. Every claim must be traceable to a named cluster ID, its BLIP caption, or the recurring visual patterns evidence.

### What Changed from v2

| Component | v2 (old) | v3 (current) |
|-----------|----------|-------------|
| Encoder | TF-IDF sparse | `all-MiniLM-L6-v2` dense (384-d) |
| Index | `TfidfVectorizer` (sklearn) | `FAISS IndexFlatIP` |
| LLM | None | Gemini `gemini-2.0-flash` |
| Captions | Template only | BLIP visual + template |
| Precision@3 | 0.60 | **1.000** |

### Validation Benchmark (v4.1)

| Query | Expected | Result | Intent Checks |
|-------|----------|--------|---------------|
| "what food trends are rising?" | food/Rising | food Rising #1 | — |
| "most viral fashion trends" | fashion | fashion cluster retrieved | — |
| "urban street photography trends" | street | street cluster retrieved | — |
| "declining nature trends from 2011" | nature/Declining | nature Declining #1 | — |
| "top highly engaging travel clusters" | travel | travel cluster #1 | — |
| "I'm a food blogger photographing pasta…" | food | 2/3 food clusters | PASS: creator, visual_strategy, subject=pasta |
| "what is trending right now in food photography?" | food/current | 3/3 food clusters | PASS: current_query |
| "best way to shoot coffee for instagram" | food | 3/3 food clusters | PASS: subject=coffee |
| **Mean Precision@3** | | **0.7083** | **100% pass rate** |

### Enabling Gemini (Python CLI)

```bash
# .env is pre-configured with GOOGLE_API_KEY and GEMINI_MODEL=gemini-3.6-flash
python rag_query_system.py --validate          # Gemini LLM active: Yes
python rag_query_system.py --validate --validate-llm  # Also calls Gemini for each query
```

### CLI Reference

```bash
python rag_query_system.py --build-index          # Build FAISS index from captions
python rag_query_system.py --validate             # Benchmark 5 queries + Precision@3
python rag_query_system.py --query "..."          # Single query
python rag_query_system.py --interactive          # REPL mode
python rag_query_system.py --query "..." --top-k 8
```

### Query Patterns Supported

| Pattern | Example | Mechanism |
|---------|---------|-----------|
| Lifecycle filter | "rising trends" | Keyword → lifecycle preference |
| Category filter | "food trends" | Keyword → category score boost |
| Year filter | "trending in 2017" | Regex → recency scoring |
| Engagement ranking | "most viral trends" | Engagement score boost |
| Creator/visual | "I'm a blogger — what lighting" | Creator + visual strategy prompt |
| Semantic query | "warm golden tones" | Dense cosine similarity |
| Combined | "top 3 viral travel trends from 2017" | All mechanisms |

**Outputs:** `rag_faiss.index`, `rag_vectors.npy`, `rag_meta.pkl`

---

## 11b. Frontend RAG Endpoint (`frontend/server.ts`)

The frontend uses a **different but complementary** retrieval mechanism from the Python CLI:

| | Python `rag_query_system.py` | Frontend `server.ts` `/api/rag-query` |
|--|--|--|
| **Retrieval** | FAISS dense similarity (SentenceTransformer) | Keyword + lifecycle scoring (JS, in-process) |
| **Document store** | `rag_faiss.index` + `rag_meta.pkl` | `cluster_captions.json` (read directly at startup) |
| **Re-ranking** | 6-component hybrid scorer | Category + engagement + lifecycle score |
| **LLM** | **None** — `fallback_recommendation()` formats FAISS evidence | **None** — pure TypeScript `formatClusterAnswer()` |
| **Topic guard** | `_is_in_scope()` — rejects off-topic queries | `isInScope()` — rejects off-topic queries |
| **Grounding** | Evidence-block Markdown from cluster metadata | Structured Markdown from cluster metadata |
| **Use** | CLI testing / validation | Frontend chat UI |

> **v5.0 note:** Gemini has been completely removed from both query paths. The frontend no longer imports `@google/genai` at all. The removed endpoints (`/api/analyze-trend`, `/api/discover-trends`, `/api/chat`) were Gemini-powered general-purpose tools that were out of scope for a social media trend analysis system.

Both read from the same **`cluster_captions.json`** ground truth and produce structured Markdown answers directly from cluster data — no LLM, no hallucination.

### Frontend startup

```bash
cd frontend
npx tsx server.ts   # → http://localhost:3000
```

## 12. Metadata Schema (`metadata.csv`) — 69,226 rows × 25 cols

| Column | Type | Description |
|--------|------|--------------|
| `post_id` | str | `{user_id}_{photo_id}` — unique key |
| `user_id` | str | Flickr-style identifier |
| `photo_id` | str | Numeric photo stem |
| `image_path` | str | `train/<user_id>/<photo_id>.jpg` |
| `timestamp` | str | ISO-8601 UTC, 2010–2019, category-biased |
| `likes` | int | Lognormal, category + user modulated |
| `comments` | int | Beta fraction of likes |
| `reposts` | int | Beta-skewed fraction of likes |
| `saves` | int | Beta fraction of likes |
| `views` | int | 10–120× likes |
| `reach` | int | ≥ views (viral reposts can exceed) |
| `follower_count` | int | Power-law; per-user, stable |
| `engagement_rate` | float | (likes+comments+reposts)/reach × 100 |
| `is_viral` | bool | engagement_rate>3% OR reposts>50 |
| `category` | str | One of 15 content categories |
| `tags` | str (JSON) | 2–8 hashtags |
| `groups` | str (JSON) | 0–4 Flickr group names |
| `geo_lat/lon` | float/NaN | ±0.15° jitter; NaN if no location |
| `geo_city` | str/NaN | City name |
| `trend_duration_days` | float | Modelled lifespan 1–180 days |
| `trend_active_until` | str | timestamp + trend_duration_days |
| `cluster` | int | HDBSCAN cluster ID (-1 = noise) |
| `cluster_prob` | float | HDBSCAN membership probability |

---

## 13. Key Design Decisions

1. **CLIP for embeddings** — joint image-text space captures semantic content, enabling meaningful cross-modal clustering not possible with colour histograms or raw pixel features.

2. **UMAP 10D → HDBSCAN** — UMAP compresses while preserving local density, making HDBSCAN's density-based clustering effective. Using 10D (not 2D) preserves more structure for clustering while avoiding the curse of dimensionality.

3. **`min_dist=0.0` for clustering UMAP** — tightens density peaks that HDBSCAN needs; non-zero spreads points artificially.

4. **Percentile-ranked lifecycle** — absolute slope thresholds fail when dataset-wide biases shift all values in the same direction. Relative ranking always produces a meaningful distribution.

5. **Post-level vs cluster-level popularity** — cluster-level had only 39 samples (trivially fitted). Post-level with 10K stratified posts produces a generalisable model; cluster-level `pred_engagement_rate` is derived by aggregating post-level predictions after the fact (v3.1), not by fitting a separate cluster-level model.

6. **BERT CLS → PCA-64 for text features** — raw 768-d BERT vectors are redundant and slow for LightGBM. PCA-64 retains 86.9% of variance while reducing input dimensionality by 12×.

7. **log1p target for popularity** — engagement counts are heavy-tailed (power-law); log-transform makes the regression problem well-posed and residuals approximately Gaussian.

8. **BLIP-1 on CPU, BLIP-2 on GPU** — blip2-opt-2.7b is 5.5GB and runs in ~45 s/image on CPU. blip-image-captioning-base is ~990 MB and produces good unconditional captions in ~3 s/image on CPU.

9. **FAISS IndexFlatIP** — exact inner product search on L2-normalised vectors = exact cosine similarity. For 39 documents, approximate ANN (IVF/HNSW) is unnecessary overhead.

10. **Lifecycle filter fallback** — if a user queries "rising food trends" but no food cluster is Rising, the system relaxes the lifecycle filter and returns the best food clusters with a note, rather than returning zero results.

11. **Script-relative path anchoring (v3.1)** — every script derives `trendlens_outputs/` from `Path(__file__).parent` rather than the process's current working directory, so results don't depend on how or from where a script is launched.

---

## 14. Dependencies (`requirements.txt`)

```
torch>=2.0.0
torchvision>=0.15.0
transformers>=4.30.0
Pillow>=9.0.0
numpy>=1.24.0
pandas>=2.0.0
matplotlib>=3.7.0
tqdm>=4.65.0
nbformat>=5.7.0
umap-learn>=0.5.0
bitsandbytes==0.50.0
faiss-cpu==1.14.3
google-genai==2.16.0
lightgbm==4.7.0
python-dotenv==1.2.2
sentence-transformers==5.6.1
```

Install: `pip install -r requirements.txt && pip install hdbscan`

---

## 15. Reproducibility

All random operations use fixed seed **42**: `random.seed(42)`, `np.random.seed(42)`, `np.random.default_rng(42)`.

Re-running all scripts with the same images produces identical outputs.

---

## 16. Pipeline Status Summary

| Step | Script | Status | Key Metric |
|------|--------|--------|-----------|
| 1. Metadata | `generate_metadata.py` | ✅ | 69,226 posts, category-biased timestamps |
| 2. CLIP Embeddings | `generate_embeddings.py` | ✅ | (69226, 512) L2-normalized |
| 3. UMAP | `generate_umap.py` | ✅ | 2D viz + 10D clustering |
| 4. HDBSCAN | `generate_clusters.py` | ✅ | 38 clusters, 23.6% noise |
| 5. Temporal | `generate_temporal_trends.py` | ✅ | 13 Rising / 12 Stable / 13 Declining |
| 6. Popularity | `predict_popularity.py` | ✅ | CV R² = **0.7476**; cluster-level predictions wired up (v3.1) |
| 7. Captioning | `generate_captions.py` | ✅ | 38/38 BLIP captions; `pred_engagement_rate` populated (v3.1) |
| 8. RAG (Python CLI) | `rag_query_system.py` | ✅ | FAISS-only, topic guard, Mean Precision@3 = **0.708** |
| 9. Frontend | `frontend/server.ts` | ✅ | FAISS-only, no LLM, topic guard, reads real `cluster_captions.json` |

---

_Last updated: 2026-08-12 · TrendLens v5.1_
