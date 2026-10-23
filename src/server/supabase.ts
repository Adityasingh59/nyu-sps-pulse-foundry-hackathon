import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ApiError } from "../../server/validation.ts";

/** Public by design: Supabase URL and publishable key, protected by RLS. */
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export async function createSupabaseServerClient() {
  const config = supabaseConfig();
  if (!config)
    throw new ApiError(503, "Cloud storage is not configured for this deployment.");
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; the proxy refreshes sessions.
        }
      },
    },
  });
}

/** Verified identity from the session JWT (signature checked), never getSession(). */
export async function currentUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") return { supabase, userId: null };
  return {
    supabase,
    userId,
    email: typeof data?.claims?.email === "string" ? data.claims.email : undefined,
  };
}
