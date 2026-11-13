import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NovaParolaForm } from "@/components/nova-parola-form";

export const metadata: Metadata = {
  title: "Нова парола",
  robots: { index: false },
};

/** Отваря се само с влязъл профил: линкът от писмото вкарва човека. */
export default async function NovaParolaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/zabravena-parola?greshka=1");

  return (
    <>
      <h1 className="mb-2 text-center text-xl font-semibold">Нова парола</h1>
      <p className="mb-6 text-center text-sm text-slate-600">
        Избери нова парола за {user.email}.
      </p>
      <NovaParolaForm />
    </>
  );
}
