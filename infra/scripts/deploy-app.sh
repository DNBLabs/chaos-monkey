#!/usr/bin/env bash
# Deploy the app workloads. Same script for local kind and CI/AKS — only the values
# file differs. CI and local dev must never have divergent install paths.
#
#   ./infra/scripts/deploy-app.sh kind
#   ./infra/scripts/deploy-app.sh aks
set -euo pipefail

ENVIRONMENT="${1:-kind}"
CHART_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../k8s/chaos-monkey" && pwd)"
VALUES_FILE="${CHART_DIR}/values-${ENVIRONMENT}.yaml"

if [[ ! -f "${VALUES_FILE}" ]]; then
  echo "unknown environment '${ENVIRONMENT}' — expected 'kind' or 'aks'" >&2
  exit 1
fi

if [[ "${ENVIRONMENT}" == "kind" ]]; then
  echo "==> side-loading local images into kind"
  for image in cart-service checkout-service inventory-service storefront; do
    kind load docker-image "${image}:local" --name "${CLUSTER_NAME:-chaos-monkey}"
  done
fi

helm upgrade --install chaos-monkey "${CHART_DIR}" \
  -n chaos-monkey --create-namespace \
  -f "${CHART_DIR}/values.yaml" \
  -f "${VALUES_FILE}" \
  "${@:2}"

kubectl rollout status deployment/storefront -n chaos-monkey --timeout=120s
echo "Deployed to '${ENVIRONMENT}'."
