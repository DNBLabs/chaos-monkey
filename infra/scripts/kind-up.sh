#!/usr/bin/env bash
# Create the local kind cluster and the LoadBalancer provider that gives
# istio-ingressgateway a real external IP.
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-chaos-monkey}"
NODE_IMAGE="${NODE_IMAGE:-kindest/node:v1.36.1}"
CLUSTER_CONFIG="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/kind-cluster.yaml"

if kind get clusters | grep -qx "${CLUSTER_NAME}"; then
  echo "kind cluster '${CLUSTER_NAME}' already exists — skipping create"
else
  kind create cluster --name "${CLUSTER_NAME}" --image "${NODE_IMAGE}" --config "${CLUSTER_CONFIG}"
fi

kubectl create namespace chaos-monkey --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace chaos-monkey istio-injection=enabled --overwrite

cat <<'EOF'

kind cluster ready.

cloud-provider-kind must run in a separate terminal for LoadBalancer IPs:
  docker run -d --rm --network kind \
    -v /var/run/docker.sock:/var/run/docker.sock \
    registry.k8s.io/cloud-provider-kind/cloud-controller-manager:v0.7.0

Next: infra/scripts/platform-install.sh
EOF
