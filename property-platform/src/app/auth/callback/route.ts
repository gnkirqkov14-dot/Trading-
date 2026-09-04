import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google/Facebook redirect the browser here (via Supabase) with a ?code=
// after the user approves the OAuth consent screen. We exchange it for a
// session, then send the user on to wherever they were headed.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
