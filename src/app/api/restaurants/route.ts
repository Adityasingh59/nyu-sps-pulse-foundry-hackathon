import { json, readJson, withTenant } from "../../../server/http.ts";
import {
  createRestaurant,
  listRestaurants,
} from "../../../server/services/restaurants.ts";

export async function GET(request: Request) {
  return withTenant(request, async (repo) =>
    json({
      restaurants: await listRestaurants(
        repo,
        new URL(request.url).searchParams.get("workspaceId"),
      ),
    }),
  );
}

export async function POST(request: Request) {
  return withTenant(
    request,
    async (repo) => json(await createRestaurant(repo, await readJson(request)), 201),
    { mutation: true },
  );
}
