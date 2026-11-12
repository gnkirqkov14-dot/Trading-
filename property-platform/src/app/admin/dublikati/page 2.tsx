import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { etiket, grupiDublikati, vsichkiObyavi } from "@/lib/admin-eksport";

export const metadata: Metadata = { title: "Дубликати" };

const NAY_MNOGO_GRUPI = 300;

/**
 * Вероятни дубликати сред активните обяви и сваляне на всички в CSV.
 * Всичко идва с една заявка към базата, затова не удря лимита на
 * защитната стена, който важи за отварянето на обяви една по една.
 */
export default async function DublikatiPage() {
  await requireAdmin();
  const supabase = await createClient();
  const obyavi = await vsichkiObyavi(supabase);
  const grupi = grupiDublikati(obyavi);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Дубликати</h1>
        <Link
          href="/admin"
          className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-900"
        >
          Обяви
        </Link>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        {obyavi.length} активни обяви, {grupi.length} групи за проверка. Групата
        е подсказка, не присъда: отвори обявите и сравни снимките.
      </p>

      <a
        href="/admin/dublikati/export"
        className="mb-8 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700"
      >
        Свали всички активни обяви (Excel, CSV)
      </a>

      {grupi.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
          Няма вероятни дубликати.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {grupi.slice(0, NAY_MNOGO_GRUPI).map((g, i) => (
            <li
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">
                {g.prichina} · {g.obyavi.length} обяви
              </p>
              <ul className="flex flex-col gap-2">
                {g.obyavi.map((o) => (
                  <li key={o.id} className="flex gap-3">
                    <a
                      href={o.korica ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100"
                    >
                      {o.korica && (
                        <Image
                          src={o.korica}
                          alt=""
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      )}
                    </a>
                    <div className="min-w-0 text-sm">
                      <Link
                        href={`/listings/${o.id}`}
                        target="_blank"
                        className="line-clamp-1 font-medium text-slate-900 hover:underline"
                      >
                        {o.title}
                      </Link>
                      <p className="text-slate-600">
                        {etiket.type(o.type)} ·{" "}
                        {o.price.toLocaleString("bg-BG")} € · {o.area_sqm} кв.м
                        · {[o.kvartal, o.grad].filter(Boolean).join(", ")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {o.phone ?? "без телефон"} · {o.broy_snimki} снимки ·
                        качена{" "}
                        {new Date(o.created_at).toLocaleDateString("bg-BG")} ·
                        промяна{" "}
                        {new Date(o.updated_at).toLocaleDateString("bg-BG")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {grupi.length > NAY_MNOGO_GRUPI && (
        <p className="mt-4 text-sm text-slate-500">
          Показани са първите {NAY_MNOGO_GRUPI}. Всичко е в CSV файла.
        </p>
      )}
    </div>
  );
}
