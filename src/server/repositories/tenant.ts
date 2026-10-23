import type { ProfileFact } from "../../../shared/types.ts";

export type WorkspaceRole = "owner" | "editor" | "viewer";
export interface Membership {
  workspaceId: string;
  name: string;
  role: WorkspaceRole;
}
/** Cloud restaurant identity. Website is optional: not every business has one. */
export interface CloudRestaurant {
  id: string;
  workspaceId: string;
  name: string;
  website?: string;
  location: string;
  cuisine?: string;
  aliases: string[];
  facts: ProfileFact[];
  identitySource: "manual" | "website" | "owner" | "synthetic";
  confirmedAt?: string;
  createdAt: string;
}

/**
 * Persistence for one authenticated caller. Implementations must apply the
 * caller's identity (e.g. RLS with their JWT); a record outside the caller's
 * workspaces is indistinguishable from a missing one.
 */
export interface TenantRepository {
  ensurePersonalWorkspace(): Promise<string>;
  memberships(): Promise<Membership[]>;
  listRestaurants(workspaceId: string, limit: number): Promise<CloudRestaurant[]>;
  getRestaurant(id: string): Promise<CloudRestaurant | null>;
  insertRestaurant(restaurant: CloudRestaurant): Promise<CloudRestaurant>;
}

export interface RestaurantRow {
  id: string;
  workspace_id: string;
  name: string;
  website: string | null;
  location: string;
  cuisine: string | null;
  aliases: string[];
  facts: ProfileFact[];
  identity_source: CloudRestaurant["identitySource"];
  confirmed_at: string | null;
  created_at: string;
}

export const restaurantColumns =
  "id, workspace_id, name, website, location, cuisine, aliases, facts, identity_source, confirmed_at, created_at";

export function fromRow(row: RestaurantRow): CloudRestaurant {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    ...(row.website ? { website: row.website } : {}),
    location: row.location,
    ...(row.cuisine ? { cuisine: row.cuisine } : {}),
    aliases: row.aliases,
    facts: row.facts,
    identitySource: row.identity_source,
    ...(row.confirmed_at ? { confirmedAt: row.confirmed_at } : {}),
    createdAt: row.created_at,
  };
}

/** Columns a client may write on insert; created_by/created_at are server defaults. */
export function toInsertRow(restaurant: CloudRestaurant) {
  return {
    id: restaurant.id,
    workspace_id: restaurant.workspaceId,
    name: restaurant.name,
    website: restaurant.website ?? null,
    location: restaurant.location,
    cuisine: restaurant.cuisine ?? null,
    aliases: restaurant.aliases,
    facts: restaurant.facts,
    identity_source: restaurant.identitySource,
    confirmed_at: restaurant.confirmedAt ?? null,
  };
}
