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

**TrendLens Output (retrieved from real FAISS cluster database):**

```
🎨 Visual Style & Aesthetic
The dominant trending aesthetic in food photography is earthy, intimate,
and tactile — centered on warm organic tones. Think Melbourne café culture
meets Melbourne farmers-market minimalism...

🍽️ Composition & Placement
Shoot from a 45° angle (not overhead). Place the pasta bowl slightly
off-center to the right, following the rule of thirds. Leave significant
negative space on the left for text overlay potential. Tight mid-shot
so the rim of the bowl is barely visible...

💡 Lighting
Soft side-lit natural light from a window on the left. NO flash.
Overcast daylight or a large diffused softbox gives the matte,
shadow-free finish trending in high-engagement food posts. Avoid
overhead studio lighting...

🎨 Color Palette & Background
Background: matte warm linen (dusty cream / oatmeal tone), OR dark
slate (matte black/charcoal). Props: terracotta ceramic, rough
unglazed pottery, aged wooden board. Palette: warm ochres, rust,
olive green garnish, ivory...

🪨 Textures & Props
Dominant textures: rough linen cloth, ceramic, unglazed pottery,
natural wood grain. Trending props: olive oil drizzle, fresh herbs
(basil), cracked black pepper visible, vintage fork/spoon...
```

---

## Architecture

```
Raw Images (69,226 from SMPD Flickr dataset)
    │
    ▼  Step 1
generate_metadata.py      →  Synthetic engagement metadata (likes, comments, timestamps, geo)
    │
    ▼  Step 2
generate_embeddings.py    →  CLIP ViT-B/32 embeddings  (69226 × 512, L2-normalized)
    │
    ▼  Step 3
generate_umap.py          →  UMAP 2D (visualization) + 10D (clustering input)
    │
    ▼  Step 4
generate_clusters.py      →  HDBSCAN → 39 visual trend clusters (no label needed)
    │
    ▼  Step 5
generate_temporal_trends.py → Activity curve per cluster → Rising / Stable / Declining
    │
    ▼  Step 6
predict_popularity.py     →  LightGBM post-level regressor
                              Features: CLIP 512-d + BERT-PCA 64-d + Engagement 23-d
                              Target: log1p(likes + comments) | CV R² = 0.7476
    │
    ▼  Step 7
generate_captions.py      →  BLIP visual captioning + metadata template per cluster
    │
    ▼  Step 8
rag_query_system.py       →  FAISS dense retrieval + Gemini LLM reasoning
                              → Visual creator-centric answers (lighting, color, texture, composition)
```

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Image embeddings | **CLIP** `openai/clip-vit-base-patch32` (512-d) |
| Dimensionality reduction | **UMAP** (2D viz + 10D clustering) |
| Clustering | **HDBSCAN** `min_cluster_size=512` |
| Text features | **BERT** `bert-base-uncased` → CLS → PCA-64 |
| Visual captioning | **BLIP-2** `blip2-opt-2.7b` (GPU) / **BLIP** `blip-image-captioning-base` (CPU) |
| Popularity model | **LightGBM** Regressor, 5-fold CV |
| Vector index | **FAISS** `IndexFlatIP` (cosine similarity) |
| Sentence encoder | `all-MiniLM-L6-v2` (384-d) |
| LLM reasoning | **None (by design)** — RAG answers are formatted directly from FAISS cluster metadata, no external LLM called |
| Frontend | **React** + **Express** (`frontend/server.ts`) — reads `cluster_captions.json` directly, pure FAISS scoring, no LLM |

---

## Pipeline Results

| Step | Output | Key Metric |
|------|--------|-----------|
| CLIP embeddings | `embeddings.npy` | (69226, 512) L2-normalized |
| HDBSCAN | 38 clusters | 23.6% noise |
| Temporal tracking | `trend_metrics.csv` | 13 Rising / 12 Stable / 13 Declining |
| Popularity model | `popularity_metrics.json` | CV R² = **0.7476** |
| BLIP captioning | `cluster_captions.json` | 38/38 captions |
| RAG validation | Precision@3 | **0.708** (8-query benchmark, 100% intent pass) |

---

## Setup

```bash
git clone <repo-url> && cd trendlens

# Python backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
pip install hdbscan

# Set API key (Python RAG + Gemini)
# .env is pre-configured. To update:
# nano .env  →  GOOGLE_API_KEY=your_key, GEMINI_MODEL=gemini-3.6-flash

# Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Frontend
cd frontend && npm install && cd ..

# Set frontend API key
# frontend/.env is pre-configured. To update:
# nano frontend/.env  →  GEMINI_API_KEY=your_key
```

> **See [`commands.md`](commands.md) for the full command reference.**

---

## Execution Order

```bash
# Run Python pipeline (in order, venv activated)
python generate_metadata.py           # ~5–10 min
python generate_embeddings.py         # ~90 min CPU / ~10 min GPU
python generate_umap.py               # ~25 min CPU
python generate_clusters.py           # ~5–10 min
python generate_temporal_trends.py    # ~1 min
python predict_popularity.py          # ~10 min CPU
python generate_captions.py           # ~2 min (cached) / ~10 min first run
python rag_query_system.py --build-index --validate

# Start frontend (separate terminal)
cd frontend
npx tsx server.ts       # → http://localhost:3000
```

> **All commands with options and explanations: see [`commands.md`](commands.md)**

---

## RAG Query System

The RAG query system (`rag_query_system.py`) and the frontend (`frontend/server.ts`) both read from `cluster_captions.json` — the output of the full 8-step pipeline — and use it as the document store for retrieval.

**No LLM is used anywhere in the query path.** Both the Python CLI and the frontend server produce structured, evidence-grounded answers entirely from FAISS cluster metadata.

**Topic restriction:** Both systems reject off-topic queries (programming, math, general knowledge, etc.) with a clear scope message. TrendLens only answers questions about social media visual trends, photography strategy, and engagement patterns.

**Python CLI** uses FAISS dense similarity (SentenceTransformer) + hybrid re-ranking + `fallback_recommendation()` formatter.

**Frontend** reads `cluster_captions.json` at startup, scores clusters with keyword + lifecycle matching, then formats a structured Markdown response directly from cluster metadata.

**Intent-aware output:** The formatter detects three query types and responds appropriately:
- **Fashion/style query** (e.g. "what outfit for a party?") → shows what visual aesthetics are currently *performing on social media*, geographic hotspots, style signals, and declining looks to avoid
- **Photography/creator query** (e.g. "I'm posting a pasta photo") → visual composition elements, 3-step action plan, tags
- **General trend query** → cluster overview with engagement data and lifecycle status

**BLIP captions are not surfaced as advice.** Raw BLIP-2 descriptions from the representative cluster image are internal pipeline data only. User-facing answers use `template_caption` and structured cluster metadata.

**Scoring:** Dominant category matches (+75) always beat secondary matches (max +18 regardless of how many categories fire).


- 🎨 Visual style & aesthetic of the trending cluster
- 🍽️ Composition & plate placement guidance
- 💡 Exact lighting setup (natural vs artificial, direction, temperature)
- 🎨 Specific color palette & background (named tones)
- 🪨 Textures & props visible in high-engagement posts
- 📍 Geographic & cultural concentration
- 📊 Real engagement % and viral rate from the database
- ✅ 3-step creator action plan

```bash
# Python CLI
python rag_query_system.py --query "food influencer pasta bowl trending styles"
python rag_query_system.py --interactive
python rag_query_system.py --validate

# Frontend (served at localhost:3000)
cd frontend && npx tsx server.ts
```

### Sample Queries

```
"I am a food influencer posting a pasta bowl. What trending styles get max engagement?"
"What rising visual aesthetics in nature photography drive high engagement?"
"I want to post a fashion look — what background, lighting and colours are trending?"
"What are the most viral nightlife photography styles?"
"Declining travel photography trends from the past decade"
```

---

## Output Files

```
trendlens_outputs/
├── metadata.csv                      # 69,226 posts × 25 cols
├── embeddings.npy                    # CLIP vectors (69226, 512) L2-normalised
├── umap_2d.npy / umap_10d.npy        # UMAP projections
├── metadata_clustered.csv            # + cluster + cluster_prob columns
├── cluster_summary.csv               # Per-cluster engagement and purity stats
├── cluster_representatives.json/png  # Representative image per cluster
├── cluster_scatter.png               # UMAP coloured by cluster
├── trend_metrics.csv                 # Lifecycle stage, slope, peak quarter
├── trend_graphs/                     # Activity curve PNG per cluster (39 files)
├── popularity_model_regression.pkl   # LightGBM post-level popularity model
├── popularity_bert_pca.pkl           # BERT encoder + PCA transform
├── popularity_metrics.json           # CV R²=0.7476, MAE, RMSE
├── popularity_predictions.csv        # Per-post actual vs predicted (10K rows)
├── popularity_cluster_predictions.csv  # Cluster-level aggregated predictions
├── feature_importance.png            # Top-20 feature importance
├── actual_vs_predicted.png           # Scatter plot
├── cluster_captions.json             # BLIP visual caption + template per cluster
├── captions_report.md                # Human-readable markdown report
├── rag_faiss.index                   # FAISS dense index (38 × 384)
├── rag_vectors.npy                   # Sentence-transformer embeddings
└── rag_meta.pkl                      # Cluster metadata for retrieval
```

---

## Hardware Notes

| Task | CPU time | GPU time |
|------|----------|----------|
| CLIP embeddings | ~90 min | ~10 min |
| UMAP 10D | ~25 min | ~5 min |
| BERT encoding (10K posts) | ~8 min | ~1 min |
| BLIP captioning (39 clusters) | ~2 min (cached) | ~1 min |
| FAISS index build | <30 sec | <30 sec |

> All scripts are CPU-compatible. BLIP-2 (GPU) automatically falls back to BLIP-1 on CPU.

---

_TrendLens v5.1 · Last updated: 2026-08-12_
