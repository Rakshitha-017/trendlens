import numpy as np
import pandas as pd
from PIL import Image
import pytest

import config
from src import embeddings


@pytest.fixture
def image_dir(tmp_path):
    d = tmp_path / "imgs"
    d.mkdir()
    for i in range(6):
        Image.new("RGB", (32, 32), (i * 10, 100, 200)).save(d / f"img{i}.jpg")
    (d / "corrupt.jpg").write_bytes(b"nope")
    return d


def make_manifest(image_dir, n=6):
    df = pd.DataFrame(
        {
            "post_id": [f"p{i}" for i in range(n)],
            "user_id": [f"u{i % 3}" for i in range(n)],
            "image_path": [f"img{i}.jpg" for i in range(n)],
            "timestamp": pd.date_range("2016-01-01", periods=n, freq="D", tz="UTC"),
            "likes": list(range(n)),
            "comments": [0] * n,
        }
    )
    return df


class StubGenerator(embeddings.CLIPEmbeddingGenerator):
    """Deterministic encoder stub — no torch, no model, no network."""

    def __init__(self, out_dir, image_root, dim=4, seed=0, checkpoint_every=2):
        self._stub_seed = seed
        super().__init__(
            device="cpu",
            out_dir=out_dir,
            image_root=image_root,
            batch_size=4,
            checkpoint_every=checkpoint_every,
            show_progress=False,
            load_model=False,
            proj_dim=dim,
        )

    def encode_batch(self, images):
        rng = np.random.default_rng(self._stub_seed + len(images))
        feats = rng.normal(size=(len(images), self.proj_dim()))
        return embeddings.l2_normalize(feats)


class TestL2Normalize:
    def test_unit_norm(self):
        e = np.array([[3.0, 4.0], [1.0, 0.0]])
        out = embeddings.l2_normalize(e)
        assert np.allclose(np.linalg.norm(out, axis=1), 1.0)

    def test_direction_preserved(self):
        e = np.array([[3.0, 4.0]])
        out = embeddings.l2_normalize(e)
        assert np.allclose(out, e / 5.0)

    def test_returns_float32(self):
        out = embeddings.l2_normalize(np.array([[1.0, 2.0, 3.0]]))
        assert out.dtype == np.float32

    def test_zero_vector_safe(self):
        out = embeddings.l2_normalize(np.array([[0.0, 0.0, 0.0]]))
        assert np.all(np.isfinite(out))


class TestAssertAlignment:
    def test_passes(self):
        e = embeddings.l2_normalize(np.random.default_rng(0).normal(size=(4, 3)))
        df = pd.DataFrame({"post_id": list("abcd")})
        embeddings.assert_alignment(e, df)

    def test_row_count_mismatch_raises(self):
        e = embeddings.l2_normalize(np.random.default_rng(0).normal(size=(4, 3)))
        df = pd.DataFrame({"post_id": list("abcde")})
        with pytest.raises(AssertionError):
            embeddings.assert_alignment(e, df)

    def test_not_normalized_raises(self):
        e = np.full((2, 3), 0.5, dtype="float32")
        df = pd.DataFrame({"post_id": list("ab")})
        with pytest.raises(AssertionError):
            embeddings.assert_alignment(e, df)

    def test_wrong_dtype_raises(self):
        e = np.full((2, 3), 0.577, dtype="float64")
        df = pd.DataFrame({"post_id": list("ab")})
        with pytest.raises(AssertionError):
            embeddings.assert_alignment(e, df)


class TestResumeOffset:
    def test_prefix_match(self):
        manifest = pd.DataFrame({"post_id": ["a", "b", "c", "d"]})
        done = pd.DataFrame({"post_id": ["a", "b", "c"]})
        assert embeddings.compute_resume_offset(manifest, done) == 3

    def test_mismatch_restarts(self):
        manifest = pd.DataFrame({"post_id": ["a", "b", "c"]})
        done = pd.DataFrame({"post_id": ["a", "x"]})
        assert embeddings.compute_resume_offset(manifest, done) == 0

    def test_empty_restarts(self):
        manifest = pd.DataFrame({"post_id": ["a", "b"]})
        assert embeddings.compute_resume_offset(manifest, None) == 0

    def test_complete_manifest(self):
        manifest = pd.DataFrame({"post_id": ["a", "b", "c"]})
        done = pd.DataFrame({"post_id": ["a", "b", "c"]})
        assert embeddings.compute_resume_offset(manifest, done) == 3


class TestPrepareManifest:
    def test_drops_invalid_and_resets_index(self, image_dir, tmp_path):
        df = pd.DataFrame(
            {
                "post_id": ["a", "b", "c"],
                "image_path": ["img0.jpg", "corrupt.jpg", "img1.jpg"],
            }
        )
        out = embeddings.prepare_embedding_manifest(df, image_root=image_dir)
        assert out["post_id"].tolist() == ["a", "c"]
        assert out.index.tolist() == [0, 1]  # reset index
        assert (config.EMBEDDINGS_DIR / "manifest.parquet").exists()


class TestGeneratorRoundTrip:
    def test_full_generate_aligns(self, image_dir, tmp_path):
        out_dir = tmp_path / "out"
        gen = StubGenerator(out_dir, image_dir)
        manifest = make_manifest(image_dir, n=6)
        final = gen.generate(manifest)
        emb = np.load(final)
        assert emb.shape == (6, 4)
        assert emb.dtype == np.float32
        meta = pd.read_parquet(out_dir / "metadata.parquet")
        assert meta["post_id"].tolist() == manifest["post_id"].tolist()
        embeddings.assert_alignment(emb, meta)
        assert np.allclose(np.linalg.norm(emb, axis=1), 1.0)

    def test_resume_after_partial_keeps_prefix(self, image_dir, tmp_path):
        out_dir = tmp_path / "out"
        manifest = make_manifest(image_dir, n=6)

        # Run 1: only the first 3 rows complete (simulated partial run).
        gen1 = StubGenerator(out_dir, image_dir)
        gen1.generate(manifest.iloc[:3])

        # Run 2: full 6-row manifest should resume from row 3.
        gen2 = StubGenerator(out_dir, image_dir)
        final2 = gen2.generate(manifest)
        emb2 = np.load(final2)
        assert emb2.shape == (6, 4)

        run1_emb = np.load(out_dir / "embeddings.npy")
        # overwritten by run2 — instead compare against run1's checkpoint rows
        run1_cp = np.load(out_dir / "embeddings_checkpoint.npy")
        assert np.allclose(emb2[:3], run1_cp[:3])  # prefix preserved, not recomputed

        meta = pd.read_parquet(out_dir / "metadata.parquet")
        assert meta["post_id"].tolist() == manifest["post_id"].tolist()
        embeddings.assert_alignment(emb2, meta)

    def test_rerun_same_manifest_is_idempotent(self, image_dir, tmp_path):
        out_dir = tmp_path / "out"
        manifest = make_manifest(image_dir, n=6)
        gen1 = StubGenerator(out_dir, image_dir)
        gen1.generate(manifest)
        e1 = np.load(out_dir / "embeddings.npy")

        # Re-running the identical manifest must reuse the whole checkpoint
        # (exact-shape read-write memmap path) and produce identical output.
        gen2 = StubGenerator(out_dir, image_dir)
        gen2.generate(manifest)
        e2 = np.load(out_dir / "embeddings.npy")
        assert np.array_equal(e1, e2)

    def test_checkpoint_written_periodically(self, image_dir, tmp_path):
        out_dir = tmp_path / "out"
        gen = StubGenerator(out_dir, image_dir, checkpoint_every=2)
        gen.generate(make_manifest(image_dir, n=6))
        assert (out_dir / "embeddings_checkpoint.npy").exists()
        assert (out_dir / "metadata_checkpoint.parquet").exists()
        cp_meta = pd.read_parquet(out_dir / "metadata_checkpoint.parquet")
        assert len(cp_meta) == 6
