# ADR-0002: Single monorepo with services/apps/infra split

**Status:** Accepted — 2026-07-14

## Context

Four deployable units (cart, checkout, inventory, storefront) plus Terraform and Helm need a home, and the repository doubles as a portfolio artifact someone will read end to end.

## Decision

One repository with role-based top-level directories: `services/` for HTTP backends, `apps/` for user-facing clients, `infra/` for everything that is not application code. Each project owns an independent package manifest and a colocated Dockerfile — there is no root workspace and no shared library package.

## Why

A polyrepo would mean six clones for a demo someone walks through in ten minutes, and cross-cutting changes would need coordinated PRs. The cost of the monorepo is that it needs path filters in CI to avoid rebuilding everything on a docs typo — a much cheaper problem. Independent manifests (rather than an npm workspace) keep each Docker build context equal to its source directory, so a service builds in isolation exactly as CI builds it. This decision shapes the path of every future PR, which is what earns it an ADR.

Directory tree, Helm layout, and per-project conventions: [repository-layout.md](../spec/repository-layout.md).
