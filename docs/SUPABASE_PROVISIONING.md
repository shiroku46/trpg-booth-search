# Supabase staging provisioning handoff

## Purpose and boundary

This is the first human-only hosted-database handoff for `trpg-booth-search`. It creates a **non-production staging database only**. Creating it does not make the project production-ready, does not authorize BOOTH collection, does not satisfy PD-010 backup/recovery, and does not authorize production data or deployment.

Do not paste any database password or connection string into ChatGPT, GitHub Issues, Pull Requests, commits, workflow inputs, logs, screenshots, or documentation.

## Fixed staging profile

Use exactly this profile in the Supabase Dashboard:

- project name: `trpg-booth-search-staging`
- plan: **Free**
- region: **Northeast Asia (Tokyo)**
- AWS region code: `ap-northeast-1`
- database password: generate a new strong unique password and store it in your password manager; never send it in chat

Current Supabase Free is suitable only for this bounded staging validation. Automatic database backups and PITR are not included on the Free plan, and Free projects may be paused after inactivity. The project therefore remains outside the Stage 34 production `hosted_database` and `backup_restore` ready states.

## Human steps

1. Sign in to the Supabase Dashboard and create a new project in an organization you control.
2. Set the project name to `trpg-booth-search-staging`.
3. Select the Free plan.
4. Select **Northeast Asia (Tokyo) / `ap-northeast-1`** as the project region.
5. Generate a strong unique database password and store it in your password manager. Do not paste it into this repository or conversation.
6. Create the project and wait until provisioning finishes.
7. In the project Dashboard, click **Connect**.
8. Select/copy the **Session pooler** connection string on port **5432**. For the later GitHub Actions validation, use the Shared Pooler session-mode string rather than the Free direct endpoint because GitHub Actions is IPv4-only while the Free direct Postgres endpoint is IPv6-only.
9. Replace the password placeholder locally with the database password you saved. Do not expose the completed URL anywhere public.
10. In GitHub, open `shiroku46/trpg-booth-search` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
11. Create the secret with the exact name `SUPABASE_STAGING_DATABASE_URL` and the complete Session pooler connection string as its value.
12. Do not create any other database/API/service-role secret for this stage.

## What to report back

After the above steps, report only:

- the Supabase **project reference** (the non-secret project identifier shown in the Dashboard/URL); and
- the statement `SUPABASE_STAGING_DATABASE_URL を GitHub Actions Secret に設定済み`.

Do **not** report the password or connection string.

## What happens next

The next repository stage will create an exact-SHA, owner-triggered, bounded staging connectivity/schema-validation workflow. Its first network action will be read-only connection/identity inspection. Remote migration/schema writes require a separate explicit gate after that read-only validation succeeds.

No production data will be inserted during the initial hosted validation. BOOTH collection remains independently blocked by the accepted CAPTCHA stop.

## Current official constraints used by this handoff

This handoff is based on the current Supabase platform documentation checked on 2026-08-07:

- Supabase supports the specific Northeast Asia (Tokyo) region `ap-northeast-1`.
- Free includes a dedicated Postgres database but does not include automatic backups or PITR; Supabase recommends Free projects make logical exports and maintain off-site backups.
- Direct Free Postgres connectivity is IPv6. Supabase documents GitHub Actions as IPv4-only and recommends Shared Pooler session mode on port 5432 when an IPv4-only environment needs a persistent Postgres connection.

These are staging-connection facts only. They do not resolve production recovery or production hosting readiness.
