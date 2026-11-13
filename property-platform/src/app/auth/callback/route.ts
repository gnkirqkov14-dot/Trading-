import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NOVA_PAROLA_PAT, safeNext } from "@/lib/phone";
import { gradPoIp } from "@/lib/grad-po-ip";

// Google/Facebook redirect the browser here (via Supabase) with a ?code=
// after the user approves the OAuth consent screen. We exchange it for a
// session, then send the user on to wherever they were headed.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const target = safeNext(next);
  // Линкът от писмото „Забравена парола“ минава оттук със същия ?code=.
  const zaParola = target === NOVA_PAROLA_PAT;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && zaParola) {
      return NextResponse.redirect(`${origin}${NOVA_PAROLA_PAT}`);
    }
    if (!error) {
      // Нов профил от Google няма град; съществуващ не се пипа.
      await supabase.rpc("zapishi_grad_ip", { p_grad: await gradPoIp() });
      // Google не дава телефон: без номер първо минава през профила.
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", data.user.id)
        .single();
      return NextResponse.redirect(
        profile?.phone
          ? `${origin}${target}`
          : `${origin}/dashboard/profile?telefon=1&next=${encodeURIComponent(target)}`,
      );
    }
  }

  return NextResponse.redirect(
    zaParola
      ? `${origin}/zabravena-parola?greshka=1`
      : `${origin}/login?error=oauth_failed`,
  );
}
