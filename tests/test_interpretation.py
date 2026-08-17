import numpy as np
from PIL import Image
import pytest

import config
from src import interpretation


class TestKeywords:
    def test_stopwords_removed(self):
        uni, bi = interpretation._keywords(
            ["a photo of a cat on a red sofa", "a red sofa with a cat"]
        )
        assert "cat" in uni
        assert "red" in uni
        assert "sofa" in uni
        assert "photo" not in uni  # stopword
        assert "a" not in uni
        assert "red sofa" in bi

    def test_bigrams_built(self):
        uni, bi = interpretation._keywords(["old wooden chair near window"])
        assert bi["wooden chair"] == 1


class TestInterpretCluster:
    def test_returns_required_fields(self):
        caps = ["a cat on a red sofa", "a cat sleeping on a red sofa",
                "a cat on a red sofa", "a cat and a dog"]
        out = interpretation.interpret_cluster(caps, cluster_id=7)
        assert out["cluster_id"] == 7
        for key in ["name", "description", "characteristics", "confidence", "sample_captions"]:
            assert key in out
        assert "cat" in out["characteristics"]
        assert 0.0 <= out["confidence"] <= 1.0

    def test_empty_captions_fallback(self):
        out = interpretation.interpret_cluster([], cluster_id=3)
        assert out["name"] == "Cluster 3 (uninterpreted)"
        assert out["characteristics"] == []
        assert out["confidence"] == 0.0

    def test_deterministic(self):
        caps = ["a red car", "a red car", "a blue car"]
        a = interpretation.interpret_cluster(caps, 1)
        b = interpretation.interpret_cluster(caps, 1)
        assert a == b

    def test_repeated_caption_used_as_description(self):
        caps = ["a cat on a red sofa", "a cat on a red sofa", "a dog outside"]
        out = interpretation.interpret_cluster(caps, 5)
        assert out["description"] == "a cat on a red sofa"

    def test_no_repeated_caption_falls_back(self):
        caps = ["a cat outside", "a dog in a garden", "a bird on a tree"]
        out = interpretation.interpret_cluster(caps, 6)
        assert out["description"].startswith("A visual cluster")


class TestInterpretAll:
    def test_sorted_by_cluster(self):
        caps = {2: ["a red car"], 1: ["a blue car"], 0: ["a green car"]}
        out = interpretation.interpret_all_clusters(caps)
        assert [x["cluster_id"] for x in out] == [0, 1, 2]


class TestPersistence:
    def test_save_interpretations(self, tmp_path):
        its = [{"cluster_id": 0, "name": "x", "description": "d", "characteristics": [], "confidence": 0.5, "sample_captions": []}]
        p = interpretation.save_interpretations(its, tmp_path / "c.json")
        assert p.exists()
        import json
        data = json.loads(p.read_text())
        assert "disclaimer" in data
        assert data["interpretations"][0]["cluster_id"] == 0

    def test_write_report(self, tmp_path):
        its = [{"cluster_id": 0, "name": "Red Sofa Cats", "description": "d",
                "characteristics": ["cat", "sofa"], "confidence": 0.8, "sample_captions": ["a cat"]}]
        p = interpretation.write_report(its, tmp_path / "r.md")
        text = p.read_text()
        assert "Red Sofa Cats" in text
        assert "INTERPRETATION" not in text.upper() or "interpretations" in text.lower()


class TestCaptionHelpers:
    def test_caption_representatives_skips_bad_images(self, tmp_path):
        d = tmp_path / "imgs"
        d.mkdir()
        Image.new("RGB", (16, 16)).save(d / "ok.jpg")

        def fake_caption(model, processor, image, device=None, max_length=40):
            return "a test caption"

        reps = {
            0: [{"image_path": "imgs/ok.jpg"}, {"image_path": "imgs/missing.jpg"}],
            1: [{"image_path": "imgs/ok.jpg"}],
        }
        out = interpretation.caption_representatives(
            None, None, reps, image_root=tmp_path, k=4,
            device="cpu", show_progress=False, caption_fn=fake_caption,
        )
        assert out[0] == ["a test caption"]  # missing.jpg skipped
        assert out[1] == ["a test caption"]
