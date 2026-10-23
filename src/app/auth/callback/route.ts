import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../server/supabase.ts";

// Completes the email sign-in link (PKCE code exchange), then returns home.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
