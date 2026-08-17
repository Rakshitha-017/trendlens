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
pip install hdbscan
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

### Environment / API Keys
```bash
# Python backend (optional Gemini for --validate-llm diagnostics only)
# The RAG query path does NOT use Gemini in v5.0. The key is only for CLI diagnostics.
nano .env   # GOOGLE_API_KEY=<your_key>  GEMINI_MODEL=gemini-2.0-flash

# Frontend: no API key needed. server.ts reads cluster_captions.json directly.
# No Gemini call anywhere in the frontend as of v5.0.
```

---

## Python Pipeline (run in order, venv must be active)

> **Note:** Steps 1–7 generate the data artifacts. If `trendlens_outputs/` already has all files, skip to Step 8. Step 8 is required before the frontend can serve real RAG responses.

```bash
source venv/bin/activate

# Step 1 — Generate synthetic engagement metadata (~5–10 min)
python generate_metadata.py

# Step 2 — CLIP image embeddings (512-d, L2-normalized) (~90 min CPU / ~10 min GPU)
#           Resume-safe: will pick up from embeddings_checkpoint.npy if interrupted
python generate_embeddings.py

# Step 3 — UMAP dimensionality reduction (2D + 10D) (~25 min CPU)
python generate_umap.py

# Step 4 — HDBSCAN visual trend clustering (~5–10 min)
python generate_clusters.py

# Step 5 — Temporal trend tracking + lifecycle classification (~1 min)
python generate_temporal_trends.py

# Step 6 — Post-level LightGBM popularity model + cluster predictions (~10 min CPU)
python predict_popularity.py

# Step 7 — BLIP visual captioning per cluster (~2 min cached / ~10 min first run)
python generate_captions.py

# Step 8 — Build FAISS index + validate RAG system (~30 sec)
python rag_query_system.py --build-index --validate
```

---

## RAG Query System (Python CLI)

```bash
source venv/bin/activate

# Build FAISS index from cluster_captions.json (run after generate_captions.py)
python rag_query_system.py --build-index

# Build index AND run benchmark validation
python rag_query_system.py --build-index --validate

# Run a single natural-language query
python rag_query_system.py --query "I am a food blogger posting pasta picture, describe how should the visuals of the picture be, to gain max engagement."

# Test a fashion/event query (new in v5.0 — intent-aware answer, no BLIP caption exposed)
python rag_query_system.py --query "I'm going to a party tonight. What visual aesthetic should I channel?"

# Test the topic guard — should be rejected cleanly
python rag_query_system.py --query "Write a bubble sort algorithm in Python"

# Run with verbose cluster detail
python rag_query_system.py --query "what food trends are rising?" --verbose

# Run benchmark validation only (no index rebuild needed)
python rag_query_system.py --validate

# Run benchmark validation including Gemini LLM responses
python rag_query_system.py --validate --validate-llm

# Interactive REPL mode
python rag_query_system.py --interactive

# Control number of returned clusters
python rag_query_system.py --query "viral fashion trends" --top-k 10
```

---

## Frontend (React + Express)

The frontend is in `frontend/`. It serves a full-stack app:
- **Vite dev server** — serves the React SPA on hot-reload
- **Express API server** (`server.ts`) — serves `/api/rag-query`, `/api/chat`, etc. and reads directly from `trendlens_outputs/cluster_captions.json`

```bash
cd frontend

# Install dependencies (one-time)
npm install

# Start the Express API server (serves React + all /api/* routes)
# This is the MAIN way to run the frontend
npx tsx server.ts

# The app will be available at:
#   http://localhost:3000
```

> **How the RAG endpoint works in the frontend (v5.0):**
> `server.ts` reads `cluster_captions.json` directly at startup. When a query arrives:
> 1. The topic guard (`isInScope()`) checks if the query is social media / visual trend related. Off-topic queries (programming, math, etc.) are rejected immediately.
> 2. The `scoreCluster()` function scores all clusters using keyword + lifecycle matching. Dominant category matches (+75) always beat secondary matches (max +18).
> 3. The intent detector determines if the query is a **fashion/style question**, a **photography/creator question**, or a **general trend question** — and formats the answer accordingly.
> 4. **No LLM is used.** The answer is formatted directly from cluster metadata by `formatClusterAnswer()`.

---

## Complete Startup Checklist (fresh terminal)

```bash
# 1. Activate Python venv (needed if using Python CLI)
cd /path/to/trendlens
source venv/bin/activate

# 2. Ensure FAISS index is built (only needed once, or after re-running generate_captions.py)
python rag_query_system.py --build-index

# 3. In a separate terminal: start the frontend
cd /path/to/trendlens/frontend
npx tsx server.ts
# → open http://localhost:3000

# 4. (Optional) Test RAG from Python CLI directly
python rag_query_system.py --query "I am a food blogger posting pasta, what visuals to use?"
```

---

## Optional Utilities

```bash
source venv/bin/activate

# Export .npy arrays to CSV (useful for spreadsheet inspection)
python convert_npy_to_csv.py

# Validate RAG with Gemini LLM (costs API quota)
python rag_query_system.py --validate --validate-llm
```

---

## Output Artifacts Reference

| File | Generated by | Description |
|------|-------------|-------------|
| `trendlens_outputs/metadata.csv` | Step 1 | 69,226 posts × 25 cols |
| `trendlens_outputs/embeddings.npy` | Step 2 | CLIP (69226, 512) float32 |
| `trendlens_outputs/umap_2d.npy` / `umap_10d.npy` | Step 3 | UMAP projections |
| `trendlens_outputs/metadata_clustered.csv` | Step 4 | + cluster + cluster_prob cols |
| `trendlens_outputs/trend_metrics.csv` | Step 5 | Lifecycle stage per cluster |
| `trendlens_outputs/popularity_model_regression.pkl` | Step 6 | LightGBM model |
| `trendlens_outputs/cluster_captions.json` | Step 7 | **Primary RAG document store** |
| `trendlens_outputs/rag_faiss.index` | Step 8 | FAISS dense index |
| `trendlens_outputs/rag_meta.pkl` | Step 8 | Cluster metadata lookup |

---

_Last updated: 2026-08-12 · TrendLens v5.1_
