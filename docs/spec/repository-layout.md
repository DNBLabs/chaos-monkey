# Repository Layout

Spec for wayfinder ticket [Choose repository layout](https://github.com/DNBLabs/chaos-monkey/issues/11).

**Question:** Monorepo or polyrepo for cart, checkout, inventory, storefront, and infra (Terraform, Helm/k8s manifests)?

## Decision

**Single monorepo** with role-based top-level directories. One clone for local dev and portfolio demo; one CI pipeline builds all images and deploys from `infra/`.

---

## Directory tree

```
/
├── services/
│   ├── cart-service/          # TypeScript — Redis session cart
│   ├── checkout-service/      # TypeScript — stateless orchestration
│   └── inventory-service/     # Python — Postgres, chaos demo API
├── apps/
│   └── storefront/            # React/Vite — demo UI
├── infra/
│   ├── terraform/             # AKS ephemeral cluster (azurerm)
│   ├── k8s/
│   │   └── chaos-monkey/      # App Helm chart (see below)
│   └── scripts/               # Bootstrap and deploy wrappers
├── docs/
│   ├── spec/
│   ├── research/
│   └── adr/
├── CONTEXT.md
└── AGENTS.md
```

| Directory | Role | Contents |
|-----------|------|----------|
| `services/` | HTTP backends | Source, tests, `Dockerfile`, language-specific package manifest per service |
| `apps/` | User-facing clients | Storefront SPA; room for future demo tools without mixing with APIs |
| `infra/` | Everything not app code | Terraform, Helm chart, bootstrap scripts |
| `docs/` | Specs and ADRs | Existing wayfinder artifacts; not duplicated in service READMEs |

No `packages/` shared library — API contracts live in [api-contracts.md](api-contracts.md); each project owns its types.

---

## Per-project conventions

### TypeScript services (`cart-service`, `checkout-service`)

- Independent `package.json` — **no** root npm/pnpm workspace
- Colocated `Dockerfile`; build context = service directory
- Listen on port **8080** per [deployment topology](deployment-topology.md)

### Python service (`inventory-service`)

- `pyproject.toml` (or equivalent) at service root
- Colocated `Dockerfile`
- Chaos Mesh CRD templates **embedded in service** per [chaos-experiments spec](chaos-experiments.md) — not in `infra/k8s/`

### Storefront (`apps/storefront`)

- Independent `package.json` + Vite config
- Colocated `Dockerfile` (nginx-served static build)
- No shared TS package with backends

---

## Kubernetes packaging (`infra/k8s/chaos-monkey/`)

Single Helm chart for the `chaos-monkey` namespace workloads only:

```
infra/k8s/chaos-monkey/
├── Chart.yaml
├── values.yaml              # shared defaults
├── values-kind.yaml         # local kind overrides
├── values-aks.yaml          # ephemeral AKS demo overrides
└── templates/
    ├── deployments.yaml
    ├── services.yaml
    ├── statefulset-postgres.yaml
    ├── hpa-inventory.yaml
    ├── virtualservices.yaml
    └── ...
```

| Values file | Use |
|-------------|-----|
| `values.yaml` | Replica defaults, image name pattern, resource requests |
| `values-kind.yaml` | Local image tags (`:local`), kind ingress host, single-node tuning |
| `values-aks.yaml` | ACR/registry image tags, AKS ingress host, demo cluster sizing |

**Deploy:**

```bash
helm upgrade --install chaos-monkey infra/k8s/chaos-monkey \
  -n chaos-monkey --create-namespace \
  -f infra/k8s/chaos-monkey/values.yaml \
  -f infra/k8s/chaos-monkey/values-kind.yaml   # or values-aks.yaml
```

**Not in this chart:** Istio control plane, Chaos Mesh, metrics-server — installed by platform bootstrap per [local-k8s-dev-stack research](../research/local-k8s-dev-stack.md).

Chart contents align with [deployment topology](deployment-topology.md): cart, checkout, inventory (+ HPA), storefront, redis, postgres, Istio `VirtualService` / `Gateway` bindings for path-based ingress.

---

## Terraform (`infra/terraform/`)

AKS ephemeral cluster per [issue #3 resolution](https://github.com/DNBLabs/chaos-monkey/issues/3). Separate from Helm — `terraform apply` provisions cluster; `helm` deploys workloads onto it.

---

## Bootstrap scripts (`infra/scripts/`)

Runnable wrappers for the research doc install path:

| Script | Purpose |
|--------|---------|
| `kind-up.sh` | Create kind cluster + cloud-provider-kind LoadBalancer |
| `platform-install.sh` | metrics-server, Istio, Chaos Mesh (pinned versions) |
| `deploy-app.sh` | `helm upgrade --install` with env-appropriate values file |

CI (#10) and local dev call the same scripts — no divergent install paths.

---

## CI implications (for downstream ticket)

- Build matrix: four `docker build` targets from `services/*` and `apps/storefront`
- No workspace install step — each TS project `npm ci` in its own directory
- Deploy stage: `infra/scripts/deploy-app.sh` or equivalent with `values-aks.yaml`
- Image naming convention TBD in CI ticket; chart `values` accept full image refs

---

## Rationale summary

| Choice | Why |
|--------|-----|
| Monorepo | Single clone for portfolio walkthrough; atomic cross-service changes |
| `services/` / `apps/` / `infra/` | Mirrors deployment topology mental model; clean root |
| Independent package.json | Three small TS trees; no shared runtime lib; Python stays separate |
| Single app Helm chart | kind vs AKS via values files; one deploy command |
| Colocated Dockerfiles | CI path = source path; standard microservice layout |
| `infra/scripts/` | Bootstrap tooling co-located with Terraform and Helm |
