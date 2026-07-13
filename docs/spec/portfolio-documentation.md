# Portfolio Documentation and Demo Script

Spec for wayfinder ticket [Design portfolio documentation and demo script](https://github.com/DNBLabs/chaos-monkey/issues/12).

**Question:** What portfolio documentation structure and recorded demo script turn the specs into a presentable walkthrough (README, architecture diagram links, step-by-step demo narrative)?

## Decision

Two-layer docs split: **root `README.md`** (30-second scan for recruiters) + **`docs/portfolio/demo-walkthrough.md`** (full reproducible demo with timestamps and talking points). Technical step tables stay in closed specs; walkthrough links to them. **AKS** is the primary recorded-demo path; **kind** is an appendix. Hero chaos experiment: **network latency**. Main observability beat: **Jaeger trace** from checkout `X-Request-Id`.

---

## File layout

```
/
├── README.md                              # Scan layer (create at implementation)
└── docs/
    ├── portfolio/
    │   ├── demo-walkthrough.md            # Full demo script (create at implementation)
    │   └── architecture.png               # Optional static export of README diagram
    └── spec/                              # Build-time specs (existing)
```

| File | Audience | Contents |
|------|----------|----------|
| `README.md` | Recruiter / first visit | One-liner, stack, Mermaid diagram, 3 resilience bullets, demo video link slot, specs index |
| `docs/portfolio/demo-walkthrough.md` | Engineer reproducing demo | AKS provision → timed UI script → Jaeger; kind appendix |
| `docs/portfolio/architecture.png` | External sharing (LinkedIn, resume) | Optional PNG export of README Mermaid — not required for repo correctness |

`docs/portfolio/` is presentation layer only — not duplicated in `docs/spec/`. Update [repository layout](repository-layout.md) `docs/` row when implementing.

---

## README.md — scan layer

No CI badges, no quick-start commands (walkthrough owns repro detail).

### Required sections (in order)

1. **Title + one-liner** — microservices e-commerce sandbox demonstrating checkout resilience under on-demand Chaos Mesh experiments on Kubernetes + Istio.
2. **Architecture** — Mermaid diagram aligned with [deployment topology](deployment-topology.md) (ingress → storefront + three services → Redis/Postgres; Chaos Mesh → inventory; observability in `istio-system`). Same diagram may be exported to `docs/portfolio/architecture.png` for off-GitHub sharing.
3. **Tech stack** — bullet list: TypeScript (cart, checkout), Python (inventory), React/Vite storefront, Postgres, Redis, kind/AKS, Istio, Chaos Mesh, Prometheus/Grafana/Jaeger, Terraform (`azurerm`), GitHub Actions.
4. **Resilience highlights** — exactly three bullets:
   - Istio retries/timeouts/circuit breaking on Checkout → Inventory mesh hop ([resilience spec](resilience.md))
   - Reserve-then-commit checkout with idempotency key and 5-minute reservation TTL ([CONTEXT.md](../../CONTEXT.md))
   - On-demand chaos experiments (pod kill, network latency, CPU stress) triggered from demo UI — manual only, not CI
5. **`## Demo video`** — placeholder link: `<!-- Paste Loom/YouTube URL after recording -->` or `[Watch the demo](#)` until recorded.
6. **`## Run the demo`** — single link to [demo-walkthrough.md](../portfolio/demo-walkthrough.md).
7. **`## Specifications`** — collapsed or short list linking every file in `docs/spec/*.md`.

### Explicit non-goals (README)

| Excluded | Why |
|----------|-----|
| CI status badges | Pipelines may not exist at first README commit; add later if desired |
| kind/AKS quick-start commands | Walkthrough owns commands |
| Full demo step table | Duplicates walkthrough |
| Domain glossary | Lives in `CONTEXT.md` |

---

## demo-walkthrough.md — full script

Portfolio layer on top of existing spec step tables:

- UI operator/shopper steps → [storefront-ui.md](storefront-ui.md#recommended-demo-script-operator--shopper)
- Per-experiment behavior → [chaos-experiments.md](chaos-experiments.md#per-experiment-demo-script-expected-ux)
- Network latency UX detail → [resilience spec](resilience.md) per-experiment table

Do **not** copy those tables inline — link and narrate.

### Part 1 — AKS demo environment (primary)

| Section | Source / action |
|---------|-----------------|
| Prerequisites | Azure subscription, `gh` + GitHub `demo` environment, OIDC configured per [CI/CD spec](cicd.md) |
| Provision | `workflow_dispatch` **provision-demo.yml** → Terraform apply + `platform-install.sh` |
| Deploy app | Merge to `main` triggers **cd.yml** (or manual re-run) — images to ACR, Helm to AKS |
| Ingress URL | AKS LoadBalancer on `istio-ingressgateway` — note URL in walkthrough header |
| Teardown | **destroy-demo.yml** when demo complete — stop Azure spend |

### Part 2 — Timed recording script (~8–10 min)

Hero experiment: **network latency** (`POST /demo/chaos/network-latency`). Pod kill and CPU stress listed as short **Also try** bullets at end — not in main recording.

| Time | Who | Action | Say (talking point) |
|------|-----|--------|---------------------|
| 0:00 | Narrator | Title card / README open | Portfolio sandbox: checkout survives inventory chaos on K8s + Istio |
| 0:30 | Narrator | Show architecture diagram (README Mermaid or PNG) | Three services, mesh between checkout and inventory, chaos targets inventory only |
| 1:00 | Operator | Open storefront URL; expand demo strip | Single-page demo UI — shopper path and operator controls |
| 1:30 | Operator | **Restock all** | Reset stock so repeated demos don't run dry |
| 2:00 | Operator | Start **network latency** experiment | Inject 400ms delay on inventory pods — chaos is on-demand, not background |
| 2:30 | Shopper | Add items to cart | Normal shopper flow — cart survives failed checkouts |
| 3:00 | Shopper | **Pay** — keep checkout modal visible | Watch stepper (`RESERVING` → `PAYMENT_PENDING` → `COMMITTING`) and elapsed time stretch |
| 4:00 | Both | Header chaos pill + modal elapsed counter | Checkout still completes — Istio retries and app poll backoff absorb transient inventory slowness |
| 5:00 | Operator | Copy **X-Request-Id** from modal → Jaeger (`istioctl dashboard jaeger` or port-forward) | Trace shows retry hops on Checkout → Inventory — proof behind the UI delay |
| 6:30 | Operator | Wait for auto-restore or **Stop chaos** | Experiments are time-bounded; mutex prevents overlap |
| 7:30 | Shopper | Optional: force failure during chaos, then **Try again** after clear | Cart kept on failure; new Pay gets new idempotency key |
| 8:30 | Narrator | Mention specs link + destroy workflow | Specs in repo; tear down AKS when done |

**Jaeger only** in the main script. Do not script Grafana/Prometheus into the recording — they blow the time budget.

### Part 3 — Also try (not recorded)

| Experiment | Highlight | Spec link |
|------------|-----------|-----------|
| Pod kill | K8s restart + mesh recovery | [chaos-experiments.md](chaos-experiments.md) |
| CPU stress | HPA scale-out; toggle **Show stock levels** to watch `reserved` | [storefront-ui.md](storefront-ui.md), [resilience.md](resilience.md) |

### Appendix A — kind local dev

Short path only — full pins and install order in [local-k8s-dev-stack research](../research/local-k8s-dev-stack.md):

1. WSL2 + Docker Desktop → `infra/scripts/` bootstrap (kind cluster, Istio, Chaos Mesh, metrics-server)
2. `helm upgrade` with `values-kind.yaml`
3. Same UI demo script as AKS — ingress via cloud-provider-kind LoadBalancer or port-forward

Label appendix clearly **Local development (optional)** so readers don't confuse it with the portfolio recording path.

### Appendix B — Optional observability depth

For viewers who want more after the Jaeger beat:

| Tool | Access | Use |
|------|--------|-----|
| Grafana | `istioctl dashboard grafana` or port-forward | Latency/error dashboards during chaos |
| Prometheus | port-forward | Raw metrics |
| Chaos Dashboard | `kubectl port-forward` — operator only | CR inspection; not in shopper demo path |

---

## Diagram maintenance

| Artifact | Canonical source | Export |
|----------|------------------|--------|
| README Mermaid | Aligned with [deployment-topology.md](deployment-topology.md) overview diagram | Edit README when topology spec changes |
| `architecture.png` | Manual or C4-tool export from same model | Optional; refresh when topology changes |

When topology spec updates, README Mermaid must update in the same PR. PNG is best-effort.

---

## Relationship to existing specs

| Spec | Keeps | Walkthrough uses |
|------|-------|------------------|
| [storefront-ui.md](storefront-ui.md) | 7-step operator+shopper table, polling intervals, UI regions | Links for step detail |
| [chaos-experiments.md](chaos-experiments.md) | CRD shapes, demo API, per-experiment UX table | Links for experiment parameters |
| [deployment-topology.md](deployment-topology.md) | Namespace/workload layout | Diagram source |
| [cicd.md](cicd.md) | Workflow names, provision/destroy triggers | AKS setup commands |
| [resilience.md](resilience.md) | Retry/timeout numbers | Talking points for network latency |

No edits required to closed spec tickets — walkthrough is additive.

---

## Implementation checklist

When building (post-wayfinder):

- [ ] Create `README.md` per sections above
- [ ] Create `docs/portfolio/demo-walkthrough.md` per timed script + appendices
- [ ] Optionally add `docs/portfolio/architecture.png`
- [ ] Record ~8–10 min Loom; paste URL into README `## Demo video`
- [ ] Update `docs/spec/repository-layout.md` `docs/` row to include `portfolio/`

---

## Decision summary

- **Two files:** `README.md` (scan) + `docs/portfolio/demo-walkthrough.md` (repro + recording script).
- **Diagram:** Mermaid in README; optional PNG export for external sharing.
- **Demo path:** AKS provision → UI script → Jaeger → destroy; kind appendix only.
- **Hero chaos:** network latency; other experiments as "Also try."
- **Format:** steps + talking points + timestamps (~8–10 min); Jaeger in main script only.
- **README:** no CI badges or quick-start; demo video link slot + specs index.
- **Canonical split:** specs keep technical tables; walkthrough links without duplicating.
