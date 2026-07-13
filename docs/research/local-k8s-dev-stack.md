# Local Kubernetes Dev Stack — Research Summary

Research for wayfinder ticket [Research local Kubernetes dev stack setup](https://github.com/DNBLabs/chaos-monkey/issues/4).

**Question:** Recommended local install path for kind + Istio + Chaos Mesh + Prometheus/Grafana/Jaeger on Windows, including pitfalls and version pins.

## Recommendation (short)

Run the stack from **WSL2 (Ubuntu) with Docker Desktop Linux containers**. Pin versions below. Install order: **kind → metrics-server → Istio (demo) → Istio addons → Chaos Mesh → label app namespace**. Use **cloud-provider-kind** for `LoadBalancer` services (Istio ingress gateway, demo UI). Access observability via `istioctl dashboard` or `kubectl port-forward`.

Native Windows PowerShell works for `kind`/`kubectl`, but WSL2 avoids most path/cgroup friction and matches Linux CI.

---

## Version pins (lock in spec)

| Component | Pin | Source |
|-----------|-----|--------|
| **kind** | `v0.32.0` | [kind quick start](https://kind.sigs.k8s.io/docs/user/quick-start/) — stable tagged release |
| **Kubernetes (kind node)** | `kindest/node:v1.36.1@sha256:3489c7674813ba5d8b1a9977baea8a6e553784dab7b84759d1014dbd78f7ebd5` | [kind v0.32.0 release](https://github.com/kubernetes-sigs/kind/releases/tag/v0.32.0) — default node image |
| **Istio** | `1.30.2` | [Istio latest release](https://github.com/istio/istio/releases/latest); supports K8s 1.32–1.36 per [supported releases](https://istio.io/latest/docs/releases/supported-releases/) |
| **Chaos Mesh** | chart/app `2.8.3` | [Chaos Mesh latest release](https://github.com/chaos-mesh/chaos-mesh/releases/latest) |
| **metrics-server** | `v0.8.0` (manifest) or latest Helm chart from [metrics-server repo](https://github.com/kubernetes-sigs/metrics-server) | Required for HPA; not bundled in kind |
| **cloud-provider-kind** | `@latest` binary or pinned release tag when scripting | [kind LoadBalancer guide](https://kind.sigs.k8s.io/docs/user/loadbalancer/) |
| **Helm** | v3.5+ | Required by Chaos Mesh; [Chaos Mesh Helm docs](https://chaos-mesh.org/docs/production-installation-using-helm/) |

**Compatibility note:** kind v0.32.0 defaults to Kubernetes 1.36.1, which is within Istio 1.30.x supported range. Do not downgrade K8s below 1.32 while on Istio 1.30.

---

## Windows install path

### Prerequisites

1. **Docker Desktop** — Linux containers mode (not Windows containers). Allocate **≥ 8 GB RAM** to Docker VM ([kind Docker Desktop settings](https://kind.sigs.k8s.io/docs/user/quick-start/#settings-for-docker-desktop)).
2. **WSL2** — Ubuntu distro recommended ([kind WSL2 doc](https://kind.sigs.k8s.io/docs/user/using-wsl2/)). Enable Docker Desktop WSL integration for that distro.
3. **CLI tools** (install inside WSL2):
   - `kubectl` (match or skew within K8s supported range)
   - `kind` v0.32.0
   - `helm` v3
   - `istioctl` 1.30.2 (bundled in Istio release tarball)

Windows-native `kind-windows-amd64.exe` (v0.32.0) exists via [kind releases](https://kind.sigs.k8s.io/dl/v0.32.0/kind-windows-amd64), but WSL2 is the lower-friction path for Helm scripts and socket paths.

### Install sequence

```bash
# 0. Download Istio 1.30.2 and add istioctl to PATH
curl -L https://istio.io/downloadIstio | ISTIO_VERSION=1.30.2 sh -
export PATH="$PWD/istio-1.30.2/bin:$PATH"

# 1. Create kind cluster (single control-plane; add workers later if needed for topology demos)
cat <<EOF > kind-chaos-monkey.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: chaos-monkey
nodes:
  - role: control-plane
EOF

kind create cluster --config kind-chaos-monkey.yaml --wait 5m

# 2. Start cloud-provider-kind (separate terminal; enables LoadBalancer Services)
go install sigs.k8s.io/cloud-provider-kind@latest
cloud-provider-kind

# 3. metrics-server (HPA prerequisite — not included in kind)
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm repo update
helm upgrade --install metrics-server metrics-server/metrics-server \
  --namespace kube-system \
  --set 'args={--kubelet-insecure-tls}'

# 4. Istio control plane (demo profile — local eval defaults)
istioctl install --set profile=demo -y

# 5. Observability addons (Prometheus, Grafana, Jaeger; Kiali optional)
kubectl apply -f istio-1.30.2/samples/addons

# 6. Chaos Mesh (kind uses containerd inside nodes — NOT host docker.sock default)
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm repo update
kubectl create namespace chaos-mesh
helm install chaos-mesh chaos-mesh/chaos-mesh \
  --namespace chaos-mesh \
  --version 2.8.3 \
  --set chaosDaemon.runtime=containerd \
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock \
  --set controllerManager.leaderElection.enabled=false

# 7. App namespace — enable sidecar injection
kubectl create namespace chaos-monkey
kubectl label namespace chaos-monkey istio-injection=enabled
```

### Access patterns (Windows / WSL2)

| Surface | Access |
|---------|--------|
| Grafana / Prometheus / Jaeger | `istioctl dashboard grafana` / `prometheus` / `jaeger` (opens browser via localhost) |
| Chaos Dashboard | `kubectl port-forward -n chaos-mesh svc/chaos-dashboard 2333:2333` |
| Istio ingress (storefront) | `LoadBalancer` external IP from cloud-provider-kind, or `kubectl get svc -n istio-system istio-ingressgateway` |
| Fallback | `kubectl port-forward` with `--address=0.0.0.0` from WSL2 ([kind WSL2 tips](https://kind.sigs.k8s.io/docs/user/using-wsl2/)) |

---

## Design choices for the spec

### Istio `demo` profile + `samples/addons`

- **`demo` profile** installs istiod, ingress gateway, egress gateway with reduced resources — appropriate for local sandbox ([istioctl install docs](https://istio.io/latest/docs/setup/install/istioctl/)).
- **Addons are separate:** Prometheus, Grafana, Jaeger (and Kiali) come from `samples/addons` in the Istio release tarball, not from the profile itself ([Istio getting started](https://istio.io/latest/docs/setup/additional-setup/getting-started-istio-apis/)).
- **Production AKS** should use `default` or custom profile — keep `demo` scoped to kind local dev only.

### LoadBalancer: cloud-provider-kind over static port maps

kind has no built-in LoadBalancer ([Istio kind setup](https://istio.io/latest/docs/setup/platform-setup/kind/)). Options:

1. **cloud-provider-kind** (recommended) — provisions LB containers; Istio ingress gateway works without hand-maintained port maps ([kind LoadBalancer guide](https://kind.sigs.k8s.io/docs/user/loadbalancer/)).
2. **extraPortMappings** in kind config — works but brittle when multiple services need host ports; good fallback if cloud-provider-kind unavailable.

### Chaos Mesh runtime on kind

kind nodes run **containerd**. Helm defaults assume Docker (`/var/run/docker.sock`) — wrong for kind. Must set:

```yaml
chaosDaemon.runtime: containerd
chaosDaemon.socketPath: /run/containerd/containerd.sock
```

([Chaos Mesh values.yaml comment](https://github.com/chaos-mesh/chaos-mesh/blob/master/helm/chaos-mesh/values.yaml))

Disable leader election on single-node local clusters to avoid unnecessary controller replicas ([Chaos Mesh Helm FAQ](https://chaos-mesh.org/docs/production-installation-using-helm/)).

### metrics-server

kind does not ship metrics-server ([kind issue #398](https://github.com/kubernetes-sigs/kind/issues/398)). Required for **HPA on inventory** (standing preference from map). Install with `--kubelet-insecure-tls` because kind uses self-signed kubelet certs.

### Local image workflow

Use `kind load docker-image <image:tag>` after `docker build`; set `imagePullPolicy: IfNotPresent` and **avoid `:latest` tags** ([kind image loading docs](https://kind.sigs.k8s.io/docs/user/quick-start/#loading-an-image-into-your-cluster)).

---

## Known pitfalls (Windows)

| Pitfall | Impact | Mitigation |
|---------|--------|------------|
| **Windows containers mode** | kind cannot run | Switch Docker Desktop to Linux containers ([kind known issues](https://kind.sigs.k8s.io/docs/user/known-issues/#windows-containers)) |
| **Docker Desktop VM networking** | Node IPs not reachable from Windows host | Use `extraPortMappings`, cloud-provider-kind LB IPs, or `kubectl port-forward` ([known issues](https://kind.sigs.k8s.io/docs/user/known-issues/#docker-desktop-for-macos-and-windows)) |
| **WSL2 cgroup misconfig** | Cluster create fails (`error adding pid to cgroups`) | Follow [wsl-cgroupsv2 workaround](https://github.com/spurin/wsl-cgroupsv2) ([kind known issues](https://kind.sigs.k8s.io/docs/user/known-issues/#failure-to-create-cluster-on-wsl2)) |
| **WSL2 missing `xt_recent`** | `sessionAffinity: ClientIP` breaks kube-proxy | Avoid ClientIP session affinity locally, or build custom WSL2 kernel ([kind WSL2 doc](https://kind.sigs.k8s.io/docs/user/using-wsl2/)) |
| **Insufficient Docker RAM** | OOM during Istio + observability + Chaos Mesh | ≥ 8 GB to Docker Desktop; close unused stacks |
| **Chaos Mesh wrong runtime** | chaos-daemon CrashLoop | Use containerd socket path (see above) |
| **Istio + Chaos Mesh overlap** | Confusion about fault injection layer | Istio = L7 (retries, timeouts, VirtualService faults); Chaos Mesh = infra (pod kill, CPU, network) — complementary ([Chaos Mesh + Istio pattern](https://oneuptime.com/blog/post/2026-02-24-how-to-combine-istio-with-chaos-mesh-for-testing/view)) |
| **Helm upgrade CRD drift** | Chaos Mesh upgrade failures | Apply CRDs manually on upgrade ([Chaos Mesh Helm docs warning](https://chaos-mesh.org/docs/production-installation-using-helm/)) |
| **kind v0.32+ node image digest** | `kind load` incompatibility across kind versions | Always pin `@sha256` node image matching kind release ([v0.32.0 release notes](https://github.com/kubernetes-sigs/kind/releases/tag/v0.32.0)) |

---

## Resource budget (local)

Rough minimum for full stack on one control-plane node:

- Docker Desktop RAM: **8 GB** (10 GB comfortable)
- CPU: 4 cores allocated to Docker
- Disk: ~10 GB for images (Istio, Chaos Mesh, observability, app images)

If constrained, defer Kiali addon and reduce Istio demo profile components further via `IstioOperator` overrides.

---

## What to carry into downstream tickets

| Ticket area | Carry forward |
|-------------|---------------|
| **Design deployment topology** | kind single-node local; AKS ephemeral for demo; cloud-provider-kind for LB |
| **Define Chaos Mesh experiments** | chaos-daemon containerd config; dashboard port-forward or ingress |
| **Specify resilience layers** | metrics-server before HPA validation locally |
| **Design demo storefront UI** | Istio ingress gateway via LoadBalancer; namespace `chaos-monkey` with injection enabled |
| **CI/CD** | kind + pinned versions scriptable; same cluster config reproducible in GitHub Actions |

---

## Sources

- [kind quick start](https://kind.sigs.k8s.io/docs/user/quick-start/)
- [kind WSL2](https://kind.sigs.k8s.io/docs/user/using-wsl2/)
- [kind known issues](https://kind.sigs.k8s.io/docs/user/known-issues/)
- [kind LoadBalancer / cloud-provider-kind](https://kind.sigs.k8s.io/docs/user/loadbalancer/)
- [Istio kind platform setup](https://istio.io/latest/docs/setup/platform-setup/kind/)
- [Istio istioctl install](https://istio.io/latest/docs/setup/install/istioctl/)
- [Istio supported releases](https://istio.io/latest/docs/releases/supported-releases/)
- [Istio getting started (addons)](https://istio.io/latest/docs/setup/additional-setup/getting-started-istio-apis/)
- [Chaos Mesh Helm install](https://chaos-mesh.org/docs/production-installation-using-helm/)
- [Chaos Mesh v2.8.3 release](https://github.com/chaos-mesh/chaos-mesh/releases/tag/v2.8.3)
- [kind v0.32.0 release](https://github.com/kubernetes-sigs/kind/releases/tag/v0.32.0)
- [Istio v1.30.2 release](https://github.com/istio/istio/releases/tag/1.30.2)
