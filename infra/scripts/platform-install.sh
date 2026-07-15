#!/usr/bin/env bash
# Install the platform layer: metrics-server, Istio, Chaos Mesh.
# Deliberately NOT part of the app Helm chart — platform and app upgrade independently.
# Versions are pinned so local and CI install the same stack.
set -euo pipefail

METRICS_SERVER_VERSION="${METRICS_SERVER_VERSION:-3.12.2}"
ISTIO_VERSION="${ISTIO_VERSION:-1.24.2}"
CHAOS_MESH_VERSION="${CHAOS_MESH_VERSION:-2.7.0}"
ISTIO_PROFILE="${ISTIO_PROFILE:-demo}"   # 'demo' on kind, 'default' on AKS

echo "==> metrics-server (HPA prerequisite)"
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ >/dev/null
helm upgrade --install metrics-server metrics-server/metrics-server \
  --version "${METRICS_SERVER_VERSION}" \
  -n kube-system \
  --set 'args={--kubelet-insecure-tls}'

echo "==> Istio (${ISTIO_PROFILE} profile)"
istioctl install --set profile="${ISTIO_PROFILE}" -y

echo "==> Istio observability addons (Prometheus, Grafana, Jaeger)"
kubectl apply -f "https://raw.githubusercontent.com/istio/istio/release-${ISTIO_VERSION%.*}/samples/addons/prometheus.yaml"
kubectl apply -f "https://raw.githubusercontent.com/istio/istio/release-${ISTIO_VERSION%.*}/samples/addons/grafana.yaml"
kubectl apply -f "https://raw.githubusercontent.com/istio/istio/release-${ISTIO_VERSION%.*}/samples/addons/jaeger.yaml"

echo "==> Chaos Mesh"
helm repo add chaos-mesh https://charts.chaos-mesh.org >/dev/null
kubectl create namespace chaos-mesh --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install chaos-mesh chaos-mesh/chaos-mesh \
  --version "${CHAOS_MESH_VERSION}" \
  -n chaos-mesh \
  --set chaosDaemon.runtime=containerd \
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock

echo "Platform ready. Next: infra/scripts/deploy-app.sh"
