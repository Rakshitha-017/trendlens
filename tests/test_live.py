import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

import config
from src import live


def _mk_img(path: Path) -> Path:
    from PIL import Image

    Image.new("RGB", (32, 32), (200, 120, 60)).save(path, "JPEG")
    return path


class TestResolveImageUrl:
    def test_direct_extension(self):
        assert live._resolve_image_url({"url": "https://i.redd.it/ab.jpg"}) == "https://i.redd.it/ab.jpg"

    def test_extensionless_i_redd_it(self):
        assert live._resolve_image_url({"url": "https://i.redd.it/ab"}) == "https://i.redd.it/ab"

    def test_preview_unescape(self):
        post = {
            "url": "https://www.reddit.com/r/x/y/",
            "preview": {"images": [{"source": {"url": "https://preview.redd.it/a.png?auto=webp&amp;s=1"}}]},
        }
        assert live._resolve_image_url(post) == "https://preview.redd.it/a.png?auto=webp&s=1"

    def test_no_image(self):
        assert live._resolve_image_url({"url": "https://www.reddit.com/r/x/y/"}) == ""


class TestRedditFetch:
    def test_public_parse_and_filter(self, monkeypatch):
        def fake_get(url, headers=None, params=None, timeout=None):
            class R:
                status_code = 200

                def raise_for_status(self):
                    return None

                def json(self):
                    return {
                        "data": {"children": [
                            {"data": {"id": "a1", "title": "Flat white", "url": "https://i.redd.it/ab.jpg",
                                      "created_utc": 1700000000, "score": 120, "num_comments": 30,
                                      "permalink": "/r/coffee/comments/a1/"}},
                            {"data": {"id": "a2", "title": "text only", "url": "https://www.reddit.com/r/coffee/",
                                      "created_utc": 1700000001, "score": 1, "num_comments": 0,
                                      "permalink": "/r/coffee/comments/a2/"}},
                        ]}
                    }
            return R()

        monkeypatch.setattr("requests.get", fake_get)
        posts = live.fetch_reddit_posts(subreddits=["coffee"], limit=10)
        assert len(posts) == 1
        p = posts[0]
        assert p["post_id"] == "a1"
        assert p["source"] == "reddit"
        assert p["created_utc"].startswith("2023-11")
        assert p["score"] == 120 and p["num_comments"] == 30
        assert p["image_url"] == "https://i.redd.it/ab.jpg"

    def test_failing_subreddit_is_skipped(self, monkeypatch):
        def boom(url, headers=None, params=None, timeout=None):
            raise RuntimeError("network down")

        monkeypatch.setattr("requests.get", boom)
        assert live.fetch_reddit_posts(subreddits=["foodporn"]) == []


class TestWikimediaFetch:
    def _api_response(self, pages):
        return {"query": {"pages": pages}}

    def test_parses_and_filters(self, monkeypatch):
        now = datetime.now(timezone.utc)
        recent = (now - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
        old = (now - timedelta(days=300)).strftime("%Y-%m-%dT%H:%M:%SZ")

        def fake_get(url, params=None, headers=None, timeout=None):
            pages = {
                "1": {
                    "pageid": 1,
                    "title": "File:Latte art.jpg",
                    "descriptionurl": "https://commons.wikimedia.org/wiki/File:Latte_art.jpg",
                    "imageinfo": [{"timestamp": recent, "thumburl": "https://upload.wikimedia.org/x/640px-Latte.jpg"}],
                },
                "2": {
                    "pageid": 2,
                    "title": "File:Old coffee.jpg",
                    "descriptionurl": "https://commons.wikimedia.org/wiki/File:Old_coffee.jpg",
                    "imageinfo": [{"timestamp": old, "thumburl": "https://upload.wikimedia.org/x/640px-Old.jpg"}],
                },
            }

            class R:
                status_code = 200

                def raise_for_status(self):
                    return None

                def json(self):
                    return self._payload

                _payload = {"query": {"pages": pages}}

            return R()

        monkeypatch.setattr("requests.get", fake_get)
        posts = live.fetch_wikimedia_posts(query_terms=["latte art"], per_term_limit=5, days=14)
        assert len(posts) == 1  # old upload filtered out by real timestamp
        p = posts[0]
        assert p["source"] == "wikimedia-commons"
        assert p["score"] == 0 and p["num_comments"] == 0
        assert p["subreddit"] == "latte art"
        assert p["created_utc"].endswith("+00:00")
        assert p["image_url"] == "https://upload.wikimedia.org/x/640px-Latte.jpg"

    def test_failing_query_is_skipped(self, monkeypatch):
        def boom(url, params=None, headers=None, timeout=None):
            raise RuntimeError("down")

        monkeypatch.setattr("requests.get", boom)
        assert live.fetch_wikimedia_posts() == []


class TestPersistence:
    def test_save_dedupe_sorted(self, tmp_path):
        p = tmp_path / "posts.parquet"
        posts = [
            {"post_id": "b", "subreddit": "x", "title": "b", "created_utc": "2026-01-02T00:00:00+00:00",
             "score": 2, "num_comments": 1, "permalink": "", "image_url": "https://x/b.jpg",
             "source": "reddit", "fetched_at": ""},
            {"post_id": "a", "subreddit": "x", "title": "a", "created_utc": "2026-01-01T00:00:00+00:00",
             "score": 1, "num_comments": 0, "permalink": "", "image_url": "https://x/a.jpg",
             "source": "reddit", "fetched_at": ""},
        ]
        df = live.save_posts(posts, path=p)
        assert len(df) == 2 and df.iloc[0]["post_id"] == "a"
        df2 = live.save_posts([posts[0]], path=p)  # duplicate 'b'
        assert len(df2) == 2
        assert "post_id" in df2.columns


class TestDetectTrends:
    def _df_and_emb(self, tmp_path):
        now = datetime.now(timezone.utc)
        recent = (now - timedelta(days=2)).isoformat()
        prior = (now - timedelta(days=10)).isoformat()
        rows = []
        for i in range(6):  # theme A (coffee-ish)
            rows.append({"post_id": f"a{i}", "subreddit": "coffee", "title": "flat white latte art",
                         "created_utc": recent if i < 4 else prior, "score": 100 + i,
                         "num_comments": 5, "permalink": "/r/coffee/a", "source": "reddit",
                         "fetched_at": "", "image_url": f"https://x/a{i}.jpg"})
        for i in range(6):  # theme B (sneakers) — 2 recent, 4 prior
            rows.append({"post_id": f"b{i}", "subreddit": "sneakers", "title": "nike airmax on feet",
                         "created_utc": recent if i < 2 else prior, "score": 40 + i,
                         "num_comments": 3, "permalink": "/r/sneakers/b", "source": "reddit",
                         "fetched_at": "", "image_url": f"https://x/b{i}.jpg"})
        df = pd.DataFrame(rows)

        emb = np.zeros((len(df), 512), dtype="float32")
        for i in range(6):
            emb[i] = 1.0; emb[i][1:] = 0.0
        for i in range(6):
            emb[6 + i] = 0.0; emb[6 + i][1] = 1.0
        emb = emb / np.linalg.norm(emb, axis=1, keepdims=True)
        return df, emb.astype("float32")

    def test_detects_themes_with_real_growth(self, monkeypatch, tmp_path):
        df, emb = self._df_and_emb(tmp_path)
        img_dir = tmp_path / "img"
        img_dir.mkdir()
        for i in range(6):
            _mk_img(img_dir / f"a{i}.jpg")
            _mk_img(img_dir / f"b{i}.jpg")
        monkeypatch.setattr(config, "LIVE_IMAGES_DIR", img_dir)
        monkeypatch.setattr(config, "LIVE_TRENDS_PATH", tmp_path / "live_trends.json")
        monkeypatch.setattr(config, "LIVE_DATA_WARNING", "REAL LIVE DATA: test")
        monkeypatch.setattr(live, "_blip_caption", lambda p: ("", 0.0))

        trends = live.detect_trends(emb, df, recent_days=7, prior_days=7)

        assert trends["n_themes"] >= 2
        assert trends["source"] == "reddit"
        assert "REAL LIVE DATA" in trends["disclaimer"]
        theme_a = next(t for t in trends["themes"] if "flat" in t["keywords"])
        assert theme_a["recent_posts"] == 4 and theme_a["prior_posts"] == 2
        assert theme_a["growth_rate"] == pytest.approx(1.0)
        assert theme_a["avg_engagement"] == pytest.approx(102.5)
        assert theme_a["has_engagement"] is True
        assert theme_a["source"] == "reddit"
        assert theme_a["channel_label"] == "r/coffee"
        assert theme_a["representative_image_url"].startswith("/api/live-images?name=")
        assert "Shoot images that feature" in theme_a["replicate"]

    def test_empty_input_is_honest(self, tmp_path):
        monkeypatch = __import__("pytest").MonkeyPatch()
        trends = live.detect_trends(np.zeros((0, 512)), pd.DataFrame())
        assert trends["n_themes"] == 0
        assert "no live posts" in trends.get("note", "").lower() or trends["note"]


class TestLiveIntentAndFormatter:
    def test_intent(self):
        from src import rag

        assert rag._live_trend_intent("what is trending in food right now") is True
        assert rag._live_trend_intent("whats hot on pinterest right now") is True
        assert rag._live_trend_intent("a cup of coffee") is False
        assert rag._live_trend_intent("red flowers photography") is False

    def test_formatter(self):
        from src import rag

        ctx = {
            "live_trends": {
                "disclaimer": "REAL LIVE DATA: test",
                "source": "reddit",
                "subreddits": ["foodporn"],
                "recent_window_days": 7,
                "themes": [{
                    "name": "flat white visual theme", "keywords": ["warm", "inviting", "open"],
                    "keywords_emoji": "🔥", "blip_caption": "a flat white in a cup",
                    "subreddits": ["foodporn"], "channel_label": "r/foodporn",
                    "source": "reddit", "has_engagement": True,
                    "recent_posts": 9, "prior_posts": 3,
                    "growth_rate": 2.0, "avg_engagement": 340.5, "total_comments": 120,
                    "representative_image_url": "/api/live-images?name=x.jpg",
                }],
            },
        }
        out = rag.format_live_trends_answer("what is trending in food right now", ctx)
        assert "Trending right now" in out
        assert "+200% vs prior window" in out
        assert "flat white" in out
        assert "9 recent posts" in out
        assert "What to do" in out
        assert "Shoot in warm, natural-toned light" in out
        assert "Wikimedia" not in out
        assert "Reddit" not in out
        assert "caveat" not in out
        assert "no fabricated metrics" not in out

    def test_formatter_commons_no_engagement(self):
        from src import rag

        ctx = {
            "live_trends": {
                "disclaimer": "REAL LIVE DATA: test",
                "source": "wikimedia-commons",
                "subreddits": ["latte art"],
                "recent_window_days": 7,
                "themes": [{
                    "name": "latte art visual theme", "keywords": ["latte", "warm"],
                    "keywords_emoji": "🔥", "blip_caption": "",
                    "subreddits": ["latte art"], "channel_label": "wikimedia search: latte art",
                    "source": "wikimedia-commons", "has_engagement": False,
                    "recent_posts": 5, "prior_posts": 1,
                    "growth_rate": 4.0, "avg_engagement": 0.0, "total_comments": 0,
                    "representative_image_url": "/api/live-images?name=x.jpg",
                }],
            },
        }
        out = rag.format_live_trends_answer("what is trending in food right now", ctx)
        assert "Trending right now" in out
        assert "latte art visual theme" in out
        assert "What to do" in out
        assert "Shoot in warm, natural-toned light" in out
        assert "5 recent posts" in out
        assert "Wikimedia" not in out
        assert "upvotes" not in out
        assert "caveat" not in out

    def test_formatter_tailored_subject(self):
        from src import rag

        ctx = {
            "live_trends": {
                "disclaimer": "REAL LIVE DATA: test",
                "source": "reddit",
                "subreddits": ["foodporn"],
                "recent_window_days": 7,
                "themes": [{
                    "name": "warm visual theme", "keywords": ["warm", "inviting", "setup"],
                    "keywords_emoji": "🔥", "blip_caption": "",
                    "subreddits": ["foodporn"], "channel_label": "r/foodporn",
                    "source": "reddit", "has_engagement": True,
                    "recent_posts": 11, "prior_posts": 0,
                    "growth_rate": None, "avg_engagement": 340.5, "total_comments": 120,
                    "representative_image_url": "/api/live-images?name=x.jpg",
                }],
            },
        }
        out = rag.format_live_trends_answer(
            "what is trending in food right now? I want to post a picture of a pasta on my instagram post",
            ctx,
        )
        assert "Trending right now" in out
        assert "For pasta, the trending look to borrow is" in out
        assert "warm visual theme" in out
        assert "brand new this window" in out
        assert "What to do" in out
        assert "Shoot in warm, natural-toned light" in out
        assert "pasta-specific trend" in out

    def test_formatter_skips_unrelated_subject_themes(self):
        from src import rag

        def theme(name, keywords, recent=5, growth=1.0, prior=1):
            return {
                "name": name, "keywords": keywords, "keywords_emoji": "🔥",
                "blip_caption": "", "subreddits": ["foodporn"],
                "channel_label": "r/foodporn", "source": "reddit",
                "has_engagement": True, "recent_posts": recent, "prior_posts": prior,
                "growth_rate": growth, "avg_engagement": 100.0, "total_comments": 10,
                "representative_image_url": "/api/live-images?name=x.jpg",
            }

        ctx = {
            "live_trends": {
                "disclaimer": "REAL LIVE DATA: test",
                "source": "reddit",
                "subreddits": ["foodporn"],
                "recent_window_days": 7,
                "themes": [
                    theme("coffee visual theme", ["coffee", "sits", "wooden", "table", "laptop"]),
                    theme("warm visual theme", ["warm", "inviting", "open"], recent=11, growth=None, prior=0),
                ],
            },
        }
        out = rag.format_live_trends_answer(
            "what is trending in food right now? I want to post a picture of a pasta on my instagram post",
            ctx,
        )
        assert "coffee visual theme" not in out
        assert "warm visual theme" in out
        assert "What to do" in out
        assert "Shoot in warm, natural-toned light" in out
        assert "pasta-specific trend" in out
        assert "pasta-specific trend" in out
