from fastapi import FastAPI

from inventory_service.catalog_seed import CATALOG_SEED

app = FastAPI(title="inventory-service")

# Catalog is loaded once at startup from the interim static seed (ADR-0005).
# Copied per entry so the served payload can never mutate the seed in place.
_CATALOG = [dict(product) for product in CATALOG_SEED]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/catalog")
def get_catalog() -> dict[str, list[dict[str, object]]]:
    return {"products": _CATALOG}
