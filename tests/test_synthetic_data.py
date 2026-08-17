import numpy as np
import pandas as pd
import pytest

import config
from src import synthetic_data


def make_df(n=10):
    return pd.DataFrame(
        {
            "post_id": [f"p{i}" for i in range(n)],
            "user_id": [f"u{i % 3}" for i in range(n)],
            "image_path": [f"img{i}.jpg" for i in range(n)],
            "timestamp": pd.date_range("2016-01-01", periods=n, freq="D", tz="UTC"),
            "likes": list(range(n)),
            "comments": [0] * n,
        }
    )


class TestHonestTimestamps:
    def test_deterministic(self):
        a = synthetic_data.honest_timestamps(50, seed=42)
        b = synthetic_data.honest_timestamps(50, seed=42)
        assert a.tolist() == b.tolist()

    def test_within_range(self):
        ts = synthetic_data.honest_timestamps(100, seed=1)
        assert (ts >= synthetic_data.START_TS).all()
        assert (ts <= synthetic_data.END_TS).all()

    def test_count_and_tz(self):
        ts = synthetic_data.honest_timestamps(7, seed=3)
        assert len(ts) == 7
        assert ts.dt.tz is not None

    def test_different_seeds_differ(self):
        a = synthetic_data.honest_timestamps(20, seed=1)
        b = synthetic_data.honest_timestamps(20, seed=2)
        assert not a.equals(b)


class TestNeutralizeMetadata:
    def test_preserves_rows_and_order(self, tmp_path):
        df = make_df()
        out = synthetic_data.neutralize_metadata(df, seed=42, out_path=tmp_path / "m.parquet")
        assert len(out) == len(df)
        assert out["post_id"].tolist() == df["post_id"].tolist()
        assert out.index.tolist() == df.index.tolist()

    def test_replaces_timestamps_and_marks_source(self, tmp_path):
        df = make_df()
        out = synthetic_data.neutralize_metadata(df, seed=7, out_path=tmp_path / "m.parquet")
        assert (out["timestamp"] != df["timestamp"]).all()
        assert (out["timestamp_source"] == "neutral-synthetic").all()

    def test_writes_parquet(self, tmp_path):
        path = tmp_path / "m.parquet"
        synthetic_data.neutralize_metadata(make_df(), seed=1, out_path=path)
        assert path.exists()
        reloaded = pd.read_parquet(path)
        assert len(reloaded) == 10

    def test_load_canonical_missing_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            synthetic_data.load_canonical_metadata(tmp_path / "nope.parquet")
