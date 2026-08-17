import json
import threading

from src import api


class TestHandlers:
    def test_health(self):
        h = api.handle_health()
        assert h["status"] == "ok"
        assert h["mode"] == "faiss-only"
        assert h["llmEnabled"] is False
        assert h["totalClustersAnalyzed"] >= 1

    def test_rag_query_requires_text(self):
        import pytest

        with pytest.raises(ValueError):
            api.handle_rag_query({})

    def test_rag_query_runs(self):
        # Uses the real pipeline on the real index (small, cached artifacts).
        res = api.handle_rag_query({"query": "a cup of coffee", "k": 3})
        assert res["query"] == "a cup of coffee"
        assert res["answer"]
        assert len(res["retrievedClusters"]) == 3
        assert res["mode"] == "faiss-only"
        assert res["disclaimer"]
        assert res["inScope"] is True

    def test_rag_query_refuses_out_of_scope(self):
        res = api.handle_rag_query(
            {"query": "write a c program to print hello world", "k": 3}
        )
        assert res["inScope"] is False
        assert res["retrievedClusters"] == []
        assert res["supportingImages"] == []
        assert "Out of scope" in res["answer"]

    def test_trends_sorted(self):
        t = api.handle_trends()
        assert "trends" in t and len(t["trends"]) >= 1
        scores = [x["trend_score_growth_size_stability"] for x in t["trends"]]
        assert scores == sorted(scores, reverse=True)

    def test_clusters_records(self):
        c = api.handle_clusters()
        assert "clusters" in c and len(c["clusters"]) >= 1
        row = c["clusters"][0]
        for key in ["cluster_id", "name", "lifecycle", "n_posts", "trend_score",
                    "representative_image", "representative_image_url"]:
            assert key in row

    def test_predict_is_honest(self):
        p = api.handle_predict({"clusterId": 0})
        assert p["status"] == "NOT EVALUATED"
        assert p["predictedLikes"] is None
        assert p["nMseScore"] is None
        assert p["observedMeanEngagement"] is not None
        assert "NOT EVALUATED" in p["note"]

    def test_predict_missing_cluster(self):
        p = api.handle_predict({"clusterId": 99999})
        assert p["clusterId"] is None


class TestHttpServer:
    def test_server_roundtrip(self):
        server = api.ThreadingHTTPServer(("127.0.0.1", 0), api._Handler)
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            import urllib.request

            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=30) as r:
                data = json.loads(r.read())
            assert data["status"] == "ok"

            req = urllib.request.Request(
                f"http://127.0.0.1:{port}/api/rag-query",
                data=json.dumps({"query": "a red flower", "k": 2}).encode(),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read())
            assert len(data["retrievedClusters"]) == 2
            assert data["answer"]
            assert data["inScope"] is True
        finally:
            server.shutdown()
            server.server_close()

    def test_image_endpoint_serves_whitelisted(self):
        server = api.ThreadingHTTPServer(("127.0.0.1", 0), api._Handler)
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            import urllib.request
            from urllib.parse import quote

            from src import rag

            reps = rag.load_representatives()
            any_path = None
            for rows in reps.values():
                for r in rows:
                    if r.get("image_path"):
                        any_path = r["image_path"]
                        break
                if any_path:
                    break
            assert any_path, "representatives.json has no image paths"
            url = f"http://127.0.0.1:{port}/api/images?path={quote(any_path, safe='')}"
            with urllib.request.urlopen(url, timeout=30) as r:
                body = r.read()
                assert r.status == 200
                assert len(body) > 100
                assert r.headers.get("Content-Type", "").startswith("image/")
        finally:
            server.shutdown()
            server.server_close()

    def test_image_endpoint_rejects_non_whitelisted(self):
        server = api.ThreadingHTTPServer(("127.0.0.1", 0), api._Handler)
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            import urllib.error
            import urllib.request
            from urllib.parse import quote

            url = f"http://127.0.0.1:{port}/api/images?path={quote('../config.py', safe='')}"
            with urllib.request.urlopen(url, timeout=30):
                raise AssertionError("non-whitelisted path must be rejected")
        except urllib.error.HTTPError as e:
            assert e.code in (403, 404)
        finally:
            server.shutdown()
            server.server_close()
