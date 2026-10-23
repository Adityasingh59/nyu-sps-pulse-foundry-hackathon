import { json, withTenant } from "../../../server/http.ts";
import { listWorkspaces } from "../../../server/services/restaurants.ts";

// GET is safe to repeat: it creates the caller's personal workspace only once.
export async function GET(request: Request) {
  return withTenant(request, async (repo) =>
    json({ workspaces: await listWorkspaces(repo) }),
  );
}
