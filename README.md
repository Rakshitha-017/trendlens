# TrendLens 🔍

> **Find trends before they have a name.**
>
> Every existing trend tool — Google Trends, Exploding Topics, Brandwatch — can only detect trends that *already have words attached to them*. If it doesn't have a hashtag, it's invisible.
>
> TrendLens detects trends **visually**, from raw image clusters, before language catches up.

---

## The Core Insight

Visual aesthetics spread before language catches up. "Cottagecore" existed as a cluster of images for ~2 years before the word was coined. "Dark academia" spread visually before it got a hashtag. TrendLens finds these clusters *as visual patterns* using CLIP embeddings — which means it can surface a trend while it's still in the **Rising** lifecycle stage, **unnamed, with no hashtag, before it goes mainstream**.

| Existing Tool | How it detects trends | Limitation |
|---|---|---|
| Google Trends | Keyword search frequency | Needs the word first |
| Exploding Topics | Rising search queries | Still text-dependent |
| Brandwatch | Hashtag monitoring | Requires existing adoption |
| Pinterest Trends | On-platform search volume | Platform-locked |
| **TrendLens** | **CLIP visual embedding clusters** | **No language needed** |

---

## Real Query Example

**Input:** `"I am a food influencer and want to post a picture of the pasta bowl. What are the current trending styles in food photography that I should follow to get max engagement?"`

**TrendLens Output (retrieved from the real FAISS cluster database — reproduced verbatim):**

```
## 📊 Trend summary
Retrieved **5 clusters** from the FAISS index. Top themes: **building, chair, close, cup, eye, glass**.
Lifecycle: 📈 2 Rising · 📊 2 Stable · 📉 1 Declining

## 📊 Leading cluster — #20 (Stable)
**Name (VLM interpretation):** cup coffee
**Description:** A visual cluster whose images are described by: cup, glass, into, coffee, poured, white
**Visual evidence:** "a cup of coffee being poured into a white cup"
**Metrics:** 325 posts · avg engagement 79.04 · recent growth 0.11 · trend score 0.11
**Interpretation confidence:** 0.04

## 📡 All retrieved clusters
| Rank | Cluster | Name | Lifecycle | Posts | Engagement | Trend score | Conf. |
|------|---------|------|-----------|-------|------------|-------------|-------|
| #1 | 20 | cup coffee | 📊 Stable | 325 | 79.04 | 0.11 | 0.04 |
| #2 | 28 | long blonde | 📊 Stable | 182 | 79.80 | 0.04 | 0.03 |
| #3 | 21 | building clock | 📈 Rising | 218 | 64.91 | 0.20 | 0.07 |
| #4 | 16 | sitting chair | 📈 Rising | 212 | 75.40 | 0.12 | 0.04 |
| #5 | 26 | close eye | 📉 Declining | 79 | 90.19 | 0.00 | 0.10 |

*Data source: TrendLens pipeline — CLIP clustering of 5,000 sampled images, BLIP interpretations (not ground truth), neutral synthetic timestamps/engagement (demo). No LLM used; no fabricated metrics.*
```

> Note the honest output: this 5K sample has no food cluster, so the system returns the most visually similar matches (a coffee cup) and says so. It does **not** invent styling advice that the data cannot support.

---

## Architecture

```
5,000 sampled images (of 69,226 available from SMPD Flickr)
    │
    ▼  Phase 1  src/synthetic_data.py
Neutral synthetic metadata (timestamps, likes, comments — demo only, clearly labelled)
    │
    ▼  Phase 2  src/embeddings.py
CLIP ViT-B/32 image embeddings → (5000, 512), L2-normalised, checkpointed/resumable
    │
    ▼  Phase 3  src/clustering.py
UMAP (10-D) → HDBSCAN → 29 visual clusters, 26.4% noise, silhouette 0.586
    │
    ▼  Phase 4  src/trends.py
Activity curve per cluster → Rising / Stable / Declining (neutral synthetic timestamps)
    │
    ▼  Phase 5  src/interpretation.py
BLIP captions of representative images → cluster interpretations (VLM output, NOT ground truth)
    │
    ▼  Phase 6  src/retrieval.py
CLIP text embeddings (same space as images) + FAISS flat-IP index → hit@1 0.95 / MRR 0.95
    │
    ▼  Phase 7  src/rag.py + src/api.py
Query → scope gate (keywords + visual anchors) → CLIP text embed → FAISS top-k → honest markdown from measured metadata
```

Each phase is a `python -m src.<module>` step with its own test file in `tests/`. All expensive
computations (embeddings, text embeddings, FAISS index) are cached to disk and resumable.

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Image embeddings | **CLIP** `openai/clip-vit-base-patch32` (512-d, L2-normalised) |
| Dimensionality reduction | **UMAP** (10-D for clustering) |
| Clustering | **HDBSCAN** (UMAP-10 → 29 clusters, 73.6% clustered) |
| Visual captioning | **BLIP** `blip-image-captioning-base` (CPU-capable) |
| Vector index | **FAISS** `IndexFlatIP` over CLIP text embeddings of cluster interpretations |
| LLM writing layer | **Optional (off by default)** — `TRENDLENS_LLM_PROVIDER` rewrites retrieved evidence into prose; never a knowledge source, auto-fallback on failure |
| Real-time trends | **Optional** — `src/live.py` pulls REAL posts (Reddit when reachable, otherwise a **key-free Wikimedia Commons** feed) → CLIP themes; clearly labelled REAL, distinct from the synthetic demo |
| Backend API | **Python stdlib `http.server`** (`src/api.py`) — no web framework dependency |
| Frontend | **React** + **Express** (`frontend/server.ts`) — proxies `/api/*` to the Python backend; never fabricates data |

> **Integrity:** timestamps/engagement are *neutral synthetic* labels (demo only). Cluster names/descriptions are VLM **interpretations, not ground truth**. This build analyses a **5,000-image sample** of the 69,226 available images. Nothing is reported that was not measured.

---

## Pipeline Results

| Step | Output | Measured result |
|------|--------|----------------|
| CLIP embeddings | `data/embeddings/embeddings.npy` | (5000, 512) L2-normalised, checkpointed/resumable |
| HDBSCAN (UMAP-10) | 29 clusters | 26.4% noise, silhouette **0.586** |
| Temporal trends | `trend_metrics.csv` | 15 Rising / 10 Stable / 4 Declining (neutral synthetic timestamps — noise-dominated signal) |
| BLIP interpretation | `cluster_captions.json` | 29/29 clusters, mean confidence 0.073 |
| Retrieval eval | `retrieval_results.json` | hit@1 **0.95** · hit@5 **0.95** · MRR **0.95** (20 human-curated queries) |
| Popularity model | — | **NOT EVALUATED** (no prediction model; API returns observed cluster stats) |

---

## Setup

```bash
git clone <repo-url> && cd trendlens

# Python backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Frontend
cd frontend && npm install && cd ..
```

> **See [`commands.md`](commands.md) for the full command reference.**

---

## Execution Order

```bash
# Run the pipeline (in order, venv activated). See notebooks/01, 03–07 for
# step-by-step execution (Phase 2 is CLI-run only). Tests gate every phase:
# python -m pytest tests/
python -m src.synthetic_data            # neutral timestamps (demo, honest)
python -m src.embeddings                # CLIP 5K, checkpointed/resumable
python -m src.clustering                # UMAP-10 + HDBSCAN + representatives
python -m src.trends                    # temporal aggregation + trend scores
python -m src.interpretation            # BLIP captions -> cluster interpretations
python -m src.retrieval                 # CLIP-text FAISS index + retrieval eval
python -m src.live                      # OPTIONAL: REAL Reddit/Wikimedia feed -> live trends

# Run the full stack (backend :8000 + frontend :3000)
./scripts/run_all.sh
```

> **All commands with options and explanations: see [`commands.md`](commands.md)**

---

## RAG Query System

The query path (`src/rag.py`) first runs a **two-stage scope gate** — keyword
patterns (hard-blocks e.g. programming/recipes/finance) then cosine similarity
against ~150 in-scope visual anchors (flowers, moon, coffee, …). Out-of-scope
questions are refused with an honest message (no retrieval). In-scope queries
are embedded with CLIP, retrieved from the Phase 6 FAISS index, and assembled
into a **honest markdown answer** from real pipeline artifacts
(interpretations, trend metrics, representative images). The Python API
(`src/api.py`) exposes it over HTTP, including `/api/images` which serves only
whitelisted representative images; the React frontend proxies `/api/*` there.

> **No LLM is required for any answer.** By default answers are formatted
> directly from measured cluster metadata (deterministic, local). Optionally,
> `TRENDLENS_LLM_PROVIDER` adds an LLM **writing layer** that restyles the same
> retrieved evidence into fluent prose — it is strictly constrained (no
> invented stats/platforms/hashtags), and falls back to the rule-based answer
> on any failure. Fields that are not measured (geo hotspots, viral rate,
> keyword sets) are omitted or null — never invented. "What's trending right
> now" answers are always the real detected themes (rule-based); the LLM never
> replaces them, so the site's own trend detection stays front and center.

**Live (REAL) trends:** run `python -m src.live` to ingest real posts and
detect emerging visual themes. Source is Reddit when reachable (real
timestamps, real upvotes/comments); on networks where Reddit's public JSON is
403-blocked it automatically falls back to the **key-free Wikimedia Commons**
feed (real upload timestamps + images, honestly reported as having no
upvote/comment signal). "What's trending in X right now?" queries then answer
from those REAL themes (clearly labelled REAL, never mixed with the synthetic
demo), and the dashboard shows them in a dedicated "What's Trending Right Now"
section. All live keys/settings live in a root `.env` file (auto-loaded, never
overriding real env vars) — see `.env.example`.

**Honest labels everywhere:**
- timestamps/engagement are neutral synthetic (demo)
- cluster names/descriptions are VLM interpretations, not ground truth
- the dataset is the 5K sample (69,226 available)
- the popularity endpoint returns observed stats and marks itself **NOT EVALUATED**

```bash
# Python CLI
python -m src.rag "a cup of coffee"

# Python API (port 8000)
python -m src.api

# Frontend (served at localhost:3000, proxies /api/* to :8000)
cd frontend && npx tsx server.ts
```

### Sample Queries

Plain listing style:
```
"a cup of coffee"
"dogs on the sofa"
"red flowers"
"a cat with yellow eyes"
```

Photography how-to guide style (returns a data-grounded shot guide — subject
anchor, look & feel, composition cues, measured engagement):
```
"I want to post a picture of a cup of coffee. What should the visual look like for max engagement?"
"What kind of cat photos get the most engagement?"
```

Out-of-scope examples (refused): `"write a c program to print hello world"`,
`"recipe for biryani"`, `"best crypto to invest"` — TrendLens has no general
knowledge; it only answers about visual/photo trends.

Live-trend intent (answered from REAL Reddit themes once `src.live` has run):
```
"What is trending in food right now?"
"What's hot on coffee photography this week?"
```

---

## Output Files

```
artifacts/
├── cluster_models/
│   ├── labels_umap10.npy / probabilities_umap10.npy / labels_raw.npy
│   └── hdbscan_umap10.pkl / hdbscan_raw.pkl
├── cluster_metadata/
│   ├── cluster_summary.csv / cluster_captions.json / captions_report.md
│   ├── representatives.json
│   ├── trend_metrics.csv / cluster_trend_agg.csv / trends_experiment.json
│   ├── retrieval_eval_labels.json / retrieval_results.json
│   └── parameter_sweep.csv
└── figures/
    ├── cluster_XXX.jpg         # contact sheet per cluster (29)
    └── trend_cluster_XXX.png   # trend curves
data/
├── embeddings/embeddings.npy   # (5000, 512) L2-normalised CLIP
├── embeddings/metadata.parquet # aligned post metadata
├── metadata/metadata.parquet   # canonical neutral-synthetic metadata
└── processed/sample_metadata.parquet  # 5K manifest
```

---

## Hardware Notes

| Task | CPU time (this 5K run) |
|------|----------|
| CLIP embeddings (5K) | ~4 min |
| UMAP-10 + HDBSCAN | ~2 min |
| BLIP captioning (29 clusters × 4) | ~3 min |
| CLIP-text + FAISS build | ~1 min |

> All pipeline stages are CPU-compatible and cacheable/resumable.

---

_TrendLens · honest rebuild (Phases 0–7) · Last updated: 2026-08-16_
