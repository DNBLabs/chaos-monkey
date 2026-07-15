# ADR-0003: Ephemeral AKS for the demo, kind for local development

**Status:** Accepted — 2026-07-14

## Context

The chaos demo needs a real multi-node Kubernetes cluster with a working LoadBalancer and HPA to be credible, but a permanently running managed cluster costs money every hour for a portfolio piece that is watched occasionally.

## Decision

Two environments, one deployment path. Local development runs on **kind**, provisioned by `infra/scripts/kind-up.sh`. The portfolio demo runs on an **ephemeral AKS cluster** created by Terraform before a demo and destroyed after. The same Helm chart deploys to both; only the values file changes.

## Why

kind alone is not enough — it is single-node, so pod-kill chaos with `minReplicas: 2` reschedules onto the same node and the resilience story is not topology-faithful. An always-on AKS cluster is the honest fidelity answer but bills continuously. The ephemeral split takes the fidelity where it matters and pays only for the demo window. The lock-in is real: Terraform targets `azurerm` specifically, and the local/demo divide is non-obvious to a newcomer — hence this record.

Environment matrix, node sizing, and install order: [deployment-topology.md](../spec/deployment-topology.md).
