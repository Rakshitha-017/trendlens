# TrendLens — Commands Reference

> All commands assume you are in the **project root**: `/path/to/trendlens/`

---

## Prerequisites

### Python (one-time setup)
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install all Python dependencies
pip install -r requirements.txt
```

### Node.js (one-time setup — for the frontend)
```bash
# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install frontend dependencies (from the frontend/ directory)
cd frontend
npm install
cd ..
```

### Environment
```bash
# No API keys are required for the core pipeline — TrendLens runs fully local:
# retrieval, clustering, retrieval QA — no external API is called anywhere in
# the query path.

# OPTIONAL: LLM writing layer (rewrites retrieved evidence into prose).
# Leave unset to stay rule-based (honest, deterministic).
export TRENDLENS_LLM_PROVIDER=gemini      # gemini | openai | ollama
export TRENDLENS_LLM_API_KEY=...          # required for gemini/openai; not for ollama
export TRENDLENS_LLM_MODEL=gemini-3.5-flash   # optional; provider defaults
export TRENDLENS_LLM_BASE_URL=...         # optional; required for ollama

# OPTIONAL: real-time (live) trend ingestion.
# All of these can live in a .env file in the project root (auto-loaded by
# config.py, never overrides real env vars). See .env.example.
# TRENDLENS_LIVE_SOURCE: auto (default) | reddit | wikimedia.
#   auto tries Reddit first; on 403 (datacenter IP) it falls back to the
#   key-free Wikimedia Commons feed (real upload timestamps, no engagement).
# Reddit (for REAL upvote/comment engagement; residential IPs can be
# 403-blocked on the public feed — use OAuth):
export REDDIT_CLIENT_ID=...
export REDDIT_CLIENT_SECRET=...
export TRENDLENS_SUBREDDITS=foodporn,coffee   # watched subreddits
# Wikimedia Commons fallback (key-free, default values shown):
export TRENDLENS_LIVE_SOURCE=auto
export TRENDLENS_WIKIMEDIA_QUERIES=latte art,coffee,street food,breakfast
export TRENDLENS_WIKIMEDIA_LIMIT=10
export TRENDLENS_WIKIMEDIA_DAYS=90
export TRENDLENS_WIKIMEDIA_RECENT_DAYS=30
```

---

## Python Pipeline (run in order, venv must be active)

> Each phase is `python -m src.<module>` and writes to `artifacts/` / `data/`.
> Tests gate every phase: `python -m pytest tests/`
> All expensive stages are cached to disk and resume-safe.

```bash
source venv/bin/activate

# Phase 1 — Neutral synthetic engagement metadata (timestamps, likes, comments)
python -m src.synthetic_data

# Phase 2 — CLIP image embeddings (512-d, L2-normalised), checkpointed/resumable
python -m src.embeddings

# Phase 3 — UMAP (10-D) + HDBSCAN clustering + representative images
python -m src.clustering

# Phase 4 — Temporal aggregation + Rising/Stable/Declining lifecycle labels
python -m src.trends

# Phase 5 — BLIP captions of representatives -> cluster interpretations
python -m src.interpretation

# Phase 6 — CLIP-text FAISS index over interpretations + retrieval evaluation
python -m src.retrieval

# Phase 7 (OPTIONAL, real data) — Live trend ingestion:
#   1) fetch real posts (Reddit, else Wikimedia Commons fallback) -> data/live/live_posts.parquet
#   2) download their images   -> data/live/images/   (throttled hosts: downloads persist across re-runs)
#   3) CLIP-embed              -> data/live/live_embeddings.npy
#   4) HDBSCAN themes + growth -> artifacts/cluster_metadata/live_trends.json
python -m src.live
# Source: r/{foodporn,coffee} via Reddit, else key-free Wikimedia Commons.
# Cap per-run embedding pool with TRENDLENS_LIVE_MAX_EMBED (default 40).
# Idempotent: re-running only adds genuinely new posts.
```

---

## RAG Query System

```bash
source venv/bin/activate

# Ask a question from the Python CLI (prints the honest markdown answer)
python -m src.rag "a cup of coffee"

# Scope gate: out-of-scope queries are refused (no retrieval)
python -m src.rag "write a c program to print hello world"

# Live-trend intent: answered from REAL Reddit themes if you ran python -m src.live
python -m src.rag "what is trending in food right now"
```

---

## Backend API (Python stdlib, port 8000)

```bash
source venv/bin/activate
TRENDLENS_API_PORT=8000 python -m src.api
# Port is read from TRENDLENS_API_PORT (default 8000).
# Endpoints:
#   GET  /api/health            service status + integrity labels
#   POST /api/rag-query         {"query": "..."} -> {answer, inScope, scopeReason, scopeMethod, supportingImages, retrievedClusters}
#   GET  /api/trends            top trends, enriched with name/description/blip_caption/image
#   GET  /api/clusters          all cluster interpretations + metrics + representative image URL
#   GET  /api/images?path=...   whitelisted representative JPEG (404 for anything else)
#   GET  /api/live-trends       real Reddit emerging themes (404-free, honest empty payload until src.live runs)
#   GET  /api/live-images?name= real live post image from data/live/images (basename-only, 404 for traversal)
#   POST /api/predict-popularity honest demo: observed stats, NOT EVALUATED

# Quick smoke test
curl -s http://127.0.0.1:8000/api/health
curl -s -X POST http://127.0.0.1:8000/api/rag-query \
  -H 'Content-Type: application/json' -d '{"query": "red flowers"}'
# Out-of-scope query → inScope:false, no clusters retrieved
curl -s -X POST http://127.0.0.1:8000/api/rag-query \
  -H 'Content-Type: application/json' -d '{"query": "write a c program"}'
```

---

## Frontend (React + Express)

The frontend is in `frontend/`. The Express server (`server.ts`) **proxies
all `/api/*` routes to the Python backend** (`127.0.0.1:8000`) and serves the
React SPA. It never fabricates data — if the backend is down it returns an
explicit "backend offline" message.

```bash
cd frontend
npm install            # one-time

# Start the Express server (serves React SPA + /api/* proxy)
npx tsx server.ts
# → http://localhost:3000
```

> **How the RAG endpoint works:** your query → Express proxy → Python
> `/api/rag-query` → `src/rag.py` runs the two-stage scope gate (keyword
> patterns then ~150 in-scope visual anchors) → if in scope: CLIP text embed →
> FAISS top-k → honest markdown answer from measured cluster metadata.
> Answers are rule-based by default; set `TRENDLENS_LLM_PROVIDER` to have the
> LLM **writing layer** rewrite that same evidence into fluent prose (it is
> never a knowledge source and falls back automatically on any failure).
> A "what's trending right now" query is answered from `src.live` REAL themes
> when `live_trends.json` exists (clearly labelled REAL vs synthetic demo).
> Live-trend answers are always rule-based — the LLM is never applied to them,
> so the site's own detected themes are always what the user sees.
> Source is Reddit when reachable, else the key-free Wikimedia Commons feed;
> Commons honestly reports "no upvote/comment signal" in the answer.

---

## Run Everything

```bash
# Backend (:8000) + frontend (:3000), with cleanup on exit
./scripts/run_all.sh

# Backend only
./scripts/run_backend.sh
```

---

## Tests

```bash
source venv/bin/activate
python -m pytest tests/ -q      # 162 tests covering every phase + API + LLM + live
```

---

## Output Artifacts Reference

| File | Phase | Description |
|------|-------|-------------|
| `data/metadata/metadata.parquet` | 1 | Neutral synthetic engagement metadata (demo, clearly labelled) |
| `data/processed/sample_metadata.parquet` | 1 | 5K manifest aligned to image paths |
| `data/embeddings/embeddings.npy` | 2 | CLIP (5000, 512) L2-normalised |
| `artifacts/cluster_models/*` | 3 | HDBSCAN labels / probabilities / fitted model |
| `artifacts/cluster_metadata/cluster_summary.csv` | 3 | Per-cluster composition |
| `artifacts/cluster_metadata/trend_metrics.csv` | 4 | Lifecycle stage per cluster |
| `artifacts/cluster_metadata/cluster_captions.json` | 5 | **Primary RAG document store** (BLIP interpretations) |
| `data/embeddings/cluster_index.faiss` | 6 | FAISS flat-IP index over CLIP-text interpretations |
| `artifacts/cluster_metadata/retrieval_results.json` | 6 | hit@k / MRR metrics |
| `data/live/live_posts.parquet` | 7 | Real Reddit posts or Wikimedia Commons uploads (deduped; real timestamps; Reddit also has engagement) |
| `data/live/images/<post_id>.jpg` | 7 | Downloaded live post images (persist across re-runs) |
| `data/live/live_embeddings.npy` | 7 | CLIP embeddings of live images (L2-normalised) |
| `artifacts/cluster_metadata/live_trends.json` | 7 | Emerging themes: growth, engagement (Reddit only), representative |

---

## Data Integrity

- **Synthetic demo data:** likes/comments/timestamps/tags/geo are generated,
  not real — results derived from them are demonstration only.
- **VLM interpretations, not ground truth:** cluster names/descriptions come
  from BLIP captions of representative images.
- **5K sample:** this build analyses a 5,000-image sample of the 69,226
  images available locally.
- **REAL live data (Phase 7):** posts/timestamps come from Reddit or the
  Wikimedia Commons feed and are labelled REAL — distinct from the synthetic
  demo corpus. Reddit adds real upvote/comment engagement; Commons honestly
  reports "no upvote/comment signal". Images are host-owned and belong to
  their original uploaders.
- **No fabricated metrics:** anything not measured is omitted or marked
  `NOT EVALUATED`.

---

_Last updated: 2026-08-16 · TrendLens honest rebuild (Phases 0–7)_
