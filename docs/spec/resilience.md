# Resilience Layers

Spec for wayfinder ticket [Specify resilience layers — Istio, HPA, and checkout behavior](https://github.com/DNBLabs/chaos-monkey/issues/6).

**Question:** What exact resilience behaviors belong in Istio config, HPA rules, and checkout application code so checkout survives inventory chaos experiments?

## Layer split

| Layer | Owns | Does not own |
|-------|------|--------------|
| **Istio** | Connection-level retries, timeouts, and circuit breaking on the Checkout → Inventory mesh hop | Business failures (`409`), checkout state machine, payment |
| **Checkout app** | Orchestration retries, poll backoff, terminal `FAILED` transitions, idempotent replay | Scaling Inventory, mesh routing |
| **HPA** | Inventory CPU-based scale-out during stress | Pod-kill recovery (K8s + `minReplicas`), latency handling |

Cart and Checkout stay at **fixed 1 replica**. HPA applies to **Inventory only**.

## Istio — Checkout → Inventory

Applies to internal calls: `POST /api/v1/internal/reservations`, `POST .../commit`, `DELETE .../release`.

| Setting | Value |
|---------|-------|
| `perTryTimeout` | `2s` |
| Route `timeout` | `8s` |
| `attempts` | `3` |
| `retryOn` | `5xx,reset,connect-failure,refused-stream` |

**Outlier detection** (DestinationRule):

| Setting | Value |
|---------|-------|
| `consecutive5xxErrors` | `5` |
| `interval` | `10s` |
| `baseEjectionTime` | `30s` |
| `maxEjectionPercent` | `50` |

**Retry rules:**

- Same policy on all three methods — `POST` reserve/commit are idempotent by `checkoutId`; app also dedupes.
- Do **not** retry `409` responses (`INSUFFICIENT_STOCK`, `RESERVATION_EXPIRED`, `COMMIT_FAILED`).

## HPA — Inventory

| Setting | Value |
|---------|-------|
| `minReplicas` | `2` |
| `maxReplicas` | `4` |
| `targetCPUUtilization` | `70%` |
| Scale-up stabilization | `0s` (default) |
| Scale-down stabilization | `300s` |

`minReplicas: 2` ensures a healthy peer survives pod-kill chaos while Istio retries route to it.

## Checkout app orchestration

### Reserve (`RESERVING`)

- App-level retry: max **3** attempts on `503` or connection errors only.
- Backoff: `500ms → 1s → 2s` with jitter.
- Do not retry `409 INSUFFICIENT_STOCK`.
- On exhaustion → `FAILED` + `INVENTORY_UNAVAILABLE`; release reservation (best-effort).

### Commit (`COMMITTING`)

- Same retry policy as reserve — max 3 attempts, same backoff, same error filter.
- Idempotent by `checkoutId` — replays return existing outcome.

### Release (on `FAILED`)

- Fire-and-forget `DELETE`; Istio retries handle delivery; no app retry loop.

### Payment

- Stub runs only after reserve succeeds.
- No payment retry on inventory failure.

### Idempotency interaction

- Same `Idempotency-Key` replay → return existing Checkout state (no new reserve attempt).
- New Pay click → new key → fresh Checkout; prior failed Checkout's reservation already released.

### UI polling (`GET /checkouts/{id}`)

| Phase | Interval |
|-------|----------|
| First 10s | `1s` |
| After 10s elapsed | `2s` |
| Stop condition | `COMPLETED` or `FAILED` |

## Reservation TTL during chaos

- TTL remains **5 minutes** — no extension during active chaos.
- Demo experiments are short bursts (< 2 min typical).
- If reserve succeeds but commit is delayed past TTL → `FAILED` + `RESERVATION_EXPIRED`; cart preserved; shopper retries Pay with a new `Idempotency-Key`.
- Checkout does **not** extend or refresh reservations mid-flight.
- Observability: log/metric `RESERVATION_EXPIRED` separately from `INVENTORY_UNAVAILABLE`.

## Per-chaos experiment behavior

| Experiment | Primary layer | Shopper experience |
|------------|---------------|-------------------|
| **Pod kill** | Istio retries + `minReplicas: 2` | Brief delay; checkout succeeds if stock OK; Jaeger shows retry hops |
| **Network latency** | Istio timeouts + retries + app backoff | Longer checkout; succeeds unless chaos sustained past retry exhaustion |
| **CPU stress** | HPA scale-up + timeouts | Slow responses early; HPA adds replicas; checkout slows then recovers |

**Shared rules:**

- Cart preserved on failure.
- Restock resets demo stock between runs.
- Chaos triggered on-demand from demo UI — not background.
- No automatic shopper retry — user clicks Pay again with a new `Idempotency-Key` if prior checkout `FAILED`.

## Demo outcome summary

Transient chaos → visible delay in UI and traces, eventual success on retry when stock exists.

Sustained chaos past Istio + app retry exhaustion → clean `FAILED` + `INVENTORY_UNAVAILABLE`, cart preserved.

Reservation TTL expiry during prolonged chaos → `FAILED` + `RESERVATION_EXPIRED` (acceptable edge case).
