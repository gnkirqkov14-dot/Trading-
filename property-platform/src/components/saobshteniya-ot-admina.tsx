import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Съобщенията от IMOT POINT до влезлия потребител (админът ги пише от
 * админ панела). Новите са оцветени; щом се покажат, се отбелязват като
 * прочетени. Без съобщения не показва нищо.
 */
export async function SaobshteniyaOtAdmina({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_saobshteniya")
    .select("id, content, created_at, procheteno_na")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const saobshteniya = data ?? [];
  if (!saobshteniya.length) return null;

  if (saobshteniya.some((m) => !m.procheteno_na)) {
    after(async () => {
      await supabase.rpc("admin_saobshteniya_procheteni");
    });
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Съобщения от IMOT POINT</h2>
      <ul className="flex flex-col gap-3">
        {saobshteniya.map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border p-4 ${
              m.procheteno_na
                ? "border-slate-200 bg-white"
                : "border-amber-300 bg-amber-50"
            }`}
          >
            <p className="mb-1 text-xs text-slate-500">
              {!m.procheteno_na && (
                <span className="mr-2 rounded bg-amber-500 px-1.5 py-0.5 font-semibold text-white">
                  Ново
                </span>
              )}
              {new Date(m.created_at).toLocaleDateString("bg-BG", {
                timeZone: "Europe/Sofia",
              })}
            </p>
            <p className="whitespace-pre-wrap text-slate-800">{m.content}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
