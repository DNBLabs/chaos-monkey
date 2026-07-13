# Domain Docs Maintenance

Spec for wayfinder ticket [Define CONTEXT.md and ADR maintenance approach](https://github.com/DNBLabs/chaos-monkey/issues/13).

**Question:** How should `CONTEXT.md` and ADRs be maintained in this greenfield repo — what gets recorded where, and when does a decision earn an ADR vs a spec doc?

## Decision

Three-layer split: **`CONTEXT.md`** (ubiquitous language + ownership boundaries), **`docs/spec/`** (implementation-ready build specs), **`docs/adr/`** (sparse, hard-to-reverse architectural decisions). Wayfinder specs stay canonical — no bulk backfill into ADRs. ADRs created lazily at implementation kickoff for standing preferences that pass the three-criteria test, then only when new work surfaces qualifying trade-offs.

---

## Layer responsibilities

| Layer | Location | Holds | Does not hold |
|-------|----------|-------|---------------|
| Glossary | `CONTEXT.md` | Domain terms, `_Avoid_` synonyms, service ownership boundaries | Endpoints, config numbers, YAML shapes, tech stack, UI flows |
| Build specs | `docs/spec/*.md` | APIs, resilience numbers, topology, CI/CD, chaos CRDs, UI polling, repo layout | Rationale for surprising architectural forks (that's ADR) |
| ADRs | `docs/adr/NNNN-slug.md` | Hard-to-reverse, surprising, genuine-trade-off decisions | Spec-level detail duplicated from `docs/spec/` |
| Portfolio | `docs/portfolio/` + `README.md` | Scan layer, demo script, diagram exports | Domain glossary (link `CONTEXT.md` instead) |

Single-context repo — no `CONTEXT-MAP.md`. Agents read `CONTEXT.md` + relevant ADRs before exploring code per [domain docs guide](../agents/domain.md).

---

## ADR vs spec — the test

Create an ADR only when **all three** are true (per domain-modeling skill):

1. **Hard to reverse** — meaningful cost to change later
2. **Surprising without context** — a future reader will wonder why
3. **Real trade-off** — genuine alternatives existed; one was chosen for specific reasons

| Outcome | Where it goes |
|---------|---------------|
| Passes all three | `docs/adr/NNNN-slug.md` (short — context + decision + why) |
| Fails any criterion | `docs/spec/` if build detail needed; otherwise code/comments only |
| Domain vocabulary | `CONTEXT.md` |
| Already in a closed wayfinder spec | Leave in spec — do not duplicate into ADR |

**Examples for this repo:**

| Decision | ADR? | Why |
|----------|------|-----|
| Reserve-then-commit checkout | Yes | Surprising saga shape; hard to reverse once Inventory implements dedup |
| Monorepo `services/`/`apps/`/`infra/` | Yes | Architectural shape; affects every PR |
| AKS demo + kind local | Yes | Deployment lock-in; non-obvious split |
| TypeScript cart/checkout, Python inventory | Yes | Language boundary per service; surprising without context |
| HTTP/REST + JSON between services | No | Obvious for portfolio scope; no real alternative weighed |
| Postgres inventory / Redis cart | No | Standard pairing; easy to swap in a sandbox |
| Istio retry `3` / timeout `10s` | No | Spec numbers in [resilience.md](resilience.md) |
| Storefront polling `2s` | No | Spec detail in [storefront-ui.md](storefront-ui.md) |

---

## Maintenance triggers

| Event | Action |
|-------|--------|
| New or refined domain term | Update `CONTEXT.md` inline during domain-modeling session |
| Term renamed | Update `CONTEXT.md`; grep `docs/spec/`, `README.md`, code for old term |
| API/number/YAML/UI detail changes during build | Update the relevant `docs/spec/*.md` in the same PR |
| Qualifying architectural trade-off during build | Add ADR in same PR; link from spec if related |
| ADR superseded | Mark `superseded by ADR-NNNN` in old ADR; add new ADR |
| Topology or demo narrative changes | Update `docs/spec/deployment-topology.md` + README Mermaid per [portfolio-documentation.md](portfolio-documentation.md) |
| Agent contradicts existing ADR | Surface explicitly in output — do not silently override |

**Lazy creation:** `docs/adr/` directory and individual ADRs appear only when first needed. `CONTEXT.md` already exists from domain-modeling; do not recreate.

---

## Implementation kickoff — seed ADRs

At start of implementation (first build PR touching architecture), create **only** these four ADRs from charting standing preferences. Do not backfill the rest of the wayfinder map.

| # | Slug | One-line gist |
|---|------|---------------|
| 0001 | reserve-then-commit-checkout | Checkout reserves all cart lines atomically; commit on success; 5-min TTL |
| 0002 | monorepo-layout | Single repo with `services/`, `apps/`, `infra/` split |
| 0003 | aks-demo-kind-local | Ephemeral AKS for portfolio demo; kind for local dev |
| 0004 | typescript-python-service-split | TS for cart + checkout; Python for inventory |

Each ADR: 1–3 sentences per [ADR format](https://github.com/DNBLabs/chaos-monkey/blob/main/docs/agents/domain.md) — pointer to the detailed spec for numbers and shapes. Example cross-link: ADR-0001 → [api-contracts.md](api-contracts.md), [resilience.md](resilience.md).

---

## What stays in wayfinder specs

Closed wayfinder tickets produced canonical build specs in `docs/spec/`. Those files remain the source of truth for implementation detail. ADRs index *why* at the architectural fork; specs hold *what* at build fidelity.

| Spec | Role |
|------|------|
| [api-contracts.md](api-contracts.md) | REST endpoints, error envelope, headers |
| [resilience.md](resilience.md) | Istio/HPA/app backoff numbers |
| [deployment-topology.md](deployment-topology.md) | Namespaces, replicas, ingress |
| [chaos-experiments.md](chaos-experiments.md) | CRD templates, demo API, RBAC |
| [storefront-ui.md](storefront-ui.md) | UI regions, polling, demo script table |
| [repository-layout.md](repository-layout.md) | Directory tree, Helm, Dockerfiles |
| [cicd.md](cicd.md) | GitHub Actions workflows |
| [portfolio-documentation.md](portfolio-documentation.md) | README + walkthrough structure |

---

## Agent and human workflow

1. **Before exploring or designing:** Read `CONTEXT.md` + ADRs touching the area ([domain.md](../agents/domain.md)).
2. **During domain work:** Use `/domain-modeling` — update `CONTEXT.md` inline when terms crystallize.
3. **During architecture forks:** Apply three-criteria test → ADR or spec.
4. **During implementation:** Spec updates ride with the code PR; ADR additions ride with the decision PR.
5. **Portfolio/demo changes:** Follow [portfolio-documentation.md](portfolio-documentation.md) — never move glossary into README.

---

## Decision summary

- **CONTEXT.md:** glossary + boundaries only; update on vocabulary changes.
- **docs/spec/:** build canonical; wayfinder output stays; update on implementation gaps.
- **docs/adr/:** sparse; three-criteria gate; seed four ADRs at implementation kickoff; no bulk backfill.
- **Single context:** root `CONTEXT.md` only.
- **Conflict rule:** flag ADR contradictions explicitly; supersede rather than silently edit.
