# TRPG BOOTH Search — Fixture Archive

A Japanese TRPG scenario discovery interface built with Next.js. The current application is a **read-only preview using synthetic fixtures only**.

## Current boundary

This Repository does not operate a live BOOTH search service.

- live BOOTH collection remains disabled after the bounded pilot correctly stopped on a challenge/login signal;
- all visible records and product links are synthetic fixtures under `example.invalid`;
- no purchase, payment, download, affiliate, advertising, account, authentication, analytics, or user tracking flow exists;
- no hosted database, Supabase project, production data, or live collector is connected;
- the preview requires no environment variables and no Secrets;
- crawler indexing and archiving are disabled for every route.

The public search and publication rules remain fail-closed. Held, age-uncertain, conflicted, unapproved-AI, sales-ended, and otherwise ineligible fixture records are excluded before rendering.

## Local requirements

- Node.js 24
- npm from the pinned Node toolchain
- Chromium only when running Playwright E2E tests

## Local use

```bash
npm ci
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`.

Quality gates:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
python scripts/public_export_guard.py .
python scripts/validate_repository.py
python -m unittest discover -s tests
```

## Preview deployment

Repository readiness is documented in [`docs/PREVIEW_DEPLOYMENT.md`](docs/PREVIEW_DEPLOYMENT.md).

Deployment remains a human checkpoint. Do not connect a hosting account or deploy until the owner selects the account, visibility, and eligible plan. Vercel Hobby may be considered only for strictly personal/non-commercial use under the current Vercel terms. Commercial use requires an eligible paid plan and a separate approval; automatic upgrades and paid add-ons are prohibited.

The preview uses no environment variables. Never paste credentials, access tokens, private URLs, passwords, service-role keys, or connection strings into chat, Issues, Pull Requests, logs, or committed files.

After a public, unauthenticated root HTTPS preview URL exists, run the manual GitHub Actions workflow **Fixture Preview Smoke** with that URL. It validates crawler exclusion, security headers, fixture-only content, `/robots.txt`, `/healthz`, mobile overflow, and runtime request boundaries. It does not deploy or change provider settings.

## Rollback

Code rollback uses a normal Git revert or bounded fix-forward; shared history is never rewritten. Deployment rollback is performed in the selected provider UI by disabling or deleting the preview project or disconnecting Git. A hosting rollback must not re-enable live BOOTH access, production data, Secrets, analytics, or billing.

## Source of truth

- [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md)
- [`docs/DECISIONS.md`](docs/DECISIONS.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/DATA_COLLECTION_POLICY.md`](docs/DATA_COLLECTION_POLICY.md)
- [`docs/LEGAL_AND_COMPLIANCE.md`](docs/LEGAL_AND_COMPLIANCE.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/UI_DESIGN_SYSTEM.md`](docs/UI_DESIGN_SYSTEM.md)
- [`docs/PREVIEW_DEPLOYMENT.md`](docs/PREVIEW_DEPLOYMENT.md)
