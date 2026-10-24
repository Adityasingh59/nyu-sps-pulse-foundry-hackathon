# Free cloud deployment

This path keeps Express, React/Vite and the existing evidence/analysis logic. It
uses a **Render Free web service** and a **Neon Free PostgreSQL project**. The
attached development plan is reference material; its Next.js/Supabase/Inngest
migration is not required for this deployment.

No cloud resource or model call is created by installing or building the app.
The checked-in `render.yaml` requests only a free web service. Keep accounts on
their Free plans, with paid upgrades/overages disabled; do not add paid resources.

## Connect and deploy

1. Connect Render and Neon to the coding session, or use their dashboards.
   Give Render access to this private GitHub repository and select the deployment
   branch containing `render.yaml`.
2. Create a Neon **Free** project. Use its **direct** PostgreSQL connection URL,
   not a transaction-pooled URL. The server uses a session advisory lock to give
   background jobs one active worker during deployment overlap. Database
   transactions serialize record updates; the worker releases its lock when idle.
3. Set `DATABASE_URL` through Render's private environment editor. Do not paste it
   into chat, commit it, or put it in a variable prefixed `VITE_`. The backend
   verifies TLS certificates on remote PostgreSQL connections.
4. Use the Blueprint. It installs Node 24.15.0, builds the frontend, applies an
   additive schema migration and starts the existing Express server. The migration
   creates only the `tablesignal` schema/tables; it never drops or resets data.
   Automatic redeploys are disabled so future changes remain deliberate.
5. Render generates `TABLESIGNAL_ACCESS_PASSWORD`. Sign in to the app with
   username **operator** and that password, viewed privately in the dashboard.
   The same gate covers the UI, API, snapshots and exports. This is one private
   operator workspace; it does not provide separate accounts or tenant isolation.
6. The app uses Render's documented `RENDER_EXTERNAL_URL` for its allowed origin.
   If you add a custom domain, set `TABLESIGNAL_PUBLIC_ORIGIN` to the exact HTTPS
   origin, without a trailing slash. `HOST=0.0.0.0` lets Render reach the server.
7. Check the returned service URL: `/api/health` should return `storage: postgres`.
   The app and `/api/bootstrap` should require sign-in. Add a business by name
   and URL, refresh, and restart/redeploy the service to confirm records survive.

The build command is:

```sh
npm ci --include=dev
npm run build
npm run db:migrate
```

The start command is `npm start`. `TABLESIGNAL_REQUIRE_POSTGRES=true` prevents
an incorrectly configured cloud deployment from silently using ephemeral SQLite.
An inaccessible or unmigrated database prevents startup; it is not replaced with
synthetic records or local storage.

## Saved local history

A fresh cloud database starts with the clearly synthetic Linden Table example.
Local Gandhi Cafe, John's, Cafe Athena and other records are not automatically
uploaded by Git or by a deploy.

To carry the full saved history into a **new, empty** cloud database, migrate
the schema and run this **before the cloud app first starts and seeds it**, with
`DATABASE_URL` configured privately in that shell:

```sh
npm run db:migrate
npm run db:import -- /absolute/path/to/data/tablesignal.sqlite
```

The importer opens SQLite read-only, copies all nine record tables plus
idempotency history in one PostgreSQL transaction, and verifies counts and
canonical record hashes before committing. Original IDs, raw-answer strings,
timestamps, source hashes, provenance, artifact versions and request keys are
retained. It refuses a populated destination; it never merges, overwrites or
clears a cloud database. Retain the original local database and backups.

For an already started cloud demo, use a separate new database/branch for a
history import. Do not reset existing records to make the import succeed.

## Website analysis and provider access

Name and URL are enough to collect up to five permitted public HTML/text pages.
General business collection follows relevant about/contact/service/product/pricing
links. Facts remain unconfirmed website observations until reviewed. A category
improves the neutral 20-question bank; no category means broad questions that
need operator review. Location is optional and unknown locations stay unknown.

Collection does not need a model key. Live recommendation measurements require
a supported server-side provider. On this cloud path, set `OPENAI_API_KEY` and
optionally `OPENAI_MODEL` privately. No API key is included, no paid model calls
are part of deployment, and free hosting does not make model usage free. The
local Codex CLI adapter is disabled in the cloud configuration; local sign-in files
are never uploaded or used as API keys. Without a provider, the UI shows the
configuration limitation and retains website evidence plus the separate synthetic
example.

## Limits and verification

Render Free services sleep after idle periods and can restart. A subsequent
request wakes the app, which recovers queued/interrupted jobs from PostgreSQL.
An in-flight provider attempt may have consumed allowance before interruption;
attempt counts and ceilings are preserved. Exactly-once external model execution
is not promised. Free hosting is suitable for a bounded demo, not an uptime SLA
or uninterrupted scheduled work. Keep backups and monitor account quotas.

The source collector still respects robots, private-address protections, redirect
validation, DNS pinning, content/time limits and public URL rules. It cannot read
every website: login-only, bot-blocked, PDF-only and JavaScript-only content can
remain unavailable. Those failures are saved rather than treated as absent facts.

Local checks:

```sh
npm run build
npm test
```

Tests use isolated SQLite and embedded PostgreSQL (PGlite), exercising persistence,
transactions, rollback and restart recovery. They do not establish Neon transport,
advisory-lock behavior across real cloud processes, hosted access, or a successful
Render deployment. Record those checks against the actual deployed URL before
claiming the online version is working.

References checked October 23, 2026:
[Render Free](https://render.com/docs/free),
[Neon plans](https://neon.com/docs/introduction/plans),
[Render Blueprint fields](https://render.com/docs/blueprint-spec),
[Render environment variables](https://render.com/docs/environment-variables),
[node-postgres transactions](https://node-postgres.com/features/transactions).
