import os

import config


class TestDotEnvLoader:
    def test_loads_plain_and_quoted(self, monkeypatch, tmp_path):
        monkeypatch.delenv("TRENDLENS_TEST_X", raising=False)
        monkeypatch.delenv("TRENDLENS_TEST_Y", raising=False)
        env = tmp_path / ".env"
        env.write_text("# a comment\nTRENDLENS_TEST_X=hello\nTRENDLENS_TEST_Y=\"quoted value\"\n")
        config._load_dotenv(env)
        assert os.environ.get("TRENDLENS_TEST_X") == "hello"
        assert os.environ.get("TRENDLENS_TEST_Y") == "quoted value"

    def test_never_overrides_existing_env(self, monkeypatch, tmp_path):
        monkeypatch.setenv("TRENDLENS_TEST_X", "already-set")
        env = tmp_path / ".env"
        env.write_text("TRENDLENS_TEST_X=from-file\n")
        config._load_dotenv(env)
        assert os.environ.get("TRENDLENS_TEST_X") == "already-set"

    def test_missing_file_is_noop(self, tmp_path):
        config._load_dotenv(tmp_path / "does-not-exist.env")  # must not raise
