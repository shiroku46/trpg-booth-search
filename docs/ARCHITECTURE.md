# Architecture

> **Status**: This document describes architectural intent and provisional technology candidates. No application code, database, deployment, authentication, or billing setup has occurred. Technology choices are **not confirmed** — each requires a dedicated Architecture Decision Issue. See [DECISIONS.md](DECISIONS.md) for accepted and pending decisions, and [ROADMAP.md](ROADMAP.md) for the planned delivery sequence.

---

## Isolation

This application is fully isolated from `shiroku46/luluportal`. No shared code, database, authentication, environment variables, deployment, or configuration exists between the two projects. See [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) and [DECISIONS.md — D-007](DECISIONS.md#d-007----isolation-from-shiroku46luluportal).

---

## Domain boundaries

The major domain boundaries at an architectural level are:

### Product / Scenario separation

The two-layer BOOTH-product / individual-scenario model (confirmed in [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md)) implies a clear domain boundary:

- **Product domain**: BOOTH product records, sales state, BOOTH URL, content version, collection metadata.
- **Scenario domain**: Individual scenario records linked to a parent product, scenario-level structured fields (player count, play time, GM requirement, tags, etc.).

These boundaries inform future schema design. No schema or code is created in this Issue.

### Data collection boundary

Data collection (low-load discovery, extraction, AI-assisted tagging) is a separate concern from the search and display application. These may be implemented as separate processes or services. See [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md).

### Search and display boundary

The user-facing application (search, filters, sorting, navigation to BOOTH) is isolated from the collection pipeline. The application reads from the database; it does not perform live BOOTH requests at query time.

---

## Provisional technology candidates

The following technologies are **provisional candidates only**. None are confirmed. Current pricing, free tier limits, licenses, and terms must be evaluated in a dedicated Architecture Decision Issue before adoption.

| Candidate | Role | Status |
|---|---|---|
| Next.js | Frontend framework and server-side rendering | Provisional |
| TypeScript | Primary language | Provisional |
| Vercel | Hosting and deployment platform | Provisional |
| PostgreSQL | Relational database | Provisional |
| Supabase | Managed PostgreSQL and API layer | Provisional |
| GitHub Actions | CI/CD and scheduled collection jobs | Provisional |

### What must be verified before any candidate is adopted

- Current pricing and free tier limits for each service (as of the Architecture Decision Issue date).
- Free tier overage behaviour: what happens automatically when limits are exceeded.
- License compatibility.
- Current terms of service for data storage and API access.

---

## Cost constraints

- **Target monthly cost**: JPY 0–1,000.
- **No automatic paid-plan transition**: no service may be configured to automatically escalate to a paid tier based on usage.
- **Human approval required**: any spend exceeding JPY 1,000/month requires explicit human approval before the configuration that would cause it is merged.
- **Measurable costs**: AI API cost, database storage and query cost, and GitHub Actions usage time must each be independently measurable and monitorable.

---

## What is not created in this Issue

The following do not exist yet. No work on these items is authorized until the relevant roadmap stage:

- Database schema, migrations, or database instances.
- Deployment configuration or hosting setup.
- Authentication or session management.
- Billing configuration.
- Application code of any kind.
- CI/CD pipelines beyond those already present in the repository.

---

## Cross-references

- Confirmed product and scenario requirements: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md)
- Data collection rules and metadata: [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md)
- Legal constraints and BOOTH terms status: [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md)
- Pending technology decisions: [DECISIONS.md — PD-002, PD-005, PD-006](DECISIONS.md#pd-002----technology-stack-selection)
- Roadmap stage for Architecture Decision: [ROADMAP.md](ROADMAP.md)
