# ADR-0001: Reserve-then-commit checkout

**Status:** Accepted — 2026-07-14

## Context

Checkout must not oversell Stock when Inventory is being actively degraded by chaos experiments, and a shopper who retries after a failure must not end up holding two Reservations for the same intent.

## Decision

Checkout reserves every Cart line item atomically (all-or-nothing) at the start of the attempt, then commits the Reservation into a Stock deduction only after the Payment Attempt succeeds. Reservations carry a TTL and are released on failure or expiry, leaving the Cart intact for a retry. Inventory deduplicates by Checkout identity, so replaying the same Idempotency Key returns the existing Reservation rather than creating a second one.

## Why

The obvious alternative — deduct Stock immediately at checkout start — is simpler, but under chaos a mid-flight failure would silently destroy Stock with no owner and no way to reclaim it. Reserve-then-commit means every failure path has a defined release, which is precisely the property the resilience demo exists to show. It is hard to reverse: once Inventory implements dedup-by-Checkout, both Checkout and the storefront's retry flow depend on the two-phase shape.

Exact endpoints, TTL, and error codes: [api-contracts.md](../spec/api-contracts.md), [resilience.md](../spec/resilience.md).
