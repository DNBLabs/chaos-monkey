# ADR-0004: TypeScript for cart and checkout, Python for inventory

**Status:** Accepted — 2026-07-14

## Context

Three backend services, and no technical requirement forces them onto the same runtime. A single language would be the default choice and needs justifying against.

## Decision

Cart and Checkout are TypeScript (Express). Inventory is Python (FastAPI).

## Why

Cart and Checkout are thin I/O orchestration — Cart reads and writes Redis, Checkout coordinates HTTP calls and holds no state of its own. Node suits that shape and shares a language with the storefront. Inventory is the one service doing real data work: Stock arithmetic, Reservation lifecycle, and the transactional guarantees behind reserve-then-commit ([ADR-0001](0001-reserve-then-commit-checkout.md)) against Postgres. It is also the sole chaos target and the only autoscaled workload, so it is the service most worth writing in the ecosystem with the stronger data and testing story.

The genuine trade-off is cost: two toolchains, two CI matrix legs, two dependency-audit tools, and no shared types across the boundary. That is accepted deliberately — the API contract is the contract, not a shared library — but a mixed-language stack always makes a reader ask why, which is exactly the question this ADR exists to answer.

Per-project conventions and build layout: [repository-layout.md](../spec/repository-layout.md).
