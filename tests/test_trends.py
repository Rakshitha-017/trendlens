import numpy as np
import pandas as pd
import pytest

from src import trends


def make_agg_df(n_clusters=2, months=12):
    """Cluster 1 rising counts 1..n; cluster 2 falling n..1 (period M)."""
    rows = []
    for c in range(n_clusters):
        direction = 1 if c == 0 else -1
        for i in range(months):
            count = i + 1 if direction == 1 else months - i
            rows.append(
                {
                    "cluster_id": c,
                    "period": pd.Period(pd.Timestamp("2016-01-01") + pd.DateOffset(months=i), "M"),
                    "post_count": count,
                    "unique_users": max(1, count // 2),
                    "average_engagement": 10.0 + count,
                    "median_engagement": 5.0 + count,
                }
            )
    return pd.DataFrame(rows)


class TestAggregate:
    def test_columns_and_counts(self):
        df = pd.DataFrame(
            {
                "post_id": [f"p{i}" for i in range(8)],
                "cluster_id": [1, 1, 1, 1, 2, 2, 2, 2],
                "user_id": ["u1", "u3", "u2", "u1", "u4", "u5", "u6", "u7"],
                "timestamp": pd.to_datetime(
                    ["2016-01-15", "2016-01-20", "2016-02-02", "2016-02-05",
                     "2016-01-10", "2016-01-12", "2016-03-01", "2016-03-03"],
                    utc=True,
                ),
                "likes": [1, 2, 3, 4, 5, 6, 7, 8],
                "comments": [0, 0, 0, 0, 0, 0, 0, 0],
            }
        )
        agg = trends.aggregate_cluster_trends(df)
        assert list(agg.columns) == [
            "cluster_id", "period", "post_count", "unique_users",
            "average_engagement", "median_engagement",
        ]
        row = agg[(agg.cluster_id == 1) & (agg.period == pd.Period("2016-01", "M"))].iloc[0]
        assert row.post_count == 2
        assert row.unique_users == 2  # u1, u3
        assert row.average_engagement == pytest.approx(1.5)

    def test_noise_eligible(self):
        df = pd.DataFrame(
            {
                "post_id": ["a", "b", "c"],
                "cluster_id": [-1, 0, 0],
                "user_id": ["u1", "u2", "u3"],
                "timestamp": pd.to_datetime(["2016-01-01", "2016-02-01", "2016-03-01"], utc=True),
                "likes": [0, 1, 1],
                "comments": [0, 0, 0],
            }
        )
        agg = trends.aggregate_cluster_trends(df)
        assert set(agg["cluster_id"].unique()) == {-1, 0}  # keeps noise too


class TestGrowthMetrics:
    def test_rising_vs_falling(self):
        agg = make_agg_df()
        m = trends.growth_metrics(agg, window=3)
        m0 = m[m.cluster_id == 0].iloc[0]
        m1 = m[m.cluster_id == 1].iloc[0]
        assert m0.recent_growth > 0
        assert m1.recent_growth < 0
        assert m0.slope > 0
        assert m1.slope < 0
        assert m0.percentage_growth > 0
        assert m1.percentage_growth < 0

    def test_flat_is_near_zero(self):
        df = pd.DataFrame(
            {
                "cluster_id": [0] * 12,
                "period": pd.period_range("2016-01", periods=12, freq="M"),
                "post_count": [10] * 12,
                "unique_users": [5] * 12,
                "average_engagement": [10.0] * 12,
                "median_engagement": [9.0] * 12,
            }
        )
        m = trends.growth_metrics(df, window=3)
        assert abs(m.recent_growth.iloc[0]) < 1e-9

    def test_acceleration_sign(self):
        # accelerating: counts double each window
        df = pd.DataFrame(
            {
                "cluster_id": [0] * 12,
                "period": pd.period_range("2016-01", periods=12, freq="M"),
                "post_count": [1, 1, 1, 2, 2, 2, 4, 4, 4, 8, 8, 8],
                "unique_users": [1] * 12,
                "average_engagement": [1.0] * 12,
                "median_engagement": [1.0] * 12,
            }
        )
        m = trends.growth_metrics(df, window=3)
        assert m.acceleration.iloc[0] > 0


class TestTrendScores:
    def test_growth_only_ranked_first(self):
        m = make_agg_df()
        metrics = trends.growth_metrics(m)
        scored = trends.trend_scores(metrics)
        assert scored.sort_values("trend_score_growth", ascending=False).iloc[0].cluster_id == 0

    def test_no_nan_scores(self):
        m = make_agg_df()
        scored = trends.trend_scores(trends.growth_metrics(m))
        for col in ["trend_score_growth", "trend_score_growth_size", "trend_score_growth_size_stability"]:
            assert scored[col].notna().all()

    def test_stability_shifts_ranking(self):
        m = make_agg_df()
        metrics = trends.growth_metrics(m)
        # override: small cluster with huge growth vs big cluster with tiny growth
        scored = trends.trend_scores(metrics, stability={0: 1.0, 1: 0.1})
        # S3 should penalise cluster with low stability
        s3 = scored.set_index("cluster_id")["trend_score_growth_size_stability"]
        assert s3.loc[1] <= s3.loc[0]


class TestCompareAlternatives:
    def test_spearman_range(self):
        metrics = pd.DataFrame(
            {
                "cluster_id": [0, 1, 2, 3, 4],
                "recent_growth": [0.9, 0.5, 0.0, -0.3, -0.6],
                "n_posts": [50, 10, 200, 30, 5],
                "mean_period_posts": [5.0, 1.0, 20.0, 3.0, 0.5],
            }
        )
        scored = trends.trend_scores(metrics)
        cmp = trends.compare_score_alternatives(scored)
        assert len(cmp) == 3
        for v in cmp.values():
            assert -1.0 <= v["spearman"] <= 1.0
            assert 0.0 <= v["p"] <= 1.0


class TestClassifyLifecycle:
    def test_thresholds(self):
        df = pd.DataFrame(
            {
                "cluster_id": [0, 1, 2],
                "recent_growth": [0.5, 0.0, -0.5],
                "n_posts": [10, 10, 10],
            }
        )
        out = trends.classify_lifecycle(df, rising_threshold=0.25, declining_threshold=-0.25)
        assert out["lifecycle"].tolist() == ["Rising", "Stable", "Declining"]

    def test_defaults(self):
        df = pd.DataFrame({"cluster_id": [0], "recent_growth": [0.3], "n_posts": [5]})
        out = trends.classify_lifecycle(df)
        assert out["lifecycle"].iloc[0] == "Rising"


class TestTextTrendScores:
    def test_rising_tags_give_positive_score(self):
        # cluster 0's dominant tag 'x' grows over time across dataset
        timestamps = pd.to_datetime(
            ["2016-01-01", "2016-02-01", "2016-03-01", "2016-04-01"] * 3, utc=True
        )
        tags = []
        for i in range(12):
            if i % 4 == 0:
                tags.append(["x"])
            elif i % 4 == 1:
                tags.append(["x", "x"])
            elif i % 4 == 2:
                tags.append(["x", "x", "x"])
            else:
                tags.append(["x", "x", "x", "x"])
        df = pd.DataFrame(
            {
                "cluster_id": [0] * 12,
                "timestamp": timestamps,
                "tags": tags,
            }
        )
        s = trends.text_trend_scores(df, period="M", top_k=5)
        assert s["text_trend_score"].iloc[0] > 0
