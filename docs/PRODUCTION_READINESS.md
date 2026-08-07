# Production readiness gate

## Purpose

Production readiness is an internal fail-closed safety report. It is not a deployment button, network authorization, provider selector, or substitute for owner approval. The report exists so repository code and operators cannot infer production readiness from a successful build, a preview deployment, a robots/Terms review, or local persistence alone.

## Required gates

Exactly five gates are required:

1. `collection_access` — an explicitly approved, operationally accessible collection mechanism. A policy/robots approval alone is insufficient after an observed access challenge.
2. `production_data` — verified non-fixture production data that has passed the project’s age/classification/review boundaries.
3. `hosted_database` — a separately approved and provisioned production persistence target.
4. `backup_restore` — a tested production recovery mechanism satisfying D-031 / PD-010, including the purge-safety requirement.
5. `production_deployment` — a separately authorized production application deployment serving production data under the approved operational/cost boundary.

Each gate is exactly `ready`, `blocked`, or `not_evaluated`. Readiness is true only when all five gates are explicitly `ready`. Missing, duplicate, unknown, malformed, blocked, or not-evaluated gates fail closed.

## Evidence references

Gate evidence is deliberately metadata-only. References are short typed identifiers such as `github-run:31177408337` or `decision:PD-010`; arbitrary URLs, query strings, credentials, email-like values, whitespace payloads, descriptions, Secrets, and source content are rejected.

A ready gate additionally requires a gate-specific evidence prefix:

- collection: `collection-mechanism:`
- production data: `production-data:`
- hosted database: `database:`
- backup/restore: `recovery:`
- production deployment: `deployment:`

This means the previously reviewed BOOTH policy digest cannot by itself mark collection access ready. A later collection mechanism must cross its own explicit authorization/evidence boundary.

## Current repository checkpoint

`CURRENT_PRODUCTION_READINESS` is intentionally not ready:

- collection access is blocked by owner-authorized BOOTH run `31177408337`, which stopped on the stable CAPTCHA challenge marker;
- the public application is still synthetic-fixture-only;
- no hosted production database has been provisioned;
- PD-010 backup/restore remains unresolved;
- the current deployment configuration is not authorization to serve production data.

This checkpoint is a code-level statement of current blockers, not permission to resolve them automatically. Network collection, hosted database provisioning, backup storage, paid capability, and production deployment remain separate reviewed actions.

## Stage 35 local recovery rehearsal evidence

The repository can now produce a deterministic metadata-only `RecoveryRehearsalReport` from a synthetic local PGlite dump/restore exercise before and after the restricted `hold_age_unknown` purge. A passing rehearsal proves that the current local schema/tooling can restore synthetic permitted data, preserve an unaffected product, retain the purge tombstone, and keep synthetic purged titles/hashes absent from the post-purge dump/restore path.

This report does **not** make `backup_restore` ready. PD-010/D-031 still require a separately selected production recovery mechanism with approved storage, retention, encryption/access controls, cost, and a successful non-production restore in that chosen environment. `CURRENT_PRODUCTION_READINESS` therefore remains unchanged and fail-closed.

