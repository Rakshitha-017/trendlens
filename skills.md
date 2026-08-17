# TrendLens — Project Skills & Context Reference

> **Purpose:** Canonical context document for TrendLens. Describes the honest
> rebuild (Phases 0–7): architecture, pipeline stages, measured results, data
> schema, design decisions and integrity rules — for future development,
> AI-assisted sessions and onboarding.
>
> **Current state (2026-08-16):** All 7 pipeline phases complete and verified.
> 162/162 tests pass. Frontend (React + Express proxy) serves only real,
> measured pipeline data. Answers are rule-based by default with an **optional
> LLM writing layer** (env opt-in, never a knowledge source) and a **real-time
> trend feed** (Reddit when reachable, otherwise a **key-free Wikimedia
> Commons** fallback — clearly labelled REAL vs synthetic demo).

---

## 0. Data Integrity Policy (non-negotiable)

1. **No fabricated results.** Nothing is reported that was not measured.
   Fields that are not measured (geo hotspots, viral rate, keyword sets,
   prediction scores) are `null`/omitted — never invented.
2. **Synthetic labels are labelled.** Likes/comments/timestamps/tags/geo are
   generated demo data (`is_synthetic` / `timestamp_source=neutral-synthetic`).
   Results derived from them are demonstration only — never research findings.
3. **VLM output is interpretation, not ground truth.** Cluster names and
   descriptions come from BLIP captions of representative images and carry an
   explicit confidence value.
4. **Dataset scope is stated.** This build analyses a **5,000-image sample**
   of the 69,226 images available locally — never the full set.
5. **LLM is a writing layer only (if enabled).** RAG answers are always formed
   from pipeline artifacts first. `TRENDLENS_LLM_PROVIDER` may be set to have
   the LLM *rewrite that same evidence* into fluent prose — it is never a
   knowledge source, a STRICT anti-hallucination prompt is enforced, and any
   failure falls back to the rule-based answer. Without it, everything stays
   deterministic and local. **Exception:** "what's trending right now" answers
   are ALWAYS the rule-based live themes — the LLM never replaces real trend
   data, because the point of the site is TrendLens' own detection.
6. **REAL vs synthetic is labelled.** Live trends (Reddit timestamps +
   engagement, or Wikimedia Commons upload timestamps + images) are real and
   carry `config.LIVE_DATA_WARNING`; the SMPD sample cluster data carries
   `SYNTHETIC_DATA_WARNING`. Answers state which is which.
7. **`predict-popularity` is NOT EVALUATED** (no prediction model exists).
8. **`.env` is loaded but never overrides.** `config.py` loads `<root>/.env`
   into the environment with a stdlib `_load_dotenv` (no python-dotenv dep);
   existing env vars always win, so CI/secrets-in-shell still work.

> This policy is enforced in code: `config.SYNTHETIC_DATA_WARNING` is embedded
> in every artifact and API response; `src/rag.py` only emits measured fields.

---

## 1. Project Overview

**TrendLens** is a multimodal visual trend-detection system over SMPD Flickr
images. It clusters images by CLIP visual semantics, tracks each cluster's
activity over time, interprets each cluster with a vision-language model, and
answers natural-language queries through a FAISS retrieval + honest formatter.

**Research question:** Can visual clusters derived from image embeddings
reveal emerging patterns, and can they be queried conversationally?

**Hypothesis to test (not assumed):** visual trends may appear before textual
labels. The pipeline is built so this can be *measured*, not asserted.

**Integrity note:** timestamps/engagement are neutral synthetic demo data, so
the temporal signal is expected to be noise-dominated — a real limitation that
is reported honestly rather than rigged.

---

## 2. Repository Layout

```
trendlens/
├── config.py                   # Central config: paths, dataset schema, integrity labels
├── requirements.txt            # Python dependencies
├── README.md                   # User-facing overview + honest results
├── commands.md                 # All commands to run the project end-to-end
├── skills.md                   # This document — canonical context
├── train/                      # Image root (subdirs by user_id) — NOT committed
├── train_img_filepath.txt      # Manifest: train/<user_id>/<photo_id>.jpg — NOT committed
├── trendlens_outputs/          # Dataset inputs (metadata.csv, smpd_metadata.json) — NOT committed
├── src/                        # ★ Pipeline modules (python -m src.<module>)
│   ├── synthetic_data.py       # Phase 1 — neutral synthetic timestamps
│   ├── data_loader.py          # Loading, schema mapping, deterministic sampling
│   ├── preprocessing.py        # Image validation / preprocessing
│   ├── embeddings.py           # Phase 2 — CLIP image embeddings
│   ├── clustering.py           # Phase 3 — UMAP-10 + HDBSCAN
│   ├── trends.py               # Phase 4 — temporal aggregation + lifecycle
│   ├── interpretation.py       # Phase 5 — BLIP captions → cluster interpretations
│   ├── retrieval.py            # Phase 6 — CLIP-text FAISS index + eval
│   ├── rag.py                  # Phase 7 — query → scope gate → honest answer (rule-based + live override)
│   ├── llm.py                  # OPTIONAL writing layer — rewrites evidence into prose (env opt-in)
│   ├── live.py                 # OPTIONAL real-time trends: Reddit → Wikimedia fallback → live_trends.json
│   └── api.py                  # Phase 7 — stdlib HTTP API (:8000)
├── tests/                      # 162 tests gating every phase
├── notebooks/                  # Executed notebooks: 01, 03, 04, 05, 06, 07
├── scripts/
│   ├── run_all.sh              # Backend :8000 + frontend :3000
│   └── run_backend.sh          # Backend only
├── frontend/                   # React + Express (proxies /api/* → Python :8000)
│   ├── server.ts               # Express: serves SPA + /api/* proxy (never fabricates)
│   ├── src/                    # React SPA (Vite)
│   └── package.json
├── data/                       # Pipeline intermediates (git-ignored)
├── artifacts/                  # Pipeline outputs (git-ignored)
└── TrendLens_Project_Proposal.docx  # Original project proposal
```

> **Data vs code:** `train/`, `train_img_filepath.txt`, `trendlens_outputs/`,
> `data/`, `artifacts/` are git-ignored — a fresh clone contains code + tests
> + notebooks only. The pipeline requires the local dataset to be present.

---

## 3. Execution Order

```bash
source venv/bin/activate
cp .env.example .env   # optional: LLM key, live source, Reddit creds

python -m src.synthetic_data     # Phase 1 — neutral synthetic timestamps (demo, honest)
python -m src.embeddings         # Phase 2 — CLIP 5K embeddings, checkpointed/resumable
python -m src.clustering         # Phase 3 — UMAP-10 + HDBSCAN + representatives
python -m src.trends             # Phase 4 — temporal aggregation + lifecycle labels
python -m src.interpretation     # Phase 5 — BLIP captions -> cluster interpretations
python -m src.retrieval          # Phase 6 — CLIP-text FAISS index + retrieval eval
python -m src.rag "a cup of coffee"   # Phase 7 — CLI query
python -m src.api                # Phase 7 — HTTP API on :8000

# OPTIONAL — real-time trend ingestion (REAL Reddit/Wikimedia data, labelled as such)
python -m src.live               # fetch → embed → HDBSCAN themes → live_trends.json

# Tests gate every phase:
python -m pytest tests/ -q       # 162 tests
```

Run the full stack with `./scripts/run_all.sh` (backend :8000 + frontend :3000).

---

## 4. Pipeline Phases and Measured Results

| Phase | Module | What it does | Measured result |
|-------|--------|--------------|-----------------|
| 0 | `config.py` / `src/data_loader.py` | Paths, dataset schema mapping, sampling | Deterministic 5K sample, seed 42 |
| 1 | `src/synthetic_data.py` | Replaces legacy category-biased timestamps with **neutral uniform** 2010–2019 | `data/metadata/metadata.parquet` |
| 2 | `src/embeddings.py` | CLIP ViT-B/32, L2-normalised | `(5000, 512)`, checkpointed/resumable |
| 3 | `src/clustering.py` | UMAP-10 → HDBSCAN (+ PCA baseline, sweep) | **29 clusters**, 26.4% noise (73.6% clustered), silhouette **0.586** |
| 4 | `src/trends.py` | Per-cluster activity curve → Rising/Stable/Declining | **15 Rising / 10 Stable / 4 Declining** (noise-dominated — honest) |
| 5 | `src/interpretation.py` | BLIP captions of 4 representatives per cluster | 29/29 clusters, mean confidence **0.073** |
| 6 | `src/retrieval.py` | CLIP-text embeddings + FAISS flat-IP index + hit@k/MRR eval | hit@1 **0.95** · hit@5 **0.95** · MRR **0.95** (20 curated queries) |
| 7 | `src/rag.py` + `src/api.py` | Query → CLIP text embed → FAISS top-k → scope gate → honest markdown | API verified end-to-end via frontend proxy |

### Phase 3 details — clustering

- UMAP 10-D (`n_neighbors=30`, `min_dist=0.0`, cosine → euclidean for HDBSCAN),
  seed 42 for reproducibility.
- HDBSCAN (`min_cluster_size`/`min_samples` chosen by sweep in
  `parameter_sweep.csv`; chosen config → 29 clusters, 26.4% noise).
- PCA baseline kept for comparison (silhouette 0.170 vs UMAP-10 0.586).

### Phase 4 details — temporal lifecycle

- Activity curve per cluster over quarterly bins; lifecycle from a
  growth/size/stability trend score (`trend_score_growth_size_stability`).
- Because timestamps are neutral synthetic, the resulting lifecycle split is
  **noise-dominated** — reported as such. No category-biased rigging.

### Phase 6 details — retrieval

- Query text embedded with **CLIP text encoder** (same space as images), not a
  separate sentence-transformer — shared vision–language space.
- FAISS `IndexFlatIP` over cluster interpretation embeddings (29 documents).
- 20 human-curated queries (evidence: Phase 5 BLIP captions of representative
  images; recorded in `retrieval_eval_labels.json`). hit@1 **0.95**, hit@5
  **0.95**, MRR **0.95** after `cluster_corpus_text` was fixed to join the
  cluster name and description (previously it dropped the name — the corpus
  text was just the description, hurting alignment). Honest misses remain
  ("a baby" absent from top-5) — real CLIP alignment quirks, not hidden.

### Phase 7 scope gate — out-of-scope refusal

- `src/rag.py` runs a two-stage scope classifier before any retrieval:
  1. **Keyword gate** — `_DECISIVE_OUT_PATTERNS` hard-blocks off-topic intents
     (programming "write a c program", recipes, generic finance/invest advice,
     hard-science "why is the sky blue") regardless of visual similarity.
  2. **Anchor gate** — cosine of the query against ~150 in-scope visual
     anchors (`SCOPE_DOMAIN_ANCHORS`, e.g. "flowers", "moon", "coffee") vs
     out-scope anchors. In-scope iff `domain >= 0.22` and
     `(domain - out) >= -0.01`.
- Verified: 0/32 probes mis-classified; all 20 short visual queries in scope;
  "write a c program to print hello world" → refused (scopeMethod `keywords`).
- Anchor embed cache is keyed on exact anchor text in
  `data/embeddings/scope_anchors.json` — edits auto-invalidate (no stale cache).

### Photography how-to guide mode

- If a query asks *how to shoot/frame/style a subject for engagement*
  ("post a picture of X — what should the visual look like for max
  engagement?"), `_is_advice_intent()` switches to `format_advice_answer()`
  instead of the cluster listing.
- The guide is built **only** from the retrieved clusters' real BLIP keywords
  and captions (subject anchor, look & feel, composition cues, the
  representative shot) plus measured engagement/trend stats. Engagement
  recommendations compare the top-5 clusters' measured averages; if the
  highest-engagement cluster's keywords do **not** overlap the subject's, the
  answer says so plainly (no invented "viral hacks").

---

## 5. Data Schema

### Input metadata (`trendlens_outputs/metadata.csv` → `data/metadata/metadata.parquet`)

Synthetic engagement per image (69,226 rows). Canonical columns after
`apply_dataset_config()`:

| Column | Type | Description |
|--------|------|-------------|
| `post_id` | str | `{user_id}_{photo_id}` — unique key |
| `user_id` | str | Flickr-style identifier |
| `image_path` | str | `train/<user_id>/<photo_id>.jpg` |
| `timestamp` | datetime (UTC) | **neutral synthetic**, 2010–2019, seed 42 |
| `likes` / `comments` | int | synthetic demo engagement |
| `caption` | str/NaN | absent for local SMPD (`caption_column=None`) |
| `timestamp_source` | str | `"neutral-synthetic"` (provenance, Phase 1) |

> Schema mapping is data-driven via `config.DATASET_CONFIG` — arbitrary
> datasets can be supported without code changes.

### Cluster interpretations (`artifacts/cluster_metadata/cluster_captions.json`)

```json
{
  "disclaimer": "SYNTHETIC DEMO DATA: ...",
  "note": "...",
  "interpretations": [
    {
      "cluster_id": 0,
      "name": "dog laying",
      "description": "A visual cluster whose images are described by: dog, laying, blanket, couch, green, small",
      "characteristics": ["dog", "laying", "blanket", "couch", "green", "small"],
      "confidence": 0.0792,
      "sample_captions": ["a dog laying on a green blanket", "..."]
    }
  ]
}
```

### Trend metrics (`artifacts/cluster_metadata/trend_metrics.csv`)

`cluster_id, n_posts, mean_period_posts, recent_growth, percentage_growth,
slope, rolling_growth, acceleration, median_engagement, average_engagement,
trend_score_growth, trend_score_growth_size, trend_score_growth_size_stability,
lifecycle, text_trend_score`

---

## 6. RAG Query System (Phase 7)

### Architecture

```
User query
    → two-stage scope gate (keywords → ~150 in-scope anchors vs out-scope anchors)
    → refused? → honest out-of-scope markdown answer (no retrieval)
    → CLIP text encoder (clip-vit-base-patch32, same space as images)
    → FAISS IndexFlatIP over 29 cluster interpretations
    → top-k clusters
    → "what's trending right now?" → override with REAL live Reddit themes
         (if artifacts/cluster_metadata/live_trends.json exists)
    → honest markdown answer from measured artifacts:
         name/description/characteristics (VLM interpretation + confidence)
         lifecycle, n_posts, avg engagement, growth (trend_metrics.csv)
         representative image path
     → OPTIONAL LLM writing layer (TRENDLENS_LLM_PROVIDER set):
         rewrites the SAME evidence into fluent prose; STRICT no-invent rules;
         any failure → automatic rule-based fallback.
         NOT applied to live-trend answers (those stay real-data rule-based).
     → answerMode: "rule-based" | "llm-gemini" | "llm-openai" | "llm-ollama"
```

`src/rag.py` exposes `run_query(query, k=5)` used by both the CLI and the API.
A `.env` file in the project root is auto-loaded by `config.py` (stdlib
loader, never overrides existing env vars; see `.env.example`) for
`TRENDLENS_LLM_*`, `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`,
`TRENDLENS_LIVE_SOURCE`, `TRENDLENS_WIKIMEDIA_*`,
`TRENDLENS_API_HOST`/`TRENDLENS_API_PORT`.
`src/api.py` is a **stdlib-only** `http.server` app (no FastAPI/uvicorn) on
`TRENDLENS_API_PORT` (default `:8000`):

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/api/health` | GET | status + integrity labels |
| `/api/rag-query` | POST | `{answer, inScope, scopeReason, scopeMethod, supportingImages, retrievedClusters, ...}` |
| `/api/trends` | GET | top trends, enriched with `name`/`description`/`blip_caption`/`representative_image_url` |
| `/api/clusters` | GET | all interpretations + metrics + representative image URL |
| `/api/images?path=...` | GET | whitelisted representative JPEG (404 otherwise) |
| `/api/live-trends` | GET | real emerging themes (Reddit or Wikimedia Commons; honest empty payload until `src.live` runs) |
| `/api/live-images?name=...` | GET | real live post image (basename-only; 404 on traversal) |
| `/api/predict-popularity` | POST | observed stats + **NOT EVALUATED** |

### LLM writing layer (`src/llm.py`, OPTIONAL)

- Env opt-in: `TRENDLENS_LLM_PROVIDER` (`gemini|openai|ollama`), `_API_KEY`,
  `_MODEL`, `_BASE_URL`. Unset → everything stays rule-based and local.
- The LLM receives **only** the trimmed retrieved evidence (`_trim_evidence`:
  query, top clusters with measured stats, live trends if present) + a STRICT
  system prompt (no invented stats/platforms/hashtags; synthetic vs real
  labelling must be preserved; footer cites the source). It never sees the raw
  pipeline, never invents knowledge.
- `format_answer_with_llm()` returns `None` on any failure (network, malformed
  response, disabled) → `run_query` falls back to the deterministic answer.
- No new Python deps: plain `requests` to Gemini / OpenAI / Ollama REST APIs.

### Real-time trend feed (`src/live.py`, OPTIONAL)

- `python -m src.live`: fetch live posts (Reddit for `TRENDLENS_SUBREDDITS`,
  default `foodporn,coffee`; else Wikimedia Commons) → dedupe into
  `data/live/live_posts.parquet` → download images to `data/live/images/` →
  CLIP-embed (`live_embeddings.npy`) → HDBSCAN into themes →
  `artifacts/cluster_metadata/live_trends.json`.
- **REAL data**: Reddit `created_utc`/score/comments, or Commons upload
  timestamps + images, are genuine (distinct from the synthetic SMPD demo).
  Labels say so (`LIVE_DATA_WARNING`); dashboard section is "REAL Data ·
  Reddit/Wikimedia".
- Theme = recent-window vs prior-window growth (`growth_rate`, `None` = brand
  new), avg real engagement (Reddit only), source/channel provenance
  (`channel_label`), BLIP caption + keywords of the representative real post,
  and a "What to do" direction list built only from those words.
- `format_live_trends_answer` is deliberately **lean, tailored and actionable**:
  header names the user's subject when one is mentioned ("For pasta, the
  trending look to borrow is:"), then per theme a "What to do:" list of
  concrete photo directions (e.g. "Shoot in warm, natural-toned light",
  "Scatter small props or ingredients around the plate") — each direction is
  generated from a real detected keyword via `_PHOTO_DIRECTIONS`, never
  invented. When the subject (e.g. pasta) isn't in the live feed,
  scene-specific themes whose *name* has an unrelated object word (e.g.
  "coffee") are dropped and only aesthetic-transferable looks remain, plus a
  one-line note that no subject-specific trend exists yet. No source/engagement
  fluff in the prose — provenance stays in the API response `disclaimer` field
  and the dashboard badges.
- `_live_trend_intent()` catches "what's trending/hot in X right now" queries
  and overrides the answer with `format_live_trends_answer()`.
- **Sources & integrity:**
  - `TRENDLENS_LIVE_SOURCE` = `auto` (default) | `reddit` | `wikimedia`.
    `auto` tries Reddit first, falls back to Wikimedia Commons key-free.
  - Reddit: OAuth (`REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`, preferred) or
    public JSON with a polite User-Agent. Public JSON is often 403-blocked
    from datacenter IPs — a failed subreddit is skipped, never fatal; the
    `auto` source then falls back to Commons. Themes carry REAL upvotes +
    comments (`has_engagement=True`, `channel_label` like `r/coffee`).
  - Wikimedia Commons: category members sorted by upload timestamp (recent
    first) per `TRENDLENS_WIKIMEDIA_QUERIES` (default
    `latte art,coffee,street food,breakfast`), `generator=search` as a
    fallback. `list=newfiles` returns empty and plain search returns mostly
    old files, so category-recent is the primary path. Commons is honest
    about having **no upvote/comment signal** (`has_engagement=False`,
    `channel_label` like `wikimedia search: latte art`). The anonymous API
    and image CDN rate-limit (429) — `_api_get` retries with backoff,
    downloads persist to `data/live/images/` and are spaced/resumed across
    runs; per-run pool is capped at `TRENDLENS_LIVE_MAX_EMBED` (default 40)
    and `TRENDLENS_LIVE_MAX_EMBED=12` style bounds are used on throttled
    hosts. Commons uses wider windows: `TRENDLENS_WIKIMEDIA_DAYS` scan
    (90) + `TRENDLENS_WIKIMEDIA_RECENT_DAYS` (30) vs Reddit's 7-day window.
- Growth formatting is sign-aware (`-75%`, `+12%`); `growth_rate` `None` =
  "brand new this window" (recent > 0, prior == 0).

### Frontend (`frontend/server.ts`)

The Express server **proxies all `/api/*` to the Python backend** and serves
the Vite React SPA. It contains no scoring logic and no fabricated data — if
the backend is down it returns an explicit "backend offline" message. Env
overrides (all optional): `TRENDLENS_API_HOST`, `TRENDLENS_API_PORT`, `PORT`.

### Frontend pages (all real data)

- `/` LandingPage, `/chat` ChatbotPage (warm-toned RAG chat) — standalone.
- `/dashboard`, `/clusters`, `/query`, `/prediction`, `/analytics` live inside
  the `Layout` (Sidebar + Header). All fetch real data via
  `services/apiClient.ts`; `pages/*` render real cluster fields
  (`average_engagement`, `n_posts`, `trend_score`, `lifecycle`,
  `representative_image_url`) — no mock data. `data/mockData.ts` was deleted.
- Chat renders `supportingImages` thumbnails and an out-of-scope banner when
  `inScope === false`.
- `PredictionPage`/`PredictionCard` are honest: `predicted*` fields are `null`
  by design, only observed cluster stats are shown, status **NOT EVALUATED**.
- Representative images: `representative_image_url` is `/api/images?path=...`;
  the backend serves it only if the path is whitelisted from
  `artifacts/cluster_metadata/representatives.json`. Paths carry a `train/`
  prefix (stripped before resolving under `config.IMAGE_ROOT`); the whitelist
  is checked against the prefixed form. Non-whitelisted/traversal → 404.

---

## 7. Key Design Decisions

1. **CLIP for embeddings** — joint image–text space: one encoder for both the
   visual clustering side and the text query side (no separate model, no
   domain gap).
2. **UMAP-10 → HDBSCAN** — UMAP preserves local density; 10-D (not 2-D) keeps
   structure for clustering while avoiding the curse of dimensionality.
3. **`min_dist=0.0` for the clustering UMAP** — tightens density peaks HDBSCAN
   needs; non-zero artificially spreads points.
4. **Neutral synthetic timestamps (Phase 1)** — the legacy category-biased
   Gaussian timestamps were *designed* to force Rising/Stable/Declining. They
   were replaced with uniform deterministic ones so the honest result
   (noise-dominated signal) is visible.
5. **CLIP-text retrieval** — shares the CLIP space with images; the 20-query
   eval (hit@1 0.95, MRR 0.95) documents real CLIP zero-shot alignment
   behaviour, misses included.
6. **FAISS IndexFlatIP** — exact inner product = cosine on L2-normalised
   vectors; 29 documents need no ANN.
7. **Stdlib HTTP API** — zero web-framework dependency, Colab/free-tier-safe.
8. **Honest formatter** — RAG answers come straight from measured artifacts;
   anything unmeasured is `null` and the response footer repeats the synthetic
   disclaimer.
9. **Caching everywhere** — embeddings, text embeddings, FAISS index and
   cluster models are persisted and resumable; interrupted runs don't restart.
10. **LLM as writer, not oracle** — if enabled it restyles retrieved evidence
    only; the pipeline never depends on it, and answers remain truthful
    without it.
11. **Live data separated & labelled** — real trend data is stored under
    `data/live/` and `live_trends.json`, surfaced only for live-intent queries
    and a dedicated dashboard section, and tagged REAL (Reddit or Wikimedia
    Commons) so it is never confused with the synthetic SMPD demo.
12. **Source fallback** — `auto` tries Reddit, falls back to key-free
    Wikimedia Commons, so "what's trending right now" still answers honestly
    even on networks where Reddit's public JSON is 403-blocked.

---

## 8. Dependencies

`requirements.txt` (single install):

```
numpy, pandas, pyarrow, scipy, scikit-learn, Pillow,
torch, torchvision, transformers, safetensors, huggingface_hub,
faiss-cpu, hdbscan, umap-learn, pynndescent,
matplotlib, seaborn, tqdm, PyYAML, requests, pytest
```

Frontend: React 19 + Vite 6 + Express + Tailwind 4 + recharts + framer-motion
(`frontend/package.json`). No LLM/Gemini package anywhere.

> Removed in the honest rebuild: `sentence-transformers`, `google-genai`,
> `python-dotenv` (Python), `lightgbm`, `@google/genai` (frontend) — none are
> used by the current pipeline.

---

## 9. Reproducibility

- Single seed **42** everywhere (`np.random.default_rng(42)`, `random.Random(42)`,
  UMAP `random_state=42`).
- Every phase is deterministic and cached; re-running produces identical output.
- Artifacts record their provenance (`experiment_config.json`, disclaimers,
  `timestamp_source`, curation notes in eval labels).

---

## 10. Status Summary

| Phase | Module | Status | Key metric |
|-------|--------|--------|------------|
| 0 | `config.py` / `data_loader.py` | ✅ | 5K sample, seed 42 |
| 1 | `synthetic_data.py` | ✅ | neutral timestamps, provenance column |
| 2 | `embeddings.py` | ✅ | (5000, 512) CLIP, resumable |
| 3 | `clustering.py` | ✅ | 29 clusters, 26.4% noise, silhouette 0.586 |
| 4 | `trends.py` | ✅ | 15/10/4 lifecycle (noise-dominated, honest) |
| 5 | `interpretation.py` | ✅ | 29/29, mean confidence 0.073 |
| 6 | `retrieval.py` | ✅ | hit@1 0.95 · hit@5 0.95 · MRR 0.95 |
| 7 | `rag.py` / `api.py` | ✅ | scope gate, live override, verified via frontend proxy |
| — | `llm.py` (optional) | ✅ | writing layer: env opt-in, strict rules, auto fallback |
| — | `live.py` (optional) | ✅ | real Reddit/Wikimedia themes → `live_trends.json` + `/api/live-trends` |
| Tests | `tests/` | ✅ | 162/162 pass |
| Frontend | `frontend/server.ts` | ✅ | proxy-only, never fabricates |

### Known limitations (reported, not hidden)

- Engagement/timestamp labels are synthetic → temporal trends are
  noise-dominated; nothing here is a research finding about real behaviour.
- Cluster interpretations are VLM output with low mean confidence (0.073).
- Retrieval eval labels are curated from BLIP captions (no real SMPD labels
  exist locally), and CLIP has honest zero-shot misses.
- The scope gate is deliberately narrow (visual/photo keywords) — general
  knowledge, programming, recipes and finance questions are refused.
- Popularity prediction is **NOT EVALUATED** — no model exists; the endpoint
  returns observed cluster stats only.
- Live trends need network access. Reddit's public JSON is often 403-blocked
  from datacenter IPs (use OAuth or a residential network); the `auto` source
  then falls back to key-free Wikimedia Commons, which honestly reports no
  upvote/comment signal and throttles anonymous image downloads (429) — runs
  persist downloads and continue across re-runs. With no live data at all,
  "what's trending right now" queries honestly say no live trends are
  ingested yet.
- The LLM writing layer is only as honest as its enforcement: it must rewrite
  retrieved evidence only (STRICT prompt) and falls back on failure; it is
  off by default.

---

_Last updated: 2026-08-16 · TrendLens honest rebuild (Phases 0–7)_
