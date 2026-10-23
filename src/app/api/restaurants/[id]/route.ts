import { json, withTenant } from "../../../../server/http.ts";
import { getRestaurant } from "../../../../server/services/restaurants.ts";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withTenant(request, async (repo) => json(await getRestaurant(repo, id)));
}
