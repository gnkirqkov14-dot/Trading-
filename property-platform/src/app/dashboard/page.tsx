import type { Metadata } from "next";
import { getAuthedUser, getProfile } from "@/lib/supabase/dal";

export const metadata: Metadata = { title: "Моят профил" };

export default async function DashboardPage() {
  const user = await getAuthedUser();
  const profile = await getProfile();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">
        Здравей, {profile?.name || user.email}
      </h1>
      <p className="mt-2 text-slate-500">
        План:{" "}
        <span className="font-medium text-slate-900">
          {profile?.subscription_plan ?? "basic"}
        </span>
      </p>

      <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Тук ще виждаш своите обяви, статистика и съобщения — идва във Фаза 2.
      </div>
    </div>
  );
}
