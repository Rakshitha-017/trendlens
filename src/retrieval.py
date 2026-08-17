"""
retrieval.py
------------
Retrieval over cluster interpretations (Stages 10 + 12).

  cluster interpretations (Phase 5, name + description)
      -> CLIP text embeddings (same model as image side: clip-vit-base-patch32)
      -> FAISS flat inner-product index over clusters
      -> query by CLIP text embedding -> top-k clusters
      -> retrieval evaluation (hit@k / MRR) against human-curated labels

INTEGRITY NOTE
--------------
* Text embeddings use the SAME CLIP model as the image embeddings, so text
  and image live in one shared space.
* There are no real per-post SMPD labels locally. Evaluation labels are
  human-curated per cluster (from Phase 5 representative images/captions)
  and recorded as such in ``retrieval_eval_labels.json``. hit@k therefore
  measures "does retrieval surface the cluster that a human inspecting the
  representatives identified for this query", which is real but scoped.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any, Iterable

import numpy as np

import config

TEXT_EMBEDDINGS_PATH = config.EMBEDDINGS_DIR / "cluster_text_embeddings.npy"
TEXT_CLUSTER_IDS_PATH = config.EMBEDDINGS_DIR / "cluster_text_meta.json"
INDEX_PATH = config.EMBEDDINGS_DIR / "cluster_index.faiss"


# ──────────────────────────────────────────────────────────────────────────
# CLIP text embedding
# ──────────────────────────────────────────────────────────────────────────
def load_clip_text():
    """Load CLIPProcessor + CLIPModel (text side)."""
    from transformers import CLIPModel, CLIPProcessor

    from src.embeddings import DEFAULT_CLIP_MODEL as CLIP_MODEL_NAME
    from src.embeddings import detect_device

    device = detect_device()
    processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
    model = CLIPModel.from_pretrained(CLIP_MODEL_NAME)
    model.to(device)
    model.eval()
    return model, processor, device


def embed_texts(
    model,
    processor,
    texts: list[str],
    device: str | None = None,
    batch_size: int = 16,
) -> np.ndarray:
    """
    L2-normalized CLIP text embeddings, shape (n, d), float32.
    """
    import torch

    if device is None:
        device = next(model.parameters()).device.type
    embs: list[np.ndarray] = []
    with torch.no_grad():
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            inputs = processor(text=batch, return_tensors="pt", padding=True)
            inputs = {k: v.to(device) for k, v in inputs.items()}
            out = model.get_text_features(**inputs)
            if hasattr(out, "pooler_output"):
                out = out.pooler_output
            out = out.detach().cpu().numpy()
            out = out / (np.linalg.norm(out, axis=1, keepdims=True) + 1e-12)
            embs.append(out.astype("float32"))
    return np.vstack(embs)


# Corpus version: bump when the index text composition changes so cached
# embeddings are rebuilt automatically.
CORPUS_VERSION = 2


def cluster_corpus_text(it: dict[str, Any]) -> str:
    """One rich text string per cluster: name + characteristics + description."""
    parts: list[str] = []
    name = it.get("name") or ""
    if name:
        parts.append(name)
    chars = [str(c) for c in (it.get("characteristics") or [])]
    if chars:
        parts.append("visual keywords: " + ", ".join(chars[:8]))
    desc = it.get("description") or ""
    if desc:
        parts.append(desc)
    return ". ".join(p for p in parts if p).strip()


def build_cluster_texts(
    interpretations: Iterable[dict[str, Any]],
    field: str | None = None,
) -> tuple[list[str], list[int]]:
    """
    Build the text corpus for the index from Phase 5 interpretations.

    Returns (texts, cluster_ids), aligned index-wise. Text combines the
    cluster name, top characteristics and description so retrieval matches
    how users actually phrase queries (e.g. "cat", "sneakers", "moon").
    """
    texts: list[str] = []
    ids: list[int] = []
    for it in interpretations:
        ids.append(int(it["cluster_id"]))
        texts.append(cluster_corpus_text(it))
    return texts, ids


def embed_interpretations(
    model, processor, interpretations: list[dict[str, Any]],
    device: str | None = None,
    cache: bool = True,
    field: str | None = None,
) -> tuple[np.ndarray, list[int]]:
    """
    Embed all interpretations; optionally cache to ``cluster_text_embeddings``.

    Returns (embeddings (n,d), cluster_ids).
    """
    texts, ids = build_cluster_texts(interpretations, field=field)
    cache_path = TEXT_EMBEDDINGS_PATH
    cache_meta = TEXT_CLUSTER_IDS_PATH

    if cache and cache_path.exists() and cache_meta.exists():
        saved = json.loads(cache_meta.read_text())
        if saved.get("version") == CORPUS_VERSION and saved.get("cluster_ids") == ids:
            return np.load(cache_path, mmap_mode="r"), ids

    embs = embed_texts(model, processor, texts, device=device)
    if cache:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        np.save(cache_path, embs)
        cache_meta.write_text(
            json.dumps({"version": CORPUS_VERSION, "cluster_ids": ids})
        )
    return embs, ids


# ──────────────────────────────────────────────────────────────────────────
# FAISS index
# ──────────────────────────────────────────────────────────────────────────
def build_index(embeddings: np.ndarray):
    """Flat inner-product FAISS index over already-normalized embeddings."""
    import faiss

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(np.ascontiguousarray(embeddings.astype("float32")))
    return index


def save_index(index, path: Path | None = None) -> Path:
    import faiss

    path = Path(path) if path else INDEX_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(path))
    return path


def load_index(path: Path | None = None):
    import faiss

    path = Path(path) if path else INDEX_PATH
    return faiss.read_index(str(path))


def query_index(index, query_embedding: np.ndarray, k: int = 5) -> tuple[np.ndarray, np.ndarray]:
    """
    Retrieve top-k. query_embedding: (d,) or (q, d), normalized.
    Returns (distances, indices) sorted descending by similarity.
    """
    q = np.ascontiguousarray(query_embedding.astype("float32"))
    if q.ndim == 1:
        q = q[None, :]
    dists, idxs = index.search(q, k)
    return dists, idxs


# ──────────────────────────────────────────────────────────────────────────
# Retrieval evaluation
# ──────────────────────────────────────────────────────────────────────────
def evaluate_retrieval(
    query_labels: dict[str, dict[str, Any]],
    embed_fn,
    index,
    cluster_ids: list[int],
    k_values: Iterable[int] = (1, 3, 5),
    model=None,
    processor=None,
    device: str | None = None,
) -> dict[str, Any]:
    """
    Evaluate hit@k and MRR per query.

    query_labels: {query_text: {"expected_clusters": [...], "note": "..."}}

    embed_fn(model, processor, [query], device) -> (n,d) normalized embeddings.
    Returns per-query rows + aggregate metrics.
    """
    k_values = sorted(k_values)
    max_k = max(k_values)
    rows: list[dict[str, Any]] = []
    id_to_pos = {cid: i for i, cid in enumerate(cluster_ids)}

    for query, meta in query_labels.items():
        q_emb = embed_fn(model, processor, [query], device=device)[0]
        _, idxs = query_index(index, q_emb, k=max_k)
        retrieved = [cluster_ids[int(i)] for i in idxs[0]]
        expected = set(meta["expected_clusters"])
        hits = {}
        rr = 0.0
        for pos, cid in enumerate(retrieved, start=1):
            if pos <= max_k and cid in expected:
                rr = 1.0 / pos if rr == 0.0 else rr
        for k in k_values:
            hits[f"hit@{k}"] = int(any(c in expected for c in retrieved[:k]))
        rows.append(
            {
                "query": query,
                "expected_clusters": list(expected),
                "retrieved_top5": retrieved,
                "note": meta.get("note", ""),
                **hits,
                "mrr": round(rr, 4),
            }
        )

    n = len(rows)
    aggregates = {
        f"hit@{k}": round(sum(r[f"hit@{k}"] for r in rows) / n, 4) for k in k_values
    }
    aggregates["mrr"] = round(sum(r["mrr"] for r in rows) / n, 4)
    aggregates["n_queries"] = n
    return {"aggregate": aggregates, "per_query": rows}


# ──────────────────────────────────────────────────────────────────────────
# Persistence
# ──────────────────────────────────────────────────────────────────────────
def save_eval_results(results: dict[str, Any], path: Path | None = None) -> Path:
    path = Path(path) if path else config.CLUSTER_METADATA_DIR / "retrieval_results.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "disclaimer": config.SYNTHETIC_DATA_WARNING,
        "note": "Evaluation labels are human-curated per cluster from "
        "Phase 5 representatives; no real per-post SMPD labels exist locally.",
        **results,
    }
    path.write_text(json.dumps(payload, indent=1))
    return path


# ──────────────────────────────────────────────────────────────────────────
# CLI driver
# ──────────────────────────────────────────────────────────────────────────
def run_pipeline(
    labels_path: Path | None = None,
    k_values: Iterable[int] = (1, 3, 5),
) -> dict[str, Any]:
    """
    Phase 6 driver:
      1. load Phase 5 interpretations
      2. CLIP-text embed name+description (cached), build FAISS index
      3. evaluate retrieval on curated query labels
    """
    import faiss  # noqa: F401 (fail fast if missing)

    labels_path = Path(labels_path) if labels_path else (
        config.CLUSTER_METADATA_DIR / "retrieval_eval_labels.json"
    )
    interpretations = json.loads(
        (config.CLUSTER_METADATA_DIR / "cluster_captions.json").read_text()
    )["interpretations"]
    print(f"interpretations: {len(interpretations)}")

    model, processor, device = load_clip_text()
    print(f"CLIP text on {device}")

    embs, cluster_ids = embed_interpretations(model, processor, interpretations, device=device)
    index = build_index(np.asarray(embs))
    save_index(index)
    print(f"index: {index.ntotal} clusters, dim {embs.shape[1]}")

    if not labels_path.exists():
        raise FileNotFoundError(
            f"curated label file missing: {labels_path} — curate it first "
            f"(see notebooks/06)."
        )
    query_labels = json.loads(labels_path.read_text())
    query_labels = {k: v for k, v in query_labels.items() if isinstance(v, dict)}
    results = evaluate_retrieval(
        query_labels, embed_texts, index, cluster_ids, k_values=k_values,
        model=model, processor=processor, device=device,
    )
    save_eval_results(results)
    print("\nRetrieval evaluation:")
    for k, v in results["aggregate"].items():
        print(f"  {k}: {v}")
    return results


if __name__ == "__main__":
    run_pipeline()
