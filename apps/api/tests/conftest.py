import pytest

from app.main import load_data


@pytest.fixture(scope="session", autouse=True)
def _startup():
    """TestClient only fires startup inside a `with` block; load data once for all tests."""
    load_data()
