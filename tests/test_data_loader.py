import numpy as np
import pandas as pd
import pytest

from src import data_loader


def make_metadata_df(n=40):
    return pd.DataFrame(
        {
            "image_path": [f"user{i}/img{i}.jpg" for i in range(n)],
            "timestamp": [f"2016-0{i%9+1}-01T00:00:00Z" for i in range(n)],
            "likes": np.arange(n),
            "comments": [0] * n,
            "post_id": [f"p{i}" for i in range(n)],
            "user_id": [f"u{i % 8}" for i in range(n)],
            "category": ["x"] * n,
        }
    )


class TestApplyDatasetConfig:
    def test_maps_canonical_columns(self):
        df = make_metadata_df()
        out = data_loader.apply_dataset_config(df)
        for col in ["image_path", "timestamp", "likes", "comments", "post_id", "user_id"]:
            assert col in out.columns
        assert out["image_path"].iloc[3] == "user3/img3.jpg"
        assert pd.api.types.is_datetime64_any_dtype(out["timestamp"])

    def test_preserves_row_order_and_index(self):
        df = make_metadata_df()
        out = data_loader.apply_dataset_config(df)
        assert out.index.tolist() == df.index.tolist()
        assert (out["post_id"] == df["post_id"]).all()

    def test_missing_column_raises(self):
        df = make_metadata_df().drop(columns=["likes"])
        with pytest.raises(ValueError):
            data_loader.apply_dataset_config(df)

    def test_caption_is_nan_when_absent(self):
        df = make_metadata_df()
        out = data_loader.apply_dataset_config(df)
        assert out["caption"].isna().all()

    def test_custom_config(self):
        df = pd.DataFrame({"photo": ["a.jpg"], "user": ["u1"]})
        cfg = {
            "image_column": "photo",
            "caption_column": None,
            "timestamp_column": None,
            "likes_column": None,
            "comments_column": None,
            "post_id_column": None,
            "user_id_column": "user",
        }
        out = data_loader.apply_dataset_config(df, cfg)
        assert out["image_path"].iloc[0] == "a.jpg"
        assert out["user_id"].iloc[0] == "u1"


class TestParseTags:
    def test_json_string(self):
        assert data_loader.parse_tags('["a", "b"]') == ["a", "b"]

    def test_list(self):
        assert data_loader.parse_tags(["a", "b"]) == ["a", "b"]

    def test_comma_string(self):
        assert data_loader.parse_tags("a, b") == ["a", "b"]

    def test_nan(self):
        assert data_loader.parse_tags(float("nan")) == []


class TestSamplePosts:
    def test_deterministic(self):
        df = make_metadata_df(200)
        a = data_loader.sample_posts(df, n=50, seed=42)
        b = data_loader.sample_posts(df, n=50, seed=42)
        assert a["post_id"].tolist() == b["post_id"].tolist()

    def test_size(self):
        df = make_metadata_df(200)
        assert len(data_loader.sample_posts(df, n=50, seed=1)) == 50

    def test_seeded_plain_sample(self):
        df = make_metadata_df(200)
        s1 = data_loader.sample_posts(df, n=50, seed=7, by_user=False)
        s2 = data_loader.sample_posts(df, n=50, seed=7, by_user=False)
        assert s1["post_id"].tolist() == s2["post_id"].tolist()
        assert len(s1) == 50

    def test_no_duplicate_posts(self):
        df = make_metadata_df(300)
        s = data_loader.sample_posts(df, n=100, seed=3)
        assert s["post_id"].is_unique

    def test_user_diversity_round_robin(self):
        df = make_metadata_df(100)  # 8 users
        s = data_loader.sample_posts(df, n=20, seed=5)
        # round-robin: 8 unique users in first 8 rows
        assert s["user_id"].nunique() == 8

    def test_smaller_than_n_returns_all(self):
        df = make_metadata_df(10)
        assert len(data_loader.sample_posts(df, n=50)) == 10


class TestDatasetReport:
    def test_returns_stats(self):
        df = make_metadata_df(60)
        stats = data_loader.dataset_report(df, sample=None)
        assert stats["n_posts"] == 60
        assert stats["n_images"] == 60
        assert stats["n_users"] == 8
        assert stats["timestamp_coverage"] == 1.0
        assert "engagement" in stats
        assert stats["engagement"]["median"] > 0
        assert "posts_per_year" in stats
        assert stats["synthetic_metadata"] is None  # no is_synthetic column
