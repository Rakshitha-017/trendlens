"""
rag_query_system.py
----------------------------------------------------------------------
Step 8 of the TrendLens pipeline: RAG Trend Query System.

Run AFTER generate_captions.py.

SCOPE: This system is restricted to social media visual trend analysis
only. It answers questions about photography styles, content aesthetics,
engagement patterns, visual trends, and creator strategy — all grounded
exclusively in the TrendLens FAISS cluster database (69,000+ images).
Off-topic queries (programming, math, general knowledge, etc.) are
rejected with a clear scope message.

ARCHITECTURE:
    User question
          |
    Intent / subject extraction        (detect_intent)
          |
    SentenceTransformer embedding      (TrendRAGIndex.search)
          |
    FAISS candidate retrieval          (broad recall, not final ranking)
          |
    Hybrid re-ranking                  (semantic + category + lifecycle
          |                             + engagement + viral + recency)
    Top relevant trend evidence
          |
    Gemini reasoning over ONLY that evidence  (build_gemini_prompt)
          |
    Grounded creator recommendation

    FAISS is the retrieval engine, not the answer engine. It returns
    candidates; a second-stage scorer re-ranks them; only then does an
    LLM reason over the (already-relevant) evidence. The LLM is never
    allowed to introduce facts the retrieved evidence doesn't support.

    1. DOCUMENT STORE  — cluster_captions.json (one doc per cluster)
    2. ENCODER         — sentence-transformers/all-MiniLM-L6-v2
    3. RETRIEVER       — FAISS IndexFlatIP (dense cosine similarity)
    4. RE-RANKER       — hybrid scorer (semantic/category/lifecycle/
                          engagement/viral/recency), see RANK_WEIGHTS
    5. LLM REASONING   — Google Gemini (model via GEMINI_MODEL env var)
    6. INTERFACE       — CLI (--query / --interactive / --validate)

Usage:
    python rag_query_system.py --build-index
    python rag_query_system.py --build-index --validate
    python rag_query_system.py --query "what food trends are rising?"
    python rag_query_system.py --query "..." --verbose
    python rag_query_system.py --interactive
    python rag_query_system.py --validate            (retrieval only, fast)
    python rag_query_system.py --validate --validate-llm   (+ Gemini checks)

Inputs  (trendlens_outputs/):
    - cluster_captions.json

Outputs (trendlens_outputs/):
    - rag_faiss.index      FAISS binary index
    - rag_vectors.npy      caption embedding matrix
    - rag_meta.pkl         cluster id -> caption metadata map

----------------------------------------------------------------------
SCHEMA ASSUMPTIONS (see cluster_captions.json)
----------------------------------------------------------------------
Each top-level key is a cluster id, mapping to a dict with (at least):
    dominant_category      : str                 e.g. "food"
    secondary_categories   : list[str]
    lifecycle_stage        : "Rising"|"Stable"|"Declining"
    peak_quarter           : date-like string, e.g. "2025-07-01"
    trend_window           : free-text range, e.g. "2025-01 to 2025-08"
    blip2_caption          : str  (raw vision-model description)
    caption / template_caption : str
    title                  : str
    keywords                : list[str]
    geographic_hotspots     : list[str]
    stats: {
        mean_engagement_rate   : number  (schema-ambiguous scale, see
                                          format_percentage() below)
        viral_rate              : number  (same ambiguity)
        total_posts              : int
        mean_trend_duration_days : float
        pred_engagement_rate    : number  (same ambiguity)
    }

The original code assumed `viral_rate` was a 0-1 fraction (":.0%") while
formatting `mean_engagement_rate` as an already-scaled percentage
(":.2f%%"). Since both fields are produced by the same upstream pipeline
there is no principled reason to assume they use different scales, and
doing so silently produced numbers like "1250%". format_percentage()
below auto-detects scale per value (0-1 => fraction, else already a
percentage) instead of hard-coding an assumption per field.

Ranking math (min-max normalization, category/lifecycle scoring) is
robust to either interpretation since it only cares about relative
magnitude within the retrieved candidate pool, not the absolute unit.
----------------------------------------------------------------------
"""

import argparse
import json
import os
import pickle
import re
import sys
import time
from collections import Counter
from pathlib import Path
from textwrap import fill

import faiss
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer

# ── Optional: load .env for GOOGLE_API_KEY ─────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

# ── Gemini is intentionally NOT used in run_query() ───────────────────
# The system is FAISS-only: cluster retrieval + structured evidence formatting.
# Gemini / LLM calls are fully removed from the query path.
# The constants below are kept for --validate-llm CLI diagnostics only.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_AVAILABLE = False  # Always False — LLM disabled by design
_GEMINI_CLIENT   = None

# -----------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------
# Anchor to this script's own directory (not the caller's cwd) so it behaves
# the same regardless of where it's invoked from.
BASE_DIR      = Path(__file__).parent
OUTPUT_DIR    = BASE_DIR / "trendlens_outputs"
CAPTIONS_PATH = OUTPUT_DIR / "cluster_captions.json"
FAISS_INDEX   = OUTPUT_DIR / "rag_faiss.index"
VECTORS_NPY   = OUTPUT_DIR / "rag_vectors.npy"
META_PKL      = OUTPUT_DIR / "rag_meta.pkl"

ENCODER_ID = "sentence-transformers/all-MiniLM-L6-v2"
TOP_K      = 7

# How many FAISS nearest neighbors to pull as a *candidate pool* before
# hybrid re-ranking narrows it down to top_k. Broad recall first, so a
# good cluster is never lost purely because a metadata field was noisy
# or an exact keyword didn't match (see issue #6).
CANDIDATE_POOL = int(os.environ.get("TRENDLENS_CANDIDATE_POOL", "40"))

# -----------------------------------------------------------------------
# Hybrid re-ranking weights (issue #1)
# -----------------------------------------------------------------------
# final_score = semantic*w_sem + category*w_cat + lifecycle*w_life
#             + engagement*w_eng + viral*w_vir + recency*w_rec
#
# All six component scores are normalized to roughly [0, 1] before
# weighting, so no single metric dominates purely due to numeric scale
# (e.g. engagement rates vs. cosine similarity vs. raw post counts).
# Every weight is overridable via env var for experimentation.
RANK_WEIGHTS = {
    "semantic":   float(os.environ.get("TRENDLENS_W_SEMANTIC",   "0.32")),
    "category":   float(os.environ.get("TRENDLENS_W_CATEGORY",   "0.22")),
    "lifecycle":  float(os.environ.get("TRENDLENS_W_LIFECYCLE",  "0.16")),
    "engagement": float(os.environ.get("TRENDLENS_W_ENGAGEMENT", "0.14")),
    "viral":      float(os.environ.get("TRENDLENS_W_VIRAL",      "0.10")),
    "recency":    float(os.environ.get("TRENDLENS_W_RECENCY",    "0.06")),
}

# When the query is asking about "now / currently / latest", shift extra
# weight onto recency and lifecycle (favor Rising + newest) relative to
# the defaults above. Applied as multipliers, then the whole weight dict
# is renormalized to sum to 1 (issue #11, #12).
CURRENT_QUERY_MULTIPLIERS = {"recency": 2.2, "lifecycle": 1.4}

# Below this final_score (on the ~[0,1] blended scale) or category-match
# level, the system flags low confidence instead of letting Gemini (or
# the fallback formatter) assert a confident recommendation (issue #19).
LOW_CONFIDENCE_SCORE  = 0.38
LOW_CONFIDENCE_CATSCORE = 0.5
# If the query names a subject/asks for visual strategy but matches NO
# known category taxonomy at all (e.g. "photograph a spaceship" against a
# food/fashion/travel/... dataset), category_score alone can't catch it
# since there's nothing to compare against — fall back to raw semantic
# similarity of the top hit as a sanity check (issue #19).
LOW_CONFIDENCE_SEMANTIC_NO_CATEGORY = 0.6

# -----------------------------------------------------------------------
# Query Intent Detection
# -----------------------------------------------------------------------
LIFECYCLE_KEYWORDS = {
    "rising":    ["rising", "growing", "emerging", "new", "upcoming", "hot",
                  "gaining", "popular now", "trending up", "viral now"],
    "stable":    ["stable", "consistent", "steady", "reliable", "established",
                  "ongoing", "sustained", "evergreen"],
    "declining": ["declining", "old", "outdated", "fading", "dying", "past",
                  "falling", "waning", "peaked", "former"],
}

CATEGORY_KEYWORDS = {
    "food":         ["food", "eating", "cuisine", "meal", "restaurant", "cooking",
                     "dish", "recipe", "dining", "cafe", "pasta", "bowl", "plate",
                     "dessert", "drink", "coffee", "baking", "brunch", "lunch",
                     "pizza", "cake", "burger", "sushi", "salad", "smoothie",
                     "arrabiata", "noodles", "bread", "chocolate"],
    "fashion":      ["fashion", "style", "outfit", "clothing", "apparel", "dress",
                     "ootd", "wear", "wardrobe", "accessories", "shoes", "look"],
    "portrait":     ["portrait", "face", "people", "person", "selfie", "model",
                     "headshot", "influencer"],
    "travel":       ["travel", "destination", "trip", "journey", "explore",
                     "tourism", "adventure", "vacation", "wanderlust"],
    "events":       ["event", "concert", "festival", "party", "ceremony", "wedding"],
    "animals":      ["animal", "pet", "dog", "cat", "wildlife", "bird"],
    "nightlife":    ["nightlife", "night", "club", "bar", "neon"],
    "family":       ["family", "kids", "children", "parents", "baby"],
    "sports":       ["sport", "athletic", "fitness", "gym", "workout", "running"],
    "nature":       ["nature", "landscape", "outdoor", "forest", "mountain",
                     "lake", "sky", "sunset", "scenery"],
    "architecture": ["architecture", "building", "urban", "city", "structure",
                     "bridge", "skyline"],
    "street":       ["street", "urban", "city life", "candid", "documentary"],
    "art":          ["art", "artistic", "creative", "gallery", "painting",
                     "illustration", "artwork"],
    "abstract":     ["abstract", "pattern", "texture", "geometric", "minimal"],
    "technology":   ["technology", "tech", "digital", "device", "gadget",
                     "computer", "innovation"],
}

# Words that identify *who* is asking (a content creator / brand persona),
# kept separate from visual/photography request language (issue #5).
CREATOR_ROLE_KEYWORDS = [
    "influencer", "creator", "blogger", "brand", "content creator",
    "content", "audience", "followers", "instagram", "social media",
    "my page", "my account", "my feed",
]

# Words that identify the user wants concrete visual/photography guidance
# (composition, lighting, palette, props, etc.) rather than a general
# trend report (issue #4).
VISUAL_STRATEGY_KEYWORDS = [
    "photograph", "photography", "photo", "picture", "click the picture",
    "shoot", "shooting", "composition", "frame", "framing", "camera angle",
    "angle", "lighting", "light", "background", "props", "colour", "color",
    "palette", "aesthetic", "visual", "styling", "food styling", "shot",
    "image", "flat lay", "how should i", "what style", "what should i use",
]

ENGAGEMENT_KEYWORDS = ["viral", "popular", "engaging", "top", "best",
                       "highest", "most liked", "most shared", "perform",
                       "performing", "trend", "go viral", "blow up"]

# "Trending right now" language (issue #2). Multi-word phrases work fine
# with substring `in` checks against the lowercased query.
CURRENT_KEYWORDS = [
    "now", "currently", "current", "right now", "at the moment", "today",
    "latest", "recent", "recently", "these days", "this week", "this month",
]

# Full 4-digit year, 2000-2099 (issue #3 — previously only matched 20[01]\d,
# i.e. 2000-2019, silently excluding every 2020s+ year in the dataset).
YEAR_PATTERN = re.compile(r"\b(20\d{2})\b")


def _kw_present(text_lower: str, kw: str) -> bool:
    """Word-boundary keyword match. Plain substring checks (`kw in text`)
    false-positive constantly on real queries — e.g. the lifecycle keyword
    "past" is a substring of "pasta", "now" is a substring of "know", "art"
    is a substring of "start", "pet" is a substring of "carpet". Multi-word
    phrases (e.g. "right now") still work fine since spaces are non-word
    characters and satisfy the boundary on both sides."""
    return re.search(r"(?<!\w)" + re.escape(kw) + r"(?!\w)", text_lower) is not None


def _any_kw(text_lower: str, kws) -> bool:
    return any(_kw_present(text_lower, kw) for kw in kws)

# Heuristic patterns to pull a concrete subject ("arrabiata pasta", "a cup
# of coffee", ...) out of free-form phrasing, generically — not hard-coded
# to any one dish (issue #4). Tried in order; first match wins.
_SUBJECT_STOP = {"a", "an", "the", "picture", "photo", "photograph", "image",
                  "shot", "it", "this", "that", "my"}
SUBJECT_PATTERNS = [
    re.compile(
        r"(?:picture|photo|photograph|image|shot)s?\s+of\s+(?:an?\s+|some\s+|my\s+)?"
        r"([a-zA-Z][a-zA-Z\-\s]{1,40}?)"
        r"(?=[\.\,\?\!]|\s+(?:how|what|to|for|so|and|which|that|in order)\b|$)",
        re.IGNORECASE),
    # Covers inflected verb forms too: photograph/photographing/photographed,
    # shoot/shooting, style/styling, post/posting, showcase/showcasing.
    re.compile(
        r"(?:photograph(?:ing|ed)?|shoot(?:ing)?|styl(?:e|ing)|post(?:ing)?|showcas(?:e|ing))\s+"
        r"(?:an?\s+|some\s+|my\s+)?"
        r"([a-zA-Z][a-zA-Z\-\s]{1,40}?)"
        r"(?=[\.\,\?\!]|\s+(?:how|what|to|for|so|and|which|that|in order)\b|$)",
        re.IGNORECASE),
]


def extract_subject(query: str) -> str | None:
    """Best-effort extraction of the concrete subject of the query, e.g.
    'arrabiata pasta' from '...post a picture of arrabiata pasta...'.
    Generic regex-based, not a hard-coded dish list."""
    for pat in SUBJECT_PATTERNS:
        m = pat.search(query)
        if not m:
            continue
        subj = re.sub(r"\s+", " ", m.group(1).strip(" .,!?"))
        words = [w for w in subj.lower().split() if w not in _SUBJECT_STOP]
        if words and len(subj.split()) <= 6:
            return " ".join(subj.split())
    return None


def detect_intent(query: str) -> dict:
    q_lower = query.lower()
    intent = {
        "lifecycle_requested": None,   # explicit "rising/declining/..." ask
        "categories":          [],
        "years":                [],
        "rank_by_engagement":  False,
        "current_query":        False,
        "creator_query":        False,
        "visual_strategy_query": False,
        "requested_subject":    None,
        "top_k":                TOP_K,
    }
    for stage, kws in LIFECYCLE_KEYWORDS.items():
        if _any_kw(q_lower, kws):
            intent["lifecycle_requested"] = stage.capitalize()
            break
    for cat, kws in CATEGORY_KEYWORDS.items():
        if _any_kw(q_lower, kws):
            intent["categories"].append(cat)
    intent["years"] = [int(y) for y in YEAR_PATTERN.findall(q_lower)]
    if _any_kw(q_lower, ENGAGEMENT_KEYWORDS):
        intent["rank_by_engagement"] = True
    if _any_kw(q_lower, CURRENT_KEYWORDS):
        intent["current_query"] = True
    if _any_kw(q_lower, CREATOR_ROLE_KEYWORDS):
        intent["creator_query"] = True
    if _any_kw(q_lower, VISUAL_STRATEGY_KEYWORDS):
        intent["visual_strategy_query"] = True
    intent["requested_subject"] = extract_subject(query)
    # A creator asking a visual-strategy question about a specific subject
    # implicitly wants content that performs well, even without an
    # explicit "viral"/"trend" keyword.
    if intent["creator_query"] and intent["visual_strategy_query"]:
        intent["rank_by_engagement"] = True
    return intent


def format_percentage(value) -> str:
    """Format a rate value that may be stored either as a 0-1 fraction or
    as an already-scaled percentage number, without assuming which per
    field (issue #9). 0 <= v <= 1 is treated as a fraction; anything else
    is treated as already being a percentage."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return "N/A"
    if 0.0 <= v <= 1.0:
        return f"{v * 100:.1f}%"
    return f"{v:.1f}%"


def extract_cluster_years(cap: dict) -> list:
    """Pull every plausible year out of peak_quarter / trend_window,
    regardless of exact date format, without fabricating anything
    (issue #3, #11)."""
    years = set()
    for field in ("peak_quarter", "trend_window"):
        val = cap.get(field)
        if val:
            years.update(int(y) for y in YEAR_PATTERN.findall(str(val)))
    return sorted(years)


def cluster_latest_year(cap: dict):
    years = extract_cluster_years(cap)
    return max(years) if years else None


# Vocabulary of concrete, checkable visual/style descriptors. Used only to
# *detect* terms that literally appear in retrieved captions/keywords —
# never to invent them (issue #7, #8). Extend freely; this list is not
# exhaustive, just a recognizer for common photography/style language.
VISUAL_VOCAB = [
    "overhead", "top-down", "top down", "45-degree", "45 degree", "close-up",
    "close up", "macro", "wide shot", "flat lay", "natural light",
    "natural lighting", "soft light", "hard light", "backlit", "back-lit",
    "side-lit", "side lit", "golden hour", "warm tones", "warm light",
    "cool tones", "muted", "vivid", "saturated", "oversaturated", "pastel",
    "rustic", "minimal", "minimalist", "wooden table", "marble", "ceramic",
    "linen", "matte", "glossy", "greenery", "terracotta", "monochrome",
    "black and white", "high contrast", "low contrast", "symmetry",
    "rule of thirds", "negative space", "shallow depth of field",
    "moody", "bright and airy", "dark and moody", "steam", "drone",
    "aerial", "candid", "documentary", "vintage filter", "harsh flash",
    "flash lighting", "turquoise", "coastline",
]


def extract_recurring_visual_terms(results: list, min_count: int = 2, top_n: int = 10) -> list:
    """Scan the retrieved clusters' actual text fields for known visual
    descriptors and return the ones that recur across multiple clusters
    (evidence, not invention). Falls back to whatever appeared at least
    once if nothing recurs."""
    counts = Counter()
    for r in results:
        cap = r["cap"]
        text = " ".join([
            str(cap.get("blip2_caption", "")),
            str(cap.get("caption", "")),
            str(cap.get("template_caption", "")),
            " ".join(cap.get("keywords", [])),
        ]).lower()
        seen_this_cluster = set()
        for term in VISUAL_VOCAB:
            if term in text and term not in seen_this_cluster:
                counts[term] += 1
                seen_this_cluster.add(term)

    recurring = [(t, c) for t, c in counts.most_common() if c >= min_count]
    if not recurring:
        recurring = counts.most_common(top_n)
    return recurring[:top_n]


def _normalize(values: list) -> list:
    """Min-max normalize a list of raw numbers to [0, 1]. Constant or
    empty input maps everything to a neutral 0.5 (issue #10 — replaces
    the old arbitrary '/5.0' engagement fudge factor)."""
    if not values:
        return []
    lo, hi = min(values), max(values)
    if hi - lo < 1e-9:
        return [0.5 for _ in values]
    return [(v - lo) / (hi - lo) for v in values]


# -----------------------------------------------------------------------
# Index Builder
# -----------------------------------------------------------------------
class TrendRAGIndex:
    """FAISS-backed dense retrieval index over cluster captions, with a
    second-stage hybrid re-ranker on top (see module docstring)."""

    def __init__(self):
        self.encoder            = None
        self.faiss_index        = None
        self.cluster_ids        = []
        self.metadata           = {}
        self.vectors            = None
        self.dataset_latest_year = None

    def _make_document(self, cap: dict) -> str:
        s = cap.get("stats", {})
        # Build a rich descriptive sentence from stats so the encoder captures
        # engagement signal directly in the embedding space.
        stats_desc = (
            f"engagement {format_percentage(s.get('mean_engagement_rate', 0))} "
            f"viral_rate {format_percentage(s.get('viral_rate', 0))} "
            f"posts {s.get('total_posts', 0)} "
            f"duration {s.get('mean_trend_duration_days', 0):.1f}days "
            f"pred_engagement {format_percentage(s.get('pred_engagement_rate', 0))}"
        )
        parts = [
            cap.get("blip2_caption", ""),
            cap.get("caption", ""),
            cap.get("template_caption", ""),
            cap.get("title", ""),
            " ".join(cap.get("keywords", [])),
            cap.get("dominant_category", ""),
            cap.get("lifecycle_stage", ""),
            " ".join(cap.get("secondary_categories", [])),
            " ".join(cap.get("geographic_hotspots", [])),
            cap.get("peak_quarter", ""),
            cap.get("trend_window", ""),
            stats_desc,
        ]
        return " ".join(p for p in parts if p)

    def _compute_dataset_latest_year(self):
        years = [y for cid in self.cluster_ids
                 for y in [cluster_latest_year(self.metadata[cid])] if y]
        self.dataset_latest_year = max(years) if years else None

    def build(self, captions: dict):
        print(f"[RAG] Loading encoder: {ENCODER_ID} …")
        self.encoder = SentenceTransformer(ENCODER_ID)

        self.cluster_ids = sorted(captions.keys())
        self.metadata = captions

        docs = [self._make_document(captions[cid]) for cid in self.cluster_ids]

        print(f"[RAG] Encoding {len(docs)} cluster documents …")
        vectors = self.encoder.encode(
            docs,
            normalize_embeddings=True,
            show_progress_bar=True,
            batch_size=16,
        ).astype(np.float32)
        self.vectors = vectors

        dim = vectors.shape[1]
        self.faiss_index = faiss.IndexFlatIP(dim)   # inner product == cosine (normalized)
        self.faiss_index.add(vectors)
        print(f"[RAG] FAISS index built: {self.faiss_index.ntotal} vectors, dim={dim}")

        self._compute_dataset_latest_year()
        if self.dataset_latest_year:
            print(f"[RAG] Latest trend period represented in dataset: {self.dataset_latest_year}")
        else:
            print("[RAG] \u26a0 No parseable year found in peak_quarter/trend_window fields "
                  "— recency-aware ranking will fall back to neutral scoring.")

    # ------------------------------------------------------------------
    # Retrieval + hybrid re-ranking (issues #1, #6, #10, #11, #12)
    # ------------------------------------------------------------------
    def _effective_weights(self, intent: dict) -> dict:
        weights = dict(RANK_WEIGHTS)
        if intent.get("current_query"):
            for k, mult in CURRENT_QUERY_MULTIPLIERS.items():
                weights[k] *= mult
        total = sum(weights.values()) or 1.0
        return {k: v / total for k, v in weights.items()}

    def _lifecycle_target_scores(self, intent: dict) -> dict:
        """Map lifecycle_stage -> soft preference score in [0,1] given the
        query's intent. Never a hard filter (issue #6, #12)."""
        if intent.get("lifecycle_requested"):
            target = intent["lifecycle_requested"]
            return {target: 1.0, **{s: 0.15 for s in ("Rising", "Stable", "Declining") if s != target}}
        if intent.get("current_query") or intent.get("rank_by_engagement") or intent.get("visual_strategy_query"):
            # Wants content that performs / is trending -> prefer Rising.
            return {"Rising": 1.0, "Stable": 0.55, "Declining": 0.15}
        return {"Rising": 0.5, "Stable": 0.5, "Declining": 0.5}

    def _category_score(self, cap: dict, categories: list) -> float:
        if not categories:
            return 0.5
        dom = cap.get("dominant_category")
        sec = cap.get("secondary_categories", []) or []
        if dom in categories:
            return 1.0
        if any(c in categories for c in sec):
            return 0.55
        return 0.05  # soft penalty, not elimination — see issue #6

    def search(self, query: str, intent: dict, k: int = TOP_K,
               pool_size: int = CANDIDATE_POOL):
        """Returns (results, meta). results is a list of dicts:
        {cid, cap, final_score, semantic, category, lifecycle, engagement,
         viral, recency, year}. meta carries {low_confidence, pool_size}."""
        q_vec = self.encoder.encode([query], normalize_embeddings=True).astype(np.float32)

        pool_size = min(pool_size, self.faiss_index.ntotal)
        scores, indices = self.faiss_index.search(q_vec, pool_size)
        scores, indices = scores[0], indices[0]

        candidates = []
        for i, sc in zip(indices, scores):
            if i < 0 or i >= len(self.cluster_ids):
                continue
            cid = self.cluster_ids[i]
            cap = self.metadata[cid]
            candidates.append({
                "cid": cid,
                "cap": cap,
                "semantic_raw": float(sc),
            })
        if not candidates:
            return [], {"low_confidence": True, "pool_size": 0}

        categories = intent.get("categories", [])
        lifecycle_scores = self._lifecycle_target_scores(intent)

        eng_raw = [float(c["cap"].get("stats", {}).get("mean_engagement_rate", 0) or 0) for c in candidates]
        viral_raw = [float(c["cap"].get("stats", {}).get("viral_rate", 0) or 0) for c in candidates]
        eng_norm = _normalize(eng_raw)
        viral_norm = _normalize(viral_raw)

        years = [cluster_latest_year(c["cap"]) for c in candidates]
        known_years = [y for y in years if y is not None]
        year_norm_map = {}
        if known_years:
            lo, hi = min(known_years), max(known_years)
            for y in known_years:
                year_norm_map[y] = 0.5 if hi == lo else (y - lo) / (hi - lo)

        # semantic similarity from a normalized IndexFlatIP is cosine
        # similarity in [-1, 1]; clip/rescale to [0, 1] so it's on the
        # same footing as the other components.
        sem_clipped = [max(0.0, min(1.0, (c["semantic_raw"] + 1.0) / 2.0)) for c in candidates]

        weights = self._effective_weights(intent)

        for c, sem, en, vi, y in zip(candidates, sem_clipped, eng_norm, viral_norm, years):
            cat_score = self._category_score(c["cap"], categories)
            life_score = lifecycle_scores.get(c["cap"].get("lifecycle_stage"), 0.4)
            rec_score = year_norm_map.get(y, 0.4) if known_years else 0.5

            c["semantic"]   = sem
            c["category"]   = cat_score
            c["lifecycle"]  = life_score
            c["engagement"] = en
            c["viral"]      = vi
            c["recency"]    = rec_score
            c["year"]       = y
            c["final_score"] = (
                sem * weights["semantic"]
                + cat_score * weights["category"]
                + life_score * weights["lifecycle"]
                + en * weights["engagement"]
                + vi * weights["viral"]
                + rec_score * weights["recency"]
            )

        candidates.sort(key=lambda c: c["final_score"], reverse=True)
        top = candidates[:k]

        low_confidence = False
        if top:
            if categories and max(c["category"] for c in top) < LOW_CONFIDENCE_CATSCORE:
                low_confidence = True
            if top[0]["final_score"] < LOW_CONFIDENCE_SCORE:
                low_confidence = True
            # No recognized category at all (subject outside the taxonomy)
            # AND weak raw semantic match -> nothing in the DB is actually
            # about this subject, regardless of how high other components
            # (lifecycle/engagement) inflate the blended score.
            if not categories and top[0]["semantic"] < LOW_CONFIDENCE_SEMANTIC_NO_CATEGORY:
                low_confidence = True
        else:
            low_confidence = True

        return top, {"low_confidence": low_confidence, "pool_size": len(candidates),
                     "weights": weights}


# -----------------------------------------------------------------------
# Gemini LLM Reasoning
# -----------------------------------------------------------------------
def _evidence_block(results: list) -> str:
    context_blocks = []
    for rank, r in enumerate(results, 1):
        cap = r["cap"]
        s = cap.get("stats", {})
        secondary = ", ".join(cap.get("secondary_categories", [])) or "none"
        geo = ", ".join(cap.get("geographic_hotspots", [])) or "unspecified"
        keywords = " ".join(cap.get("keywords", [])[:8])
        block = (
            f"[Cluster {r['cid']} — Rank {rank} | final_score={r['final_score']:.3f} "
            f"(semantic={r['semantic']:.2f} category={r['category']:.2f} "
            f"lifecycle={r['lifecycle']:.2f} engagement={r['engagement']:.2f} "
            f"viral={r['viral']:.2f} recency={r['recency']:.2f})]\n"
            f"  Primary category  : {cap.get('dominant_category', 'N/A')}\n"
            f"  Secondary themes  : {secondary}\n"
            f"  Lifecycle stage   : {cap.get('lifecycle_stage', 'N/A')}\n"
            f"  Peak quarter      : {cap.get('peak_quarter', 'N/A')}\n"
            f"  Trend window      : {cap.get('trend_window', 'N/A')}\n"
            f"  Mean engagement   : {format_percentage(s.get('mean_engagement_rate', 0))}\n"
            f"  Viral rate        : {format_percentage(s.get('viral_rate', 0))} of posts go viral\n"
            f"  Post count        : {s.get('total_posts', 0):,}\n"
            f"  Pred. engagement  : {format_percentage(s.get('pred_engagement_rate', 0))}\n"
            f"  Avg trend life    : {s.get('mean_trend_duration_days', 0):.1f} days\n"
            f"  Hot cities        : {geo}\n"
            f"  Top tags          : {keywords}\n"
            f"  BLIP visual desc  : {cap.get('blip2_caption', '')}\n"
            f"  Full context      : {cap.get('template_caption', '')[:400]}\n"
        )
        context_blocks.append(block)
    return "\n\n".join(context_blocks)


def build_gemini_prompt(query: str, results: list, intent: dict,
                        dataset_latest_year, low_confidence: bool) -> str:
    context_str = _evidence_block(results)
    recurring = extract_recurring_visual_terms(results)
    recurring_str = ", ".join(f"{t} (in {c}/{len(results)} clusters)" for t, c in recurring) or "none detected"

    latest_year_str = (str(dataset_latest_year) if dataset_latest_year
                        else "unknown — no parseable dates in the retrieved metadata")

    # Real-time simulation framing — present data as current trend intelligence
    real_time_note = (
        "TrendLens analyses engagement patterns from 69,000+ social media images. "
        "Present your analysis as current trend intelligence — describe what is "
        "performing well NOW based on the clusters below. Do not add disclaimers "
        "about data age; focus on actionable, creator-facing insights."
    )

    confidence_note = (
        "IMPORTANT: retrieval confidence for this query is LOW (weak category "
        "match or weak overall relevance). Do not present a confident, specific "
        "recommendation. Explicitly say the database does not contain strong "
        "evidence for this exact request, then describe the closest relevant "
        "trends found instead."
        if low_confidence else
        "Retrieval confidence is adequate — you may give a specific, concrete "
        "recommendation, but it must still be grounded only in the evidence below."
    )

    subject_line = (f'Detected subject: "{intent.get("requested_subject")}"\n'
                     if intent.get("requested_subject") else "")

    if intent.get("visual_strategy_query") or intent.get("creator_query"):
        return f"""You are TrendLens, a visual trend strategist for social media content creators.

You retrieved the most relevant visual-trend clusters from the TrendLens FAISS
database (real social media images + engagement data), already re-ranked by a
hybrid scorer that blends semantic relevance, category match, lifecycle stage,
engagement, virality, and recency.

USER QUERY: "{query}"
{subject_line}
{confidence_note}

{real_time_note}

RECURRING VISUAL PATTERNS DETECTED ACROSS THE RETRIEVED CLUSTERS
(counted directly from their captions/keywords — treat this as your strongest
evidence for what to recommend):
{recurring_str}

RETRIEVED TREND CLUSTERS (already ranked, most relevant first):
{context_str}

STRICT GROUNDING RULES:
- Only describe visual characteristics (composition, angle, lighting, color,
  background, props, textures) that are actually supported by the clusters
  above — either the recurring patterns list or the BLIP/caption/keyword text
  of specific clusters you cite.
- NEVER invent camera bodies, lens models, f-stops, ISO, shutter speed, or
  specific app/filter names unless those exact details appear in the evidence.
  If asked about such settings and there's no evidence, say plainly that the
  database doesn't cover camera/lens specifics.
- Every claim should be traceable to either (a) a named cluster and its
  metrics, or (b) the recurring-patterns evidence above. If you can't trace
  it, don't say it.
- Explicitly separate: what the data shows (facts from clusters) vs. what you
  are inferring/recommending (derived) vs. what the data cannot tell us
  (unsupported/unknown).

Structure your answer with EXACTLY these headers:

## What the data suggests
## The visual direction
## Composition
## Camera angle
## Lighting
## Colour palette
## Background
## Props & textures
## Styling the food
## What to avoid
## Why this is likely to perform
## 3-step shot plan

In "Why this is likely to perform" and elsewhere, cite actual numbers from
the evidence (e.g. "Cluster {results[0]['cid'] if results else 'N'} shows
{format_percentage(results[0]['cap'].get('stats', {}).get('mean_engagement_rate', 0)) if results else 'N/A'}
mean engagement and {format_percentage(results[0]['cap'].get('stats', {}).get('viral_rate', 0)) if results else 'N/A'}
viral rate, lifecycle stage {results[0]['cap'].get('lifecycle_stage', 'N/A') if results else 'N/A'}").
If "Styling the food" doesn't apply to the query's subject (non-food), still
use that header but reframe it for the actual subject (styling/props for
that subject) rather than omitting it.
"""

    # Non-creator / general trend query.
    return f"""You are TrendLens, a visual social-media trend intelligence engine.

USER QUERY: "{query}"

{confidence_note}

{real_time_note}

RETRIEVED TREND CLUSTERS (already ranked, most relevant first):
{context_str}

Answer using ONLY the evidence above. Be specific and actionable:
- Which clusters are currently performing best for this query and why
- What visual patterns appear across the top clusters (BLIP descriptions, tags)
- Exact engagement % and viral rates from the data
- Where this content is thriving geographically
- One concrete, specific recommendation the user can act on today

Do NOT add vague generic advice. Cite cluster IDs and numbers.
"""


_GEMINI_COOLDOWN_S   = 90.0
_gemini_tripped_at   = None


def _is_rate_limit_error(err_str: str) -> bool:
    return any(s in err_str for s in ("429", "RESOURCE_EXHAUSTED", "rate limit", "quota"))


def _is_daily_quota_exhausted(err_str: str) -> bool:
    return "per day" in err_str.lower() or "daily" in err_str.lower()


def _parse_retry_delay(err_str: str) -> float:
    m = re.search(r"retry.*?(\d+(?:\.\d+)?)\s*s", err_str, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass
    return 5.0


def _breaker_active() -> bool:
    global _gemini_tripped_at
    if _gemini_tripped_at is None:
        return False
    if time.time() - _gemini_tripped_at > _GEMINI_COOLDOWN_S:
        _gemini_tripped_at = None
        return False
    return True


def call_gemini(prompt: str, max_retries: int = 4) -> str:
    global _gemini_tripped_at

    if not GEMINI_AVAILABLE:
        return "[Gemini unavailable — set GOOGLE_API_KEY in .env to enable LLM reasoning]"

    if _breaker_active():
        return ("[Gemini skipped — rate-limited earlier this run; "
                f"will retry again after a {_GEMINI_COOLDOWN_S:.0f}s cooldown]")

    for attempt in range(max_retries):
        try:
            response = _GEMINI_CLIENT.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            return response.text.strip()
        except Exception as exc:
            err_str = str(exc)
            if _is_rate_limit_error(err_str):
                if _is_daily_quota_exhausted(err_str):
                    _gemini_tripped_at = time.time()
                    return ("[Gemini unavailable — daily free-tier quota exhausted. "
                            "Resets at midnight Pacific or upgrade at "
                            "https://aistudio.google.com/apikey]")
                suggested = _parse_retry_delay(err_str)
                wait = min(max(suggested, float(2 ** attempt + 1)), 20.0)
                if attempt < max_retries - 1:
                    print(f"  [Gemini] Rate-limited — retrying in {wait:.0f}s "
                          f"(attempt {attempt+1}/{max_retries}) …")
                    time.sleep(wait)
                    continue
                _gemini_tripped_at = time.time()
            return f"[Gemini error: {exc}]"


def _gemini_call_failed(answer: str) -> bool:
    return answer is None or answer.startswith("[Gemini")


# -----------------------------------------------------------------------
# Fallback (Gemini-free) recommendation synthesis (issue #16)
# -----------------------------------------------------------------------
def fallback_recommendation(query: str, results: list, intent: dict,
                            dataset_latest_year, low_confidence: bool) -> str:
    """Intent-aware, evidence-grounded recommendation from retrieved cluster metadata.
    Detects whether the query is a fashion/style question, photography/creator question,
    or a general trend question, and frames the answer accordingly.
    BLIP captions are NEVER used as prescriptive advice — only template_caption/context."""
    if not results:
        return "No retrieved evidence available to build a recommendation from."

    q = query.lower()
    # Detect query intent
    is_fashion_style = bool(re.search(
        r'\b(wear|wearing|outfit|dress|attire|look|ootd|clothing|apparel|'
        r'what to wear|what should i wear|get dressed|going to a party|attend)\b', q))
    is_photo_query = bool(re.search(
        r'\b(photograph|photo|picture|shoot|shot|camera|composition|lighting|frame|angle|lens)\b', q))
    is_creator_query = bool(re.search(
        r'\b(post|upload|creator|influencer|blogger|instagram|social media|feed|reel|content|'
        r'max engagement|go viral|viral|trending)\b', q))

    recurring = extract_recurring_visual_terms(results)
    top = results[0]
    s = top["cap"].get("stats", {})
    latest_year_str = str(dataset_latest_year) if dataset_latest_year else "unknown"
    rising = next((r for r in results if r["cap"].get("lifecycle_stage") == "Rising"), results[0])
    declining = [r for r in results if r["cap"].get("lifecycle_stage") == "Declining"]

    lines = []

    if low_confidence:
        lines.append("⚠ LOW CONFIDENCE: retrieval evidence for this request is weak. "
                     "The closest relevant clusters are summarised below.\n")

    # ── Scope note for fashion/style queries ──────────────────────────────
    if is_fashion_style and not is_photo_query:
        lines.append("> TrendLens is a social media visual trend system. It surfaces "
                     "what visual aesthetics are currently *performing on social media*, "
                     "not personal styling advice. Use this data to align your look "
                     "with what audiences are responding to right now.")
        lines.append("")

    # ── Summary ────────────────────────────────────────────────
    lines.append("## Trend summary")
    cats = sorted({r["cap"].get("dominant_category", "unknown") for r in results})
    rising_count = sum(1 for r in results if r["cap"].get("lifecycle_stage") == "Rising")
    decl_count   = sum(1 for r in results if r["cap"].get("lifecycle_stage") == "Declining")
    lines.append(f"Retrieved {len(results)} clusters. Top categories: {', '.join(cats)}. "
                 f"Lifecycle: {rising_count} Rising / {decl_count} Declining. "
                 f"Latest data period: {latest_year_str}.")
    lines.append("")

    if is_fashion_style and not is_photo_query:
        # ── Fashion/style mode ───────────────────────────────────────
        rc = rising["cap"]
        rs = rc.get("stats", {})
        lines.append(f"## What's trending — Cluster #{rising['cid']} ({rc.get('lifecycle_stage','N/A')})")
        lines.append(f"Category: {rc.get('dominant_category','N/A')} "
                     f"| Cross-themes: {', '.join(rc.get('secondary_categories', [])[:3])}")
        lines.append("")

        # Use template_caption (not BLIP) as aesthetic description
        style_desc = rc.get("template_caption") or rc.get("caption", "")
        if style_desc:
            cleaned = re.sub(r'\d{4}-\d{2}-\d{2}', '', style_desc).strip()[:400]
            lines.append(f"Current visual aesthetic: {cleaned}")
            lines.append("")

        geo = rc.get("geographic_hotspots", [])
        if geo:
            lines.append(f"Where this look is most popular: {', '.join(geo)}")
            lines.append("")

        eng = format_percentage(rs.get('mean_engagement_rate', 0))
        viral = format_percentage(rs.get('viral_rate', 0))
        posts = rs.get('total_posts', 0)
        lines.append(f"Performance: {eng} avg engagement · {viral} viral rate · {posts:,} posts · lifecycle: {rc.get('lifecycle_stage','N/A')}")
        lines.append("")

        kws = rc.get("keywords", [])[:8]
        if kws:
            lines.append(f"Style signals / tags: {' '.join(kws)}")
            lines.append("")

        if declining:
            d = declining[0]
            dc = d["cap"]
            lines.append("## What's losing traction (avoid)")
            deng = format_percentage(dc.get('stats', {}).get('mean_engagement_rate', 0))
            ddesc = dc.get("template_caption") or dc.get("caption", "")
            ddesc_clean = re.sub(r'\d{4}-\d{2}-\d{2}', '', ddesc).strip()[:200] if ddesc else ""
            lines.append(f"Cluster #{d['cid']} ({dc.get('dominant_category','N/A')}) is Declining — "
                         f"{deng} engagement. {ddesc_clean}")
            lines.append("")

    elif is_photo_query or is_creator_query:
        # ── Photography/creator mode ─────────────────────────────────
        tc = top["cap"]
        lines.append(f"## Visual direction")
        if recurring:
            terms = ", ".join(t for t, _ in recurring[:6])
            lines.append(f"Recurring visual elements across top clusters: {terms}.")
        else:
            ctx = tc.get("template_caption") or tc.get("caption", "")
            if ctx:
                lines.append(f"Top cluster context: {re.sub(r'\d{{4}}-\d{{2}}-\d{{2}}', '', ctx).strip()[:350]}")
        lines.append("")

        lines.append(f"## Performance — Cluster #{top['cid']}")
        lines.append(f"Lifecycle: {tc.get('lifecycle_stage','N/A')} · "
                     f"Engagement: {format_percentage(s.get('mean_engagement_rate', 0))} · "
                     f"Viral: {format_percentage(s.get('viral_rate', 0))} · "
                     f"Posts: {s.get('total_posts', 0):,}")
        geo = tc.get("geographic_hotspots", [])
        if geo:
            lines.append(f"Hot locations: {', '.join(geo)}")
        lines.append("")

        lines.append("## 3-step action plan")
        ctx = tc.get("template_caption") or tc.get("caption", "")
        ctx_clean = re.sub(r'\d{4}-\d{2}-\d{2}', '', ctx).strip()[:150] if ctx else ""
        lines.append(f"1. Aesthetic — Align with the {tc.get('dominant_category','N/A')} cluster aesthetic "
                     f"({tc.get('lifecycle_stage','N/A')}). {ctx_clean}")
        lines.append(f"2. Timing — {format_percentage(s.get('mean_engagement_rate',0))} avg engagement. "
                     "Post during peak hours (5–9 PM) for best reach.")
        kws = tc.get("keywords", [])[:4]
        geo3 = geo[:3] if geo else []
        lines.append(f"3. Tags & geo — Use: {' '.join(kws)}. "
                     f"{f'Best performance in: {chr(44).join(geo3)}.' if geo3 else ''}")
        lines.append("")

        if declining:
            d = declining[0]
            lines.append("## What to avoid")
            lines.append(f"Cluster #{d['cid']} ({d['cap'].get('dominant_category','N/A')}) is Declining "
                         f"({format_percentage(d['cap'].get('stats',{}).get('mean_engagement_rate',0))} engagement) "
                         "— avoid replicating this visual direction.")
            lines.append("")

    else:
        # ── General trend query mode ────────────────────────────────
        tc = top["cap"]
        lines.append(f"## Leading cluster — #{top['cid']}")
        lines.append(f"Category: {tc.get('dominant_category','N/A')} · "
                     f"Lifecycle: {tc.get('lifecycle_stage','N/A')} · "
                     f"Trend window: {tc.get('trend_window','N/A')}")
        lines.append("")
        desc = tc.get("template_caption") or tc.get("caption", "")
        if desc:
            lines.append(f"Trend context: {re.sub(r'\d{{4}}-\d{{2}}-\d{{2}}', '[period]', desc).strip()[:400]}")
            lines.append("")
        lines.append(f"Engagement: {format_percentage(s.get('mean_engagement_rate',0))} avg · "
                     f"{format_percentage(s.get('viral_rate',0))} viral · {s.get('total_posts',0):,} posts")
        geo = tc.get("geographic_hotspots", [])
        if geo:
            lines.append(f"Hotspots: {', '.join(geo)}")
        lines.append("")
        if declining:
            d = declining[0]
            lines.append("## Declining trends (avoid)")
            lines.append(f"Cluster #{d['cid']} ({d['cap'].get('dominant_category','N/A')}) — "
                         f"Declining, {format_percentage(d['cap'].get('stats',{}).get('mean_engagement_rate',0))} engagement.")
            lines.append("")

    return "\n".join(lines)


# -----------------------------------------------------------------------
# Topic Restriction Guard
# -----------------------------------------------------------------------
# Keywords that indicate a valid social-media / visual-trend query.
_SCOPE_KEYWORDS = [
    "trend", "trending", "visual", "aesthetic", "photography", "photo", "picture",
    "shoot", "style", "content", "creator", "influencer", "blogger", "instagram",
    "social media", "engagement", "viral", "post", "feed", "reel", "lighting",
    "composition", "colour", "color", "palette", "background", "props",
    "food", "fashion", "travel", "nature", "portrait", "nightlife", "street",
    "architecture", "animals", "sports", "events", "art", "abstract", "rising",
    "declining", "stable", "lifecycle", "cluster", "caption", "blip", "clip",
    "outfit", "ootd", "flat lay", "overhead", "angle", "filter", "vibe",
    "warm", "moody", "minimal", "rustic", "golden hour", "bokeh", "frame",
    "wear", "wearing", "dress", "attire", "look", "party", "concert",
    "festival", "wedding", "attend", "what to wear", "going to",
    "clothing", "apparel",
]

# Keywords that are strong signals the query is off-topic (programming, math, etc.).
_OFFTOPIC_KEYWORDS = [
    "code", "program", "algorithm", "function", "syntax", "debug", "compile",
    "python", "javascript", "java", "sql", "html", "css", "api", "library",
    "sort", "loop", "array", "string", "integer", "float", "boolean",
    "equation", "calculus", "derivative", "integral", "matrix", "theorem",
    "history", "geography", "president", "capital", "country", "war",
    "recipe", "ingredient", "cook", "boil",  # cooking instructions, not photography
    "medicine", "drug", "symptom", "diagnose",
    "stock", "crypto", "invest", "finance", "tax",
    "write a", "write me", "generate", "create a function", "explain how to code",
    "what is the meaning", "translate", "define the word",
]


def _is_in_scope(query: str) -> tuple[bool, str | None]:
    """Returns (is_in_scope, rejection_message_or_None).
    A query is in-scope if it contains at least one scope keyword and does
    not look like a programming/math/general-knowledge question."""
    q = query.lower()

    # Hard off-topic signals — reject immediately
    for kw in _OFFTOPIC_KEYWORDS:
        if kw in q:
            return False, (
                f"❌ Out of scope: TrendLens is a **social media visual trend intelligence system** "
                f"built on 69,000+ real image clusters.\n\n"
                f"It can only answer questions about:\n"
                f"  • Visual aesthetics, photography styles, and composition trends\n"
                f"  • Engagement performance of content categories (food, fashion, travel, etc.)\n"
                f"  • Creator strategy: lighting, colour, props, framing\n"
                f"  • Lifecycle stages (Rising / Stable / Declining) of visual clusters\n\n"
                f"Your query appears to be about a different topic. Please ask a question "
                f"related to social media content, visual trends, or photography strategy."
            )

    # Must have at least one in-scope signal
    has_scope = any(kw in q for kw in _SCOPE_KEYWORDS)
    if not has_scope:
        return False, (
            f"❌ Out of scope: TrendLens only answers questions about **social media visual trends** "
            f"and **photography strategy** grounded in its real FAISS cluster database.\n\n"
            f"Try rephrasing your query to mention: visual style, content category (food, fashion, "
            f"travel, etc.), photography, engagement, lifecycle stage, or a specific aesthetic."
        )

    return True, None


def run_query(idx: TrendRAGIndex, query: str, k: int = TOP_K,
             verbose: bool = False) -> str:
    # ── Topic restriction guard ──────────────────────────────────────────
    in_scope, rejection = _is_in_scope(query)
    if not in_scope:
        return rejection

    intent = detect_intent(query)
    results, meta = idx.search(query, intent, k=k)

    # FAISS-only: always use the evidence-grounded fallback synthesiser.
    # Gemini / LLM is intentionally not called from this path.
    answer = fallback_recommendation(query, results, intent,
                                     idx.dataset_latest_year, meta["low_confidence"])

    return format_response(query, results, intent, meta, idx.dataset_latest_year,
                           answer, verbose=verbose)


# -----------------------------------------------------------------------
# Response Formatter (issue #17 — creator-friendly, answer-first)
# -----------------------------------------------------------------------
LIFECYCLE_EMOJI = {"Rising": "\U0001F680", "Stable": "\U0001F4CA", "Declining": "\U0001F4C9"}


def _intent_summary(intent: dict) -> str:
    tags = []
    if intent["categories"]:
        tags.append(" / ".join(c.capitalize() for c in intent["categories"]))
    if intent["creator_query"]:
        tags.append("Creator")
    if intent["visual_strategy_query"]:
        tags.append("Visual strategy")
    if intent["current_query"]:
        tags.append("Current/latest")
    if intent["rank_by_engagement"]:
        tags.append("Performance-ranked")
    if intent["lifecycle_requested"]:
        tags.append(f"Lifecycle={intent['lifecycle_requested']}")
    if intent["requested_subject"]:
        tags.append(f'Subject="{intent["requested_subject"]}"')
    return " | ".join(tags) if tags else "General trend query"


def _evidence_lines(results: list) -> list:
    lines = []
    for rank, r in enumerate(results, 1):
        cap = r["cap"]
        s = cap.get("stats", {})
        emo = LIFECYCLE_EMOJI.get(cap.get("lifecycle_stage", ""), "")
        lc = cap.get("lifecycle_stage", "N/A")
        lines.append(
            f"  #{rank} Cluster {r['cid']} [{cap.get('dominant_category', 'N/A')}] "
            f"{emo}{lc} | "
            f"engagement={format_percentage(s.get('mean_engagement_rate', 0))} "
            f"viral={format_percentage(s.get('viral_rate', 0))} | "
            f"posts={s.get('total_posts', 0):,} | score={r['final_score']:.3f}"
        )
    return lines


def _verbose_dump(results: list) -> list:
    lines = []
    for rank, r in enumerate(results, 1):
        cap, s = r["cap"], r["cap"].get("stats", {})
        peak_q = cap.get("peak_quarter", "N/A")
        try:
            dt = pd.Timestamp(peak_q)
            peak_str = f"Q{(dt.month-1)//3+1} {dt.year}"
        except Exception:
            peak_str = str(peak_q)
        lines += [
            f"  ─── #{rank}  Cluster {r['cid']} ─── (final_score: {r['final_score']:.4f} | "
            f"semantic={r['semantic']:.2f} category={r['category']:.2f} lifecycle={r['lifecycle']:.2f} "
            f"engagement={r['engagement']:.2f} viral={r['viral']:.2f} recency={r['recency']:.2f})",
            f"  \U0001F4CC  {cap.get('title', '')}",
        ]
        if cap.get("blip2_caption"):
            lines.append(f"  \U0001F441\uFE0F  BLIP-2: {cap['blip2_caption'][:100]}")
        lines += [
            f"  {fill(cap.get('template_caption', ''), width=66, subsequent_indent='  ')}",
            f"  Stage: {cap.get('lifecycle_stage', 'N/A')} | Peak: {peak_str} | "
            f"Engagement: {format_percentage(s.get('mean_engagement_rate', 0))} | "
            f"Viral: {format_percentage(s.get('viral_rate', 0))} | "
            f"Posts: {s.get('total_posts', 0):,} | "
            f"Avg duration: {s.get('mean_trend_duration_days', 0):.1f} days",
        ]
        if cap.get("geographic_hotspots"):
            lines.append(f"  Top cities: {', '.join(cap['geographic_hotspots'])}")
        if cap.get("keywords"):
            lines.append(f"  Tags: {' '.join(cap['keywords'][:6])}")
        lines.append("")
    return lines


def format_response(query: str, results: list, intent: dict, meta: dict,
                    dataset_latest_year, llm_answer: str = None,
                    verbose: bool = False) -> str:
    if not results:
        return (
            f"\u274C No matching trends found for: \"{query}\"\n\n"
            f"  Detected intent: {_intent_summary(intent)}\n\n"
            "  Try broadening your query — the hybrid ranker found no candidates "
            "at all, which usually means the index is empty or the query shares "
            "no vocabulary with anything in the dataset."
        )

    latest_str = str(dataset_latest_year) if dataset_latest_year else "unknown (no parseable dates in dataset)"

    lines = [
        "=" * 70,
        "TrendLens Visual Trend Intelligence",
        "=" * 70,
        "",
        "Query:",
        f"  {query}",
        "",
        f"Detected intent: {_intent_summary(intent)}",
    ]
    if meta.get("low_confidence"):
        lines.append("\u26A0  Confidence: LOW — retrieved evidence only weakly matches this request.")
    lines.append("")

    if llm_answer:
        lines += [llm_answer.strip(), ""]

    lines += [
        "-" * 70,
        "Evidence (top retrieved clusters, already re-ranked)",
        "-" * 70,
    ]
    lines += _evidence_lines(results)
    lines.append("")

    if verbose:
        lines += ["-" * 70, "Verbose raw retrieval detail", "-" * 70, ""]
        lines += _verbose_dump(results)

    lines.append("=" * 70)
    lines.append(f"Retrieved clusters: {len(results)} (candidate pool: {meta.get('pool_size', 'N/A')}) "
                f"| Run with --verbose for full raw cluster dump.")
    lines.append("=" * 70)
    return "\n".join(lines)


# -----------------------------------------------------------------------
# Index I/O
# -----------------------------------------------------------------------
def load_index() -> TrendRAGIndex:
    if not FAISS_INDEX.exists():
        print(f"[ERROR] FAISS index not found at {FAISS_INDEX}")
        print("  Run: python rag_query_system.py --build-index")
        sys.exit(1)
    print(f"[RAG] Loading encoder: {ENCODER_ID} …")
    idx = TrendRAGIndex()
    idx.encoder = SentenceTransformer(ENCODER_ID)
    idx.faiss_index = faiss.read_index(str(FAISS_INDEX))
    idx.vectors = np.load(str(VECTORS_NPY))
    with open(META_PKL, "rb") as f:
        saved = pickle.load(f)
    idx.cluster_ids = saved["cluster_ids"]
    idx.metadata = saved["metadata"]
    idx._compute_dataset_latest_year()
    print(f"[RAG] Loaded: {idx.faiss_index.ntotal} vectors, "
          f"{len(idx.cluster_ids)} clusters"
          + (f", latest period: {idx.dataset_latest_year}" if idx.dataset_latest_year else ""))
    return idx


def build_index() -> TrendRAGIndex:
    if not CAPTIONS_PATH.exists():
        print(f"[ERROR] Captions not found at {CAPTIONS_PATH}")
        print("  Run: python generate_captions.py  first.")
        sys.exit(1)
    with open(CAPTIONS_PATH) as f:
        captions_raw = json.load(f)
    captions = {int(k): v for k, v in captions_raw.items()}
    print(f"[RAG] Building FAISS index from {len(captions)} cluster captions …")
    idx = TrendRAGIndex()
    idx.build(captions)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    faiss.write_index(idx.faiss_index, str(FAISS_INDEX))
    np.save(str(VECTORS_NPY), idx.vectors)
    with open(META_PKL, "wb") as f:
        pickle.dump({"cluster_ids": idx.cluster_ids, "metadata": idx.metadata}, f)

    print(f"  -> {FAISS_INDEX}")
    print(f"  -> {VECTORS_NPY}")
    print(f"  -> {META_PKL}")
    return idx


# -----------------------------------------------------------------------
# Validation (issue #13, #14 — retrieval and LLM checked separately)
# -----------------------------------------------------------------------
BENCHMARK_QUERIES = [
    {
        "query": "what food trends are rising?",
        "expect_lifecycle": "Rising",
        "expect_category": "food",
    },
    {
        "query": "most viral fashion trends",
        "expect_lifecycle": None,
        "expect_category": "fashion",
    },
    {
        "query": "urban street photography trends",
        "expect_lifecycle": None,
        "expect_category": "street",
    },
    {
        "query": "declining nature trends from 2011",
        "expect_lifecycle": "Declining",
        "expect_category": "nature",
    },
    {
        "query": "top highly engaging travel clusters",
        "expect_lifecycle": None,
        "expect_category": "travel",
    },
    {
        "query": "I'm a food blogger photographing pasta. What visual style "
                 "should I use to make the image perform well?",
        "expect_lifecycle": None,
        "expect_category": "food",
        "expect_creator": True,
        "expect_visual": True,
        "expect_subject_contains": "pasta",
    },
    {
        "query": "what is trending right now in food photography?",
        "expect_lifecycle": None,
        "expect_category": "food",
        "expect_current": True,
    },
    {
        "query": "best way to shoot a cup of coffee for instagram",
        "expect_lifecycle": None,
        "expect_category": "food",
        "expect_subject_contains": "coffee",
    },
]


def run_validation(idx: TrendRAGIndex, use_llm: bool = False, verbose: bool = False):
    print("\n" + "=" * 70)
    print("  VALIDATION — RAG System Evaluation")
    print("=" * 70)
    if idx.dataset_latest_year:
        print(f"  Latest period represented in dataset: {idx.dataset_latest_year}")
    else:
        print("  \u26A0 No parseable dates found in dataset — recency ranking is neutral.")

    all_p_at_k = []
    intent_check_results = []

    for i, bq in enumerate(BENCHMARK_QUERIES, 1):
        q = bq["query"]
        exp_life = bq.get("expect_lifecycle")
        exp_cat = bq.get("expect_category")

        print(f"\n[{i}/{len(BENCHMARK_QUERIES)}] Query: \"{q}\"")

        intent = detect_intent(q)
        results, meta = idx.search(q, intent, k=3)

        # --- Retrieval precision@k (category/lifecycle) ---
        hits = 0
        for r in results:
            cap = r["cap"]
            cat_match = (cap.get("dominant_category") == exp_cat or
                        exp_cat in cap.get("secondary_categories", []))
            life_match = (exp_life is None or cap.get("lifecycle_stage") == exp_life)
            if cat_match and life_match:
                hits += 1
        precision_at_k = hits / max(len(results), 1)
        all_p_at_k.append(precision_at_k)
        print(f"  Expected lifecycle: {exp_life or 'any'} | category: {exp_cat}")
        print(f"  Results retrieved: {len(results)} | Precision@{len(results)}: {precision_at_k:.2f}")
        for line in _evidence_lines(results):
            print(" " + line)

        # --- Intent-detection checks (issue #13) ---
        checks = []
        if bq.get("expect_creator"):
            checks.append(("creator_query detected", intent["creator_query"]))
        if bq.get("expect_visual"):
            checks.append(("visual_strategy_query detected", intent["visual_strategy_query"]))
        if bq.get("expect_current"):
            checks.append(("current_query detected", intent["current_query"]))
        if bq.get("expect_subject_contains"):
            subj = (intent.get("requested_subject") or "").lower()
            checks.append((f"subject contains '{bq['expect_subject_contains']}'",
                          bq["expect_subject_contains"] in subj))
        if checks:
            for label, passed in checks:
                print(f"  [{'PASS' if passed else 'FAIL'}] {label}")
            intent_check_results.extend(passed for _, passed in checks)

        # --- Evidence quality: were any recurring visual terms found? ---
        recurring = extract_recurring_visual_terms(results)
        print(f"  Recurring visual evidence terms: {[t for t, _ in recurring[:5]] or 'none'}")

        # --- Optional, expensive Gemini validation ---
        if use_llm and results and GEMINI_AVAILABLE:
            if not _breaker_active():
                time.sleep(4)
            prompt = build_gemini_prompt(q, results, intent, idx.dataset_latest_year,
                                         meta["low_confidence"])
            answer = call_gemini(prompt, max_retries=2)
            print(f"\n  \U0001F916 Gemini: {answer[:300]}{'...' if len(answer) > 300 else ''}")
        elif use_llm and not GEMINI_AVAILABLE:
            print("  [Gemini validation requested but unavailable — no API key]")

    mean_p = np.mean(all_p_at_k) if all_p_at_k else 0.0
    intent_pass_rate = (np.mean(intent_check_results) if intent_check_results else None)

    print("\n" + "=" * 70)
    print("  VALIDATION SUMMARY")
    print("=" * 70)
    print(f"  Queries evaluated      : {len(BENCHMARK_QUERIES)}")
    print(f"  Mean retrieval Precision@k : {mean_p:.4f}")
    if intent_pass_rate is not None:
        print(f"  Intent-detection pass rate : {intent_pass_rate:.0%}")
    print(f"  Gemini LLM used this run    : {'Yes' if use_llm and GEMINI_AVAILABLE else 'No'}"
          + ("" if GEMINI_AVAILABLE else " (set GOOGLE_API_KEY to enable)"))
    print("=" * 70)
    print("\n\u2705 Benchmark validation complete.")
    return mean_p


# -----------------------------------------------------------------------
# Interactive REPL
# -----------------------------------------------------------------------
def interactive_mode(idx: TrendRAGIndex, verbose: bool = False):
    print("\n" + "=" * 70)
    print("  TrendLens RAG Query System — Interactive Mode")
    print("  Retrieval: FAISS + hybrid re-rank | Reasoning: Gemini LLM")
    print("  Type 'help' for examples, 'verbose on/off' to toggle detail, 'quit' to exit")
    print("=" * 70)

    HELP_TEXT = """
    Query examples:
      - "what food trends are rising?"
      - "most viral fashion trends"
      - "what is trending right now in food photography?"
      - "I'm a food blogger posting arrabiata pasta — how should I shoot it?"
      - "top 3 travel trends"
    """

    while True:
        try:
            query = input("\n\U0001F50E Query > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting. Goodbye!")
            break
        if not query:
            continue
        if query.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break
        if query.lower() == "help":
            print(HELP_TEXT)
            continue
        if query.lower() in ("verbose on", "verbose"):
            verbose = True
            print("[verbose output enabled]")
            continue
        if query.lower() == "verbose off":
            verbose = False
            print("[verbose output disabled]")
            continue

        k = TOP_K
        top_match = re.search(r"\btop\s+(\d+)\b", query, re.IGNORECASE)
        if top_match:
            k = min(int(top_match.group(1)), 20)

        print(run_query(idx, query, k=k, verbose=verbose))


# -----------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="TrendLens RAG Trend Query System (FAISS + hybrid re-rank + Gemini)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("--build-index", action="store_true",
                        help="Build FAISS index from cluster_captions.json")
    parser.add_argument("--query", type=str, default=None,
                        help="Run a single natural-language query")
    parser.add_argument("--interactive", action="store_true",
                        help="Launch interactive query REPL")
    parser.add_argument("--validate", action="store_true",
                        help="Run fast retrieval-only benchmark validation (no Gemini calls)")
    parser.add_argument("--validate-llm", action="store_true",
                        help="Also run Gemini reasoning during validation (slower, rate-limited)")
    parser.add_argument("--top-k", type=int, default=TOP_K,
                        help=f"Results to return (default: {TOP_K})")
    parser.add_argument("--verbose", action="store_true",
                        help="Show full raw per-cluster retrieval detail in query output")

    args = parser.parse_args()

    if not any([args.build_index, args.query, args.interactive, args.validate, args.validate_llm]):
        parser.print_help()
        sys.exit(0)

    idx = build_index() if args.build_index else load_index()

    if args.query:
        print(run_query(idx, args.query, k=args.top_k, verbose=args.verbose))

    if args.validate or args.validate_llm:
        run_validation(idx, use_llm=args.validate_llm, verbose=args.verbose)

    if args.interactive:
        interactive_mode(idx, verbose=args.verbose)
