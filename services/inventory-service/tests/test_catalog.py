from fastapi.testclient import TestClient

from inventory_service.app import app

client = TestClient(app)


def test_get_catalog_returns_seeded_products():
    res = client.get("/api/v1/catalog")

    assert res.status_code == 200
    body = res.json()
    assert "products" in body
    assert len(body["products"]) >= 1


def test_get_catalog_products_carry_snapshot_fields():
    res = client.get("/api/v1/catalog")

    product = res.json()["products"][0]
    assert set(product.keys()) == {"sku", "name", "price", "imageUrl"}
    assert isinstance(product["sku"], str) and product["sku"]
    assert isinstance(product["name"], str) and product["name"]
    assert isinstance(product["price"], (int, float)) and product["price"] >= 0
    assert isinstance(product["imageUrl"], str) and product["imageUrl"]


def test_get_catalog_is_a_fixed_seed_set():
    first = client.get("/api/v1/catalog").json()["products"]
    second = client.get("/api/v1/catalog").json()["products"]

    assert first == second
    skus = [p["sku"] for p in first]
    assert len(skus) == len(set(skus)), "SKUs must be unique in the seed"
