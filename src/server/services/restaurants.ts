import { validatePublicUrl } from "../../../server/collector.ts";
import { id, now } from "../../../server/ids.ts";
import { ApiError, textInput } from "../../../server/validation.ts";
import type {
  CloudRestaurant,
  Membership,
  TenantRepository,
} from "../repositories/tenant.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESTAURANT_ID = /^restaurant_[A-Za-z0-9_-]{1,100}$/;
export const RESTAURANT_PAGE_LIMIT = 100;

export async function listWorkspaces(repo: TenantRepository) {
  await repo.ensurePersonalWorkspace();
  return repo.memberships();
}

/** Server-side membership check; RLS enforces the same rule again in the database. */
async function requireMembership(
  repo: TenantRepository,
  workspaceId: unknown,
  write: boolean,
): Promise<Membership> {
  if (typeof workspaceId !== "string" || !UUID.test(workspaceId))
    throw new ApiError(400, "workspaceId must be a workspace identifier.");
  const membership = (await repo.memberships()).find(
    (m) => m.workspaceId === workspaceId,
  );
  if (!membership)
    throw new ApiError(403, "You are not a member of this workspace.");
  if (write && membership.role === "viewer")
    throw new ApiError(403, "Viewers cannot change this workspace.");
  return membership;
}

export async function listRestaurants(
  repo: TenantRepository,
  workspaceId: unknown,
) {
  const membership = await requireMembership(repo, workspaceId, false);
  return repo.listRestaurants(membership.workspaceId, RESTAURANT_PAGE_LIMIT);
}

export async function getRestaurant(repo: TenantRepository, restaurantId: string) {
  if (!RESTAURANT_ID.test(restaurantId))
    throw new ApiError(404, "The requested record was not found.");
  const restaurant = await repo.getRestaurant(restaurantId);
  // Another tenant's record is reported exactly like a missing one.
  if (!restaurant) throw new ApiError(404, "The requested record was not found.");
  return restaurant;
}

function optionalText(value: unknown, field: string, max: number) {
  if (value === undefined || value === null || value === "") return undefined;
  return textInput(value, field, max);
}

export async function createRestaurant(repo: TenantRepository, body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ApiError(400, "Request body must be a JSON object.");
  const input = body as Record<string, unknown>;
  const membership = await requireMembership(repo, input.workspaceId, true);
  const websiteText = optionalText(input.website, "website", 2000);
  let website: string | undefined;
  if (websiteText) {
    try {
      website = validatePublicUrl(websiteText).href;
    } catch (error) {
      throw new ApiError(
        400,
        error instanceof Error ? error.message : "Invalid website.",
      );
    }
  }
  if (
    input.aliases !== undefined &&
    (!Array.isArray(input.aliases) || input.aliases.length > 10)
  )
    throw new ApiError(400, "Use at most 10 full restaurant aliases.");
  const cuisine = optionalText(input.cuisine, "cuisine", 120);
  const restaurant: CloudRestaurant = {
    id: id("restaurant"),
    workspaceId: membership.workspaceId,
    name: textInput(input.name, "name", 120),
    ...(website ? { website } : {}),
    location: textInput(input.location, "location", 300),
    ...(cuisine ? { cuisine } : {}),
    aliases: ((input.aliases as unknown[] | undefined) ?? []).map((v) =>
      textInput(v, "alias", 140),
    ),
    // Facts arrive with reviewed source collection (M2/M3); none are accepted here.
    facts: [],
    identitySource: "manual",
    ...(input.confirmed === true ? { confirmedAt: now() } : {}),
    createdAt: now(),
  };
  return repo.insertRestaurant(restaurant);
}
