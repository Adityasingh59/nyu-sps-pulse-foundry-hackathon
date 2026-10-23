import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../../../server/validation.ts";
import {
  fromRow,
  restaurantColumns,
  toInsertRow,
  type Membership,
  type RestaurantRow,
  type TenantRepository,
} from "./tenant.ts";

// Never forward database messages to clients; map known codes only.
function failure(error: PostgrestError): never {
  if (error.code === "42501")
    throw new ApiError(403, "You do not have access to this workspace.");
  if (error.code === "23505")
    throw new ApiError(409, "A record with this identifier already exists.");
  if (error.code === "23514")
    throw new ApiError(400, "The record failed validation.");
  console.error("Database request failed", error.code);
  throw new ApiError(500, "The request could not be completed.");
}

/** Uses the caller's session client, so every query runs under their RLS scope. */
export function supabaseRepository(
  client: SupabaseClient,
  userId: string,
): TenantRepository {
  return {
    async ensurePersonalWorkspace() {
      const { data, error } = await client.rpc("ensure_personal_workspace");
      if (error) failure(error);
      return data as string;
    },
    async memberships() {
      const { data, error } = await client
        .from("workspace_members")
        .select("workspace_id, role, workspaces(name)")
        .eq("user_id", userId)
        .order("created_at");
      if (error) failure(error);
      return (data ?? []).map(
        (row): Membership => ({
          workspaceId: row.workspace_id,
          role: row.role,
          name:
            (row.workspaces as unknown as { name: string } | null)?.name ??
            "Workspace",
        }),
      );
    },
    async listRestaurants(workspaceId, limit) {
      const { data, error } = await client
        .from("restaurants")
        .select(restaurantColumns)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) failure(error);
      return (data as RestaurantRow[]).map(fromRow);
    },
    async getRestaurant(id) {
      const { data, error } = await client
        .from("restaurants")
        .select(restaurantColumns)
        .eq("id", id)
        .maybeSingle();
      if (error) failure(error);
      return data ? fromRow(data as RestaurantRow) : null;
    },
    async insertRestaurant(restaurant) {
      const { data, error } = await client
        .from("restaurants")
        .insert(toInsertRow(restaurant))
        .select(restaurantColumns)
        .single();
      if (error) failure(error);
      return fromRow(data as RestaurantRow);
    },
  };
}
