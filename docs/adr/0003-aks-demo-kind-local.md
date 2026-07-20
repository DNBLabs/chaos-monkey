# ADR-0003: Ephemeral AKS for the demo, kind for local development

**Status:** Accepted — 2026-07-14 · Refined by [ADR-0005](0005-catalog-static-seed-interim.md) (Catalog seed served from a static file until Inventory gains a datastore)

## Context

The chaos demo needs a real multi-node Kubernetes cluster with a working LoadBalancer and HPA to be credible, but a permanently running managed cluster costs money every hour for a portfolio piece that is watched occasionally.

## Decision

Two environments, one deployment path. Local development runs on a **multi-node kind cluster** (one control-plane, two workers — `infra/scripts/kind-cluster.yaml`), provisioned by `infra/scripts/kind-up.sh`. The portfolio demo runs on an **ephemeral AKS cluster** created by Terraform before a demo and destroyed after. The same Helm chart deploys to both; only the values file changes.

## Why

kind is multi-node when it is given a node list, so **pod-kill chaos is topology-faithful locally**: with inventory at `minReplicas: 2` the scheduler spreads replicas across workers, and killing one exercises real cross-node rescheduling. Local development therefore needs no cloud at all, and the day-to-day loop costs nothing. (An earlier draft of this ADR justified AKS on the claim that kind is single-node. That is false, and the claim is not load-bearing for the decision — the honest case for AKS is below.)

AKS is kept for the demo because there are four things kind cannot fake, and all four are part of the story being told:

1. **A real cloud LoadBalancer** with a real public IP, rather than `cloud-provider-kind` synthesising one through the Docker socket.
2. **Real managed-disk CSI** (`managed-csi`) — network-attached storage that survives a node dying, rather than a directory on the developer's laptop. Postgres holds Stock and the Catalog seed ([ADR-0001](0001-reserve-then-commit-checkout.md)), so this is the difference between demonstrating durability and asserting it.
3. **A cluster autoscaler.** The HPA can only add pods; once a kind node is full, it is full. On AKS the cluster itself grows underneath the HPA — the second half of the autoscaling story, which kind physically cannot show.
4. **True node-level failure.** Chaos Mesh can kill a kind "node", but it is a container on a single host; the machine underneath never goes away. On AKS a node drain or VM kill is real.

An always-on managed cluster would buy the same fidelity and bill continuously for a portfolio piece watched occasionally. The ephemeral split pays only for the demo window. The costs are accepted and real: Terraform targets `azurerm` specifically (cloud lock-in), and the local/demo divide is non-obvious to a newcomer — hence this record.

**When this flips:** if the demo were ever driven from a recording rather than live, multi-node kind alone would carry the resilience story and the Azure limb could be deleted outright.

Environment matrix, node sizing, and install order: [deployment-topology.md](../spec/deployment-topology.md).
