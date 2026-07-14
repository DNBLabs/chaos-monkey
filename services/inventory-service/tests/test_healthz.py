from fastapi.testclient import TestClient

from inventory_service.app import app

client = TestClient(app)


def test_healthz_returns_ok():
    res = client.get("/healthz")

    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
