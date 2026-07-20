# ADR-0005: Catalog served from a static seed until Inventory gains a datastore

**Status:** Accepted — 2026-07-15 · **Refines** [ADR-0003](0003-aks-demo-kind-local.md)

## Context

[ADR-0003](0003-aks-demo-kind-local.md) states that Postgres holds Stock and the Catalog seed. That is the accepted end-state. But the first shopper-facing slice (catalog browse + cart, issue #17) needs exactly one Inventory endpoint — `GET /api/v1/catalog`, returning a fixed list of `{ sku, name, price, imageUrl }` — and exercises **none** of the transactional data work (Stock arithmetic, Reservation lifecycle) that justified choosing Postgres in the first place ([ADR-0004](0004-typescript-python-service-split.md)). Standing up Postgres, migrations, a StatefulSet and a seed loader to serve a list that never mutates at runtime would be database infrastructure built ahead of any use for it.

## Decision

For this slice, Inventory serves the Catalog from a **static in-process seed** — a seed file loaded at FastAPI startup and returned by `GET /api/v1/catalog`. No datastore is introduced.

This **refines, and does not supersede, ADR-0003.** ADR-0003's end-state — the Catalog seed living in Postgres — still holds. This is staged delivery of that end-state. The trigger that closes the gap is explicit: **when Inventory gains a datastore for Stock and Reservations, the same seed migrates into Postgres per ADR-0003**, and this ADR moves to Superseded.

## Why

The Catalog is fixed — "no admin CRUD" ([CONTEXT.md](../../CONTEXT.md)). A datastore's value is query, mutation, and persistence; constant data needs none of them, so any datastore is the wrong tool here. A static seed also has the **lowest teardown cost**: the seed *data* outlives the storage mechanism, so when Postgres arrives the same file becomes the DB seed loader — a static file → Postgres migration, not a rip-out-and-replace. The rejected alternatives were worse on exactly this axis: putting the Catalog in cart-service's Redis would either violate the service boundary (Inventory owns the Catalog, not cart's store — [CONTEXT.md](../../CONTEXT.md) boundaries) or stand up a second Redis, i.e. new infrastructure with none of Postgres's benefits and a higher teardown cost than a file.

The genuine risk this record exists to close is that a reader who has seen ADR-0003 will find a static seed and assume the documentation is wrong. Naming the relationship — *refines, staged, with a stated migration trigger* — means the seed file is a recorded interim, not an undocumented deviation. The seed file itself carries a comment pointing back here.

Endpoint shape and seed fields: [api-contracts.md](../spec/api-contracts.md). End-state storage and environment matrix: [ADR-0003](0003-aks-demo-kind-local.md).
