import numpy as np
from PIL import Image
import pytest

import config
from src import preprocessing


@pytest.fixture
def image_dir(tmp_path):
    """Create a dir with 2 valid images and 1 corrupt file."""
    d = tmp_path / "imgs"
    d.mkdir()
    Image.new("RGB", (32, 24), (10, 200, 30)).save(d / "ok1.jpg")
    Image.new("L", (16, 16), 128).save(d / "ok2.png")  # grayscale -> convert test
    (d / "corrupt.jpg").write_bytes(b"not an image at all")
    (d / "missing.jpg")
    return d


class TestResolvePath:
    def test_relative_join_when_exists(self, tmp_path):
        d = tmp_path / "a"
        d.mkdir()
        (d / "b.jpg").write_bytes(b"x")
        assert preprocessing.resolve_path("a/b.jpg", tmp_path) == tmp_path / "a/b.jpg"

    def test_falls_back_to_project_root(self, tmp_path):
        # path does not exist under image_root -> fall back to ROOT-relative
        p = preprocessing.resolve_path("a/b.jpg", tmp_path)
        assert p == config.ROOT / "a/b.jpg"

    def test_absolute_unchanged(self, tmp_path):
        assert preprocessing.resolve_path(str(tmp_path), tmp_path) == tmp_path


class TestLoadImage:
    def test_loads_rgb(self, image_dir):
        img = preprocessing.load_image("ok1.jpg", image_dir)
        assert img.mode == "RGB"
        assert img.size == (32, 24)

    def test_converts_grayscale(self, image_dir):
        img = preprocessing.load_image("ok2.png", image_dir)
        assert img.mode == "RGB"

    def test_resize(self, image_dir):
        img = preprocessing.load_image("ok1.jpg", image_dir, resize=(10, 10))
        assert img.size == (10, 10)

    def test_corrupt_raises(self, image_dir):
        with pytest.raises(OSError):
            preprocessing.load_image("corrupt.jpg", image_dir)

    def test_missing_raises(self, image_dir):
        with pytest.raises(FileNotFoundError):
            preprocessing.load_image("missing.jpg", image_dir)


class TestValidateImage:
    def test_valid(self, image_dir):
        ok, reason = preprocessing.validate_image("ok1.jpg", image_dir)
        assert ok and reason == ""

    def test_corrupt(self, image_dir):
        ok, reason = preprocessing.validate_image("corrupt.jpg", image_dir)
        assert not ok and reason == "corrupt"

    def test_missing(self, image_dir):
        ok, reason = preprocessing.validate_image("does_not_exist.jpg", image_dir)
        assert not ok and reason == "missing"


class TestImageDimensions:
    def test_size(self, image_dir):
        assert preprocessing.image_dimensions("ok1.jpg", image_dir) == (32, 24)

    def test_none_for_corrupt(self, image_dir):
        assert preprocessing.image_dimensions("corrupt.jpg", image_dir) is None


class TestImageBatchLoader:
    def test_skips_corrupt_and_missing(self, image_dir, tmp_path):
        paths = ["ok1.jpg", "ok2.png", "corrupt.jpg", "missing.jpg", "ok1.jpg"]
        loader = preprocessing.ImageBatchLoader(
            paths,
            image_root=image_dir,
            batch_size=2,
            cache_validated=False,
            show_progress=False,
        )
        imgs = list(loader.iter_images())
        assert len(imgs) == 3  # 2 unique valid + 1 duplicate
        assert set(loader.bad) == {"corrupt.jpg", "missing.jpg"}
        assert loader.loaded_count == 3

    def test_as_arrays_shape(self, image_dir):
        paths = ["ok1.jpg", "ok2.png"]
        loader = preprocessing.ImageBatchLoader(
            paths,
            image_root=image_dir,
            resize=(10, 10),
            cache_validated=False,
            show_progress=False,
        )
        arr = loader.as_arrays()
        assert arr.shape == (2, 10, 10, 3)
        assert arr.dtype == np.uint8

    def test_resizes_all(self, image_dir):
        paths = ["ok1.jpg", "ok2.png"]
        loader = preprocessing.ImageBatchLoader(
            paths,
            image_root=image_dir,
            resize=(224, 224),
            cache_validated=False,
            show_progress=False,
        )
        for img in loader.iter_images():
            assert img.size == (224, 224)

    def test_validation_cache_is_used(self, image_dir, tmp_path):
        cache = tmp_path / "validated.json"
        paths = ["ok1.jpg", "corrupt.jpg"]
        loader = preprocessing.ImageBatchLoader(
            paths,
            image_root=image_dir,
            cache_validated=True,
            cache_path=cache,
            show_progress=False,
        )
        list(loader.iter_images())
        assert cache.exists()
        # corrupt.jpg is now recorded; loading again should reuse cache
        loader2 = preprocessing.ImageBatchLoader(
            paths,
            image_root=image_dir,
            cache_validated=True,
            cache_path=cache,
            show_progress=False,
        )
        imgs = list(loader2.iter_images())
        assert len(imgs) == 1
        assert loader2.bad == {"corrupt.jpg": "corrupt"}


class TestSampleImageDimensions:
    def test_returns_sizes(self, image_dir):
        dims = preprocessing.sample_image_dimensions(
            ["ok1.jpg", "ok2.png", "corrupt.jpg"], image_dir, n=10, seed=0
        )
        assert dims["ok1.jpg"] == (32, 24)
        assert "corrupt.jpg" not in dims

    def test_deterministic(self, image_dir):
        paths = [f"ok{i}.jpg" for i in range(5)]
        d1 = preprocessing.sample_image_dimensions(paths, image_dir, n=3, seed=9)
        d2 = preprocessing.sample_image_dimensions(paths, image_dir, n=3, seed=9)
        assert set(d1) == set(d2)
