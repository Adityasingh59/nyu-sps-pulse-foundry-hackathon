import { NextResponse } from "next/server";
import { assertSameOrigin, errorResponse } from "../../../server/http.ts";
import { createSupabaseServerClient } from "../../../server/supabase.ts";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login", request.url), 303);
  } catch (error) {
    return errorResponse(error);
  }
}
