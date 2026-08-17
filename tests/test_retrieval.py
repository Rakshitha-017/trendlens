import numpy as np
import pytest

import config
from src import retrieval


def _interpretations():
    return [
        {"cluster_id": 0, "name": "dogs", "description": "a dog on a blanket"},
        {"cluster_id": 1, "name": "cats", "description": "a white cat with yellow eyes"},
        {"cluster_id": 2, "name": "sneakers", "description": "a pair of sneakers in a box"},
    ]


class TestBuildClusterTexts:
    def test_alignment(self):
        texts, ids = retrieval.build_cluster_texts(_interpretations())
        assert ids == [0, 1, 2]
        assert texts[0] == "dogs. a dog on a blanket"

    def test_field_switch_is_noop(self):
        # field= is deprecated; corpus text is always name + keywords + description
        full, _ = retrieval.build_cluster_texts(_interpretations())
        by_name, _ = retrieval.build_cluster_texts(_interpretations(), field="name")
        assert by_name == full

    def test_corpus_text_joins_name_and_description(self):
        it = {"cluster_id": 0, "name": "dogs", "description": "a dog on a blanket"}
        assert retrieval.cluster_corpus_text(it) == "dogs. a dog on a blanket"


class TestEmbedTexts:
    def test_stub_embed_fn_shape(self):
        def stub(model, processor, texts, device=None, batch_size=16):
            rng = np.random.default_rng(0)
            e = rng.standard_normal((len(texts), 8))
            return e / (np.linalg.norm(e, axis=1, keepdims=True) + 1e-12)

        out = stub(None, None, ["a", "b", "c"], device="cpu")
        assert out.shape == (3, 8)
        np.testing.assert_allclose(np.linalg.norm(out, axis=1), 1.0, atol=1e-6)


class TestIndex:
    def test_build_and_query(self, tmp_path):
        rng = np.random.default_rng(7)
        embs = rng.standard_normal((5, 4))
        embs = embs / np.linalg.norm(embs, axis=1, keepdims=True)
        index = retrieval.build_index(embs)
        assert index.ntotal == 5
        q = embs[3]
        dists, idxs = retrieval.query_index(index, q, k=3)
        assert idxs[0][0] == 3  # nearest to itself
        assert idxs.shape == (1, 3)
        # descending similarity for normalized IP
        assert list(dists[0]) == sorted(dists[0], reverse=True)

    def test_save_load_roundtrip(self, tmp_path):
        rng = np.random.default_rng(1)
        embs = rng.standard_normal((3, 4)).astype("float32")
        index = retrieval.build_index(embs)
        p = retrieval.save_index(index, tmp_path / "idx.faiss")
        loaded = retrieval.load_index(p)
        assert loaded.ntotal == 3


class TestEvaluateRetrieval:
    def _make_index(self, n=6, d=8):
        rng = np.random.default_rng(42)
        embs = rng.standard_normal((n, d))
        embs = embs / np.linalg.norm(embs, axis=1, keepdims=True)
        return retrieval.build_index(embs), embs

    def test_hit_at_k_and_mrr(self):
        index, embs = self._make_index()
        cluster_ids = list(range(6))
        labels = {
            "cat": {"expected_clusters": [3], "note": "seed"},
            "dog": {"expected_clusters": [1, 2], "note": "seed"},
        }

        def embed_fn(model, processor, texts, device=None):
            q = np.zeros((len(texts), 8))
            for i, t in enumerate(texts):
                q[i] = embs[3 if t == "cat" else 1]
            return q

        res = retrieval.evaluate_retrieval(
            labels, embed_fn, index, cluster_ids, k_values=(1, 3), model=None,
            processor=None, device="cpu",
        )
        agg = res["aggregate"]
        assert agg["n_queries"] == 2
        assert agg["hit@1"] == 1.0  # both queries hit their top cluster
        assert agg["hit@3"] == 1.0
        assert agg["mrr"] == 1.0

    def test_per_query_rows(self):
        index, embs = self._make_index()
        labels = {"q1": {"expected_clusters": [0], "note": "x"}}

        def embed_fn(model, processor, texts, device=None):
            return np.zeros((1, 8))

        res = retrieval.evaluate_retrieval(
            labels, embed_fn, index, list(range(6)), k_values=(1, 5),
            model=None, processor=None, device="cpu",
        )
        row = res["per_query"][0]
        assert "hit@1" in row and "mrr" in row
        assert len(row["retrieved_top5"]) == 5


class TestPersistence:
    def test_save_eval_results(self, tmp_path):
        res = {"aggregate": {"hit@1": 0.5, "n_queries": 2}, "per_query": []}
        p = retrieval.save_eval_results(res, tmp_path / "r.json")
        import json

        data = json.loads(p.read_text())
        assert "disclaimer" in data
        assert data["aggregate"]["hit@1"] == 0.5
