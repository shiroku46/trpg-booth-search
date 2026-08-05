# Fixture-only preview deployment

## Status and purpose

This runbook covers a temporary preview of the current application using **synthetic fixtures only**. It is not a production BOOTH search service.

Binding boundaries:

- live BOOTH collection remains disabled;
- product links use `example.invalid` synthetic boundaries;
- no hosted database or production data;
- no purchase, payment, download, authentication, account, analytics, ads, affiliate integration, or tracking;
- no environment variables and no Secrets;
- no search-engine indexing or archiving;
- no automatic paid-plan transition.

Repository preparation does not itself create a hosting project or deployment. Connect a provider only after Issue #92 is merged, and deploy the resulting reviewed `main` commit rather than an intermediate Pull Request branch.

## Verified application contract

A valid preview must expose:

- `/` — the fixture-only search interface;
- `/robots.txt` — `User-Agent: *` and `Disallow: /`;
- `/healthz` — static JSON containing only:

```json
{
  "service": "trpg-booth-search-preview",
  "status": "ok",
  "dataMode": "synthetic-fixtures-only",
  "liveCollection": false,
  "hostedDatabase": false
}
```

Every route must return the reviewed no-index and response-security headers. `/healthz` must also include `Cache-Control: no-store`.

## Plan and eligibility checkpoint

The owner must decide the provider, account, visibility, and plan before connecting the Repository.

### Vercel candidate

Vercel is the lowest-friction candidate for the existing Next.js application, but this Repository does not select it automatically.

Current official references, reviewed 2026-08-05:

- Vercel Terms of Service, last updated 2026-06-01: <https://vercel.com/legal/terms>
- Hobby plan: <https://vercel.com/docs/plans/hobby>
- Fair-use guidance: <https://vercel.com/docs/limits/fair-use-guidelines>
- Git deployment behavior: <https://vercel.com/docs/git>
- Deployment Protection: <https://vercel.com/docs/deployment-protection>

The Hobby plan is limited to personal/non-commercial use. Confirm that the fixture preview has no financial-gain purpose before using Hobby. Any commercial purpose requires an eligible paid plan and a separate owner-authorized Issue. Do not enable a trial, paid add-on, Pro plan, custom domain purchase, or automatic upgrade without that approval.

Vercel Git integration creates deployments from connected branches and normally treats `main` as the production branch. A public generated URL is not made private by this application’s `noindex` rules: `noindex` is crawler guidance, not access control.

Vercel Authentication with Standard Protection can protect preview/deployment URLs on Hobby, but current Vercel documentation states that the production domain remains public. If private access from the first deployment is mandatory, stop and select/configure a provider and plan that guarantees the required protection before connecting Git. Do not add application authentication as an unreviewed workaround.

## Human connection procedure

Perform only after the repository candidate for Issue #92 is merged and the owner confirms the provider and plan.

1. Sign in to the selected hosting provider using the owner-controlled account.
2. Create/import a project from **only** `shiroku46/trpg-booth-search`.
3. Confirm the framework is Next.js and the repository root is `/`.
4. Keep build/install commands at provider defaults unless the provider displays a concrete incompatibility.
5. Add no environment variables, database URL, token, key, password, analytics integration, or storage service.
6. Do not enable billing, a trial, a paid add-on, or a custom domain.
7. Choose one visibility mode:
   - public, link-accessible, non-indexed fixture preview; or
   - provider-authenticated preview, only where the provider protects the chosen URL before sharing.
8. Deploy only the reviewed `main` SHA recorded after Issue #92 merges.
9. Copy only the root HTTPS preview URL. Never paste credentials or protected share tokens.

## Post-deploy verification

The automated remote smoke test supports a public, unauthenticated root HTTPS origin without credentials, path, query, fragment, IP literal, local hostname, or non-standard port.

In GitHub:

1. Open **Actions**.
2. Open **Fixture Preview Smoke**.
3. Select **Run workflow** on `main`.
4. Enter the root preview URL, such as `https://project.example-host.app/`.
5. Run once.

The workflow is read-only. It checks:

- HTTPS root-origin validation;
- page availability and five default synthetic results;
- fixture-only and BOOTH-disabled wording;
- noindex metadata and `X-Robots-Tag`;
- response-security headers;
- `/robots.txt` crawler exclusion;
- `/healthz` exact non-sensitive body and `no-store` behavior;
- no unexpected runtime origin;
- synthetic `example.invalid` product-link boundary;
- 390 px horizontal-overflow protection.

It never deploys, promotes, changes provider settings, reads Secrets, or updates visual baselines. Failure artifacts are retained for three days and contain only Playwright diagnostics from the synthetic fixture preview.

A provider-authenticated preview cannot be validated by this no-Secret workflow if the provider presents a login screen. In that case, verify the same routes and headers manually while authenticated, or create a later separately authorized protected-smoke design. Never weaken access protection or place an authentication token in the URL to make the workflow pass.

## Manual verification checklist

- The page visibly says it uses synthetic fixtures and is not BOOTH live data.
- Default search shows five records.
- Search, filtering, reset, mobile layout, keyboard focus, and reduced motion behave as in local E2E tests.
- Product links remain under `https://example.invalid/`.
- `/robots.txt` disallows `/`.
- `/healthz` matches the exact static payload above.
- Response headers include `X-Robots-Tag`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, and the reviewed `Permissions-Policy`.
- Provider logs show no unexpected error and no request to BOOTH, Supabase, analytics, font, image, or asset hosts.

## Credentials and data handling

The preview requires no environment variables. Never paste credentials, provider access tokens, passwords, service-role keys, database connection strings, protected share links containing tokens, or private provider metadata into chat, Issues, Pull Requests, comments, logs, screenshots, or committed files.

Do not add production data to fixtures or screenshots. Do not change `example.invalid` product links to live BOOTH links as part of deployment.

## Rollback

### Immediate hosting rollback

Use the provider UI to disable/delete the preview project or disconnect Git. Confirm that the preview URL no longer serves the application. Remove any provider-granted Repository access that is no longer needed.

### Code rollback

Use a normal Git revert of the reviewed merge or a bounded fix-forward PR. Never force-push or rewrite shared history.

### Incident boundary

If the preview unexpectedly exposes live data, credentials, an indexable route, an unapproved external request, or missing fixture-only warnings:

1. disable the deployment immediately;
2. do not conceal the failure by changing tests or screenshots;
3. record a bounded security/incident Issue without copying sensitive values;
4. fix and re-run all local and remote gates before redeployment.
