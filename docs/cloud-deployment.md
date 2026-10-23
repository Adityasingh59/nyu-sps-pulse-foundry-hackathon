# Cloud deployment (M1 slice)

Status: **code verified locally; not yet deployed.** The cloud app is a Next.js App Router project in this same repository (`src/app`, `src/server`, `src/proxy.ts`) backed by Supabase Postgres/Auth. It currently supports sign-in, a personal workspace, and creating/listing/reloading restaurant identities. Source collection, provider runs, reports and exports still exist only in the legacy local app (`npm run setup`); they move in M2–M4.

## What is enforced

- Every restaurant row has `workspace_id`. RLS restricts reads to workspace members and writes to `owner`/`editor`; there is no client DELETE, and `id`, `workspace_id`, `created_by` and `created_at` are not client-updatable.
- Membership is server-controlled: `public.ensure_personal_workspace()` is the only way a user gains one (their own personal workspace). It is idempotent.
- API routes verify the session JWT with `getClaims()`, check membership server-side, then query with the caller's session so RLS applies again. Another workspace's restaurant returns 404, the same as a missing record.
- Mutations require a same-host `Origin`, `application/json`, and a body of 16 KB or less. API responses are `private, no-store`.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are used. No service-role key is needed or allowed in this slice.

## One-time setup

1. **Supabase project** (use separate projects, or genuinely isolated environments, for preview and production). In the SQL editor, run `supabase/migrations/20261023000000_workspace_restaurants.sql` once, or use `supabase link` + `supabase db push` with the Supabase CLI. Apply migrations as a release step, not on app start. If applied through the SQL editor and you later adopt the CLI, mark it applied with `supabase migration repair --status applied 20261023000000`.
   Then run `supabase/verify/m1_rls_check.sql` in the SQL editor. It must return `M1 RLS check passed`. It creates two throwaway users, checks isolation as `authenticated` and `anon`, and removes everything it created; a failure names the broken check and rolls back. Never share the database password in chat or commit it; the app does not need it.
2. **Supabase Auth → URL configuration.** Set the Site URL to the deployment URL and add redirect URLs for `https://<your-domain>/auth/callback` (and the preview pattern you use, e.g. `https://*-<team-slug>.vercel.app/auth/callback`). Email sign-in uses magic links with the PKCE code exchange in `src/app/auth/callback/route.ts`. The built-in email sender is heavily rate-limited; configure custom SMTP before inviting a team. Sign-ups are open by default; disable them in Auth settings if only invited users should get in.
3. **Vercel project** linked to this repository. `vercel.json` sets the Next.js framework, `npm ci` and `next build`. Node.js 24 is selected from `package.json` `engines`. Add the two public Supabase variables for the Preview and Production environments.
4. **Deploy a preview** and run the M1 acceptance checks below.

## Local development against a Supabase project

```sh
export NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
npm run cloud:dev            # http://localhost:3000
```

Add `http://localhost:3000/auth/callback` to the Auth redirect URLs for this. Without the variables, the app builds and runs but reports "Cloud storage is not configured" (HTTP 503 from data routes).

## M1 acceptance (deployed preview) — not yet run

1. `GET /api/health` returns `"storage":"supabase"` and the deployed commit.
2. Account A signs in, creates a restaurant without a website and one with a website; both appear; a browser refresh with `?restaurant=<id>` reloads the details from the database.
3. Account B signs in from another browser/device: its list is empty; `GET /api/restaurants/<A's id>` returns 404; `GET /api/restaurants?workspaceId=<A's workspace>` returns 403.
4. Signed out: data routes return 401. A POST with a foreign `Origin` returns 403.
5. Redeploy; A's restaurants are still present.

## Local verification already run

- `tests/cloud-schema.test.ts` applies the real migration to an in-process Postgres (PGlite) with Supabase-style `auth.uid()`/role stubs and checks isolation as `authenticated` and `anon`.
- `tests/cloud-restaurants.test.ts` checks service validation, membership/role checks, cross-tenant 404/403, same-origin and body limits.
- `npm run cloud:build` succeeds; a local `next start` smoke test confirmed the unconfigured 503 state, cross-origin 403 and security headers.

These do not exercise real Supabase Auth, PostgREST or a Vercel deployment.
