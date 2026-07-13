# Chaos Monkey E-Commerce Sandbox

Microservices e-commerce sandbox whose purpose is demonstrating resilience under chaos: cart, checkout, and inventory survive inventory-targeted experiments.

## Language

**Cart**:
A session-scoped collection of intended purchases (line items of SKU + quantity). Survives a failed checkout so the shopper can retry.
_Avoid_: Basket, bag

**Checkout**:
An in-flight attempt to turn a Cart into an Order. Owns status and the Idempotency Key for that attempt. One Cart may spawn multiple Checkouts across retries; the same Idempotency Key always yields the same Checkout outcome. Lifecycle: `RESERVING` → `PAYMENT_PENDING` → `COMMITTING` → `COMPLETED`, with `FAILED` (terminal, reason attached) reachable from every non-terminal state. Failure releases the Reservation and keeps the Cart.
_Avoid_: Purchase, transaction, order attempt

**Idempotency Key**:
A client-generated UUID scoped to one deliberate "Pay" action. Retries of that action reuse the key; a new click gets a new key and a new Checkout. Inventory deduplicates Reservations by Checkout identity so the same attempt cannot double-hold Stock.
_Avoid_: Request ID, correlation ID (those are observability; this is business dedup)

**Reservation**:
A time-bounded hold of stock for a specific Checkout. Created at checkout start for every Cart line item or none (all-or-nothing); released on failure or TTL expiry; committed into a deduction on success. Replaying the same Checkout returns the existing Reservation rather than creating another. TTL is 5 minutes.
_Avoid_: Lock, hold (prefer Reservation as the noun)

**Order**:
The immutable success artifact created only after a Reservation is committed. Not created for failed Checkouts.
_Avoid_: Purchase, sale, transaction

**Payment Attempt**:
A stubbed payment step for a Checkout. Outcomes are `SUCCEEDED` or `FAILED`; no real charge. Happy path always succeeds unless the demo forces failure. Separates "payment failed" from "inventory failed" in the resilience story.
_Avoid_: Payment, charge, transaction (real money is out of scope)

**Stock**:
Per-SKU inventory quantities, tracked as available and reserved.
_Avoid_: Inventory count (prefer Stock for the quantity record; Inventory for the service/context)

**SKU**:
The identity of a sellable product unit used across Cart line items, Reservations, and Stock.
_Avoid_: Product ID, item code

**Catalog**:
The fixed, seeded list of sellable products (SKU, display name, price, image). Loaded into Inventory at deploy; no admin CRUD or separate Catalog service.
_Avoid_: Product catalog, PIM

**Restock**:
A demo-only action that resets Stock to seed levels so repeated chaos demos do not run out of inventory. Not shopper-facing.
_Avoid_: Replenish, refill (those imply automatic background behavior)

## Boundaries

- **Cart** — session shopping intent; owns the Cart and its line items only
- **Checkout** — purchase orchestration; owns Checkout, Payment Attempt, and Order; reads Cart, calls Inventory for Reservations
- **Inventory** — stock truth; owns Stock, Reservation, Catalog seed data, and Restock; never owns Cart or Checkout state
