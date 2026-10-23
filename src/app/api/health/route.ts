import { json } from "../../../server/http.ts";
import { supabaseConfig } from "../../../server/supabase.ts";

export const dynamic = "force-dynamic";

// Reports configuration presence only; never values.
export function GET() {
  return json({
    ok: true,
    storage: supabaseConfig() ? "supabase" : "not configured",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
  });
}
