import { ApiError } from "../../server/validation.ts";
import { supabaseRepository } from "./repositories/supabase.ts";
import type { TenantRepository } from "./repositories/tenant.ts";
import { currentUser } from "./supabase.ts";

const MAX_BODY_BYTES = 16_000;
const NO_STORE = { "Cache-Control": "private, no-store" };

export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: NO_STORE });
}

/**
 * Cookie-authenticated mutations must come from this deployment's own host.
 * Like Next's Server Action check, compare Origin with the forwarded/Host
 * header; request.url may name the bind address instead.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }
  if (!originHost || originHost !== host)
    throw new ApiError(403, "Cross-origin requests are not accepted.");
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "Send the request body as application/json.");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES)
    throw new ApiError(413, "Request body is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Request body must contain valid JSON.");
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  console.error("API request failed", error instanceof Error ? error.name : "unknown");
  return json({ error: "The request could not be completed." }, 500);
}

/** Authenticate, scope a repository to the caller, and map errors safely. */
export async function withTenant(
  request: Request,
  handler: (repo: TenantRepository) => Promise<Response>,
  options: { mutation?: boolean } = {},
) {
  try {
    if (options.mutation) assertSameOrigin(request);
    const { supabase, userId } = await currentUser();
    if (!userId) throw new ApiError(401, "Sign in to continue.");
    return await handler(supabaseRepository(supabase, userId));
  } catch (error) {
    return errorResponse(error);
  }
}
