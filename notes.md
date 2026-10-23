# Note for Vasu: deploy the cloud preview

For **@Vasusolanki811** · October 23, 2026 (America/New_York).

This push adds the first slice of the hosted version: a Next.js app on Vercel backed by Supabase. It lives in the same repository, on branch **`cloud/m1-workspace-restaurants`**, alongside the unchanged local app. Today it covers email sign-in, a personal workspace per user, and creating, listing and reloading restaurants with database-enforced isolation between workspaces. Source collection, provider runs, reports and exports still exist only in the local app. They come in later milestones; see [Skills/development.md](Skills/development.md) and [docs/PROGRESS.md](docs/PROGRESS.md).

## Supabase: already set up

| Setting | Value |
| --- | --- |
| Project URL | `https://vsuexongedxmjgicgoce.supabase.co` |
| Publishable key | `sb_publishable_-wpPKfqFDxJDT0MrD-SWdA_RMnA-_T-` |

The publishable key is designed to be public and is protected by row-level security. **Never** put the `service_role`/secret key or the database password in Vercel, the repository or chat; this app needs neither.

Aditya applied `supabase/migrations/20261023000000_workspace_restaurants.sql` in the SQL editor. An outside check with the publishable key confirmed that the three tables exist and anonymous access is denied, both on every table and on workspace creation. Email sign-in is enabled with confirmation required, and sign-ups are open. Aditya is asked to rotate the database password, because it was shared in chat.

## Your steps on Vercel

1. **Import the repository.** Use Add New → Project → `Adityasingh59/nyu-sps-pulse-foundry-hackathon`. Leave the root directory as the repository root. On the branch, `vercel.json` selects Next.js, `npm ci` and `next build`, and Node.js 24 comes from `package.json`.
2. **Add environment variables** for both Preview and Production:
   - `NEXT_PUBLIC_SUPABASE_URL` = the project URL above
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the publishable key above
3. **Deploy the branch.** Until this branch is merged, `main` contains only the local app, so its first automatic deploy is not the cloud app. Open the deployment for `cloud/m1-workspace-restaurants` (or redeploy it after adding the variables, since `NEXT_PUBLIC_` values are fixed at build time).
4. **Supabase → Authentication → URL Configuration.** Set the Site URL to the deployment URL and add these redirect URLs:
   - `https://<deployment-domain>/auth/callback`
   - your preview pattern, e.g. `https://*-<your-team-slug>.vercel.app/auth/callback`
5. **Run the acceptance checks** in [docs/cloud-deployment.md](docs/cloud-deployment.md#m1-acceptance-deployed-preview--not-yet-run). Use two different email accounts: each must see only its own restaurants, and the other account's restaurant ID must return 404. Send Aditya the deployment URL and the results so the checkpoint can be updated.

The built-in Supabase email sender is heavily rate-limited (a few emails per hour). If sign-in links stop arriving, wait, or configure custom SMTP in Supabase.

## Verified so far, and what isn't

- Verified locally: both builds pass, and `npm test` reports **53 passed, 0 failed**. The migration and row-level security run against an in-process Postgres. The app was also run locally against this Supabase project: health reports `supabase`, signed-out API calls return 401, and `/` redirects to sign-in.
- **Not verified yet:** a real sign-in, creating a restaurant through the deployed app, and the two-account isolation check on Vercel. M1 stays **in progress** until those pass on a deployed preview.

The earlier [handoff](docs/vasu-handoff.md) for the local workflow still applies.
