"""Static, in-process Catalog seed — INTERIM per ADR-0005.

This is NOT the end-state source of truth. ADR-0003 places the Catalog seed in
Postgres; ADR-0005 refines that with staged delivery: for the first shopper
slice (issue #17) the Catalog is a fixed in-process list, since nothing here
exercises Stock arithmetic or Reservations. When Inventory gains a datastore
for Stock/Reservations, this same data migrates into Postgres and ADR-0005
moves to Superseded.

See: docs/adr/0005-catalog-static-seed-interim.md
"""

# The Catalog is fixed and seeded — "no admin CRUD" (CONTEXT.md). Each entry is
# the snapshot the storefront sends to Cart on add-to-cart (sku, name, price,
# imageUrl); Cart never calls Inventory to re-validate these fields.
CATALOG_SEED: list[dict[str, object]] = [
    {
        "sku": "SKU-001",
        "name": "Aeron Ergonomic Chair",
        "price": 1395.00,
        "imageUrl": "/images/sku-001.jpg",
    },
    {
        "sku": "SKU-002",
        "name": "Standing Desk (Oak)",
        "price": 649.99,
        "imageUrl": "/images/sku-002.jpg",
    },
    {
        "sku": "SKU-003",
        "name": "Mechanical Keyboard",
        "price": 129.00,
        "imageUrl": "/images/sku-003.jpg",
    },
    {
        "sku": "SKU-004",
        "name": "4K Monitor 27\"",
        "price": 379.50,
        "imageUrl": "/images/sku-004.jpg",
    },
    {
        "sku": "SKU-005",
        "name": "Desk Lamp (Warm)",
        "price": 44.95,
        "imageUrl": "/images/sku-005.jpg",
    },
]
