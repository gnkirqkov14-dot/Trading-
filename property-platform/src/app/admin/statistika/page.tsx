import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import type { Statistika } from "@/lib/types/statistika";
import { Opresni } from "./opresni";

export const metadata: Metadata = { title: "Админ панел — статистика" };

function vreme(sek: number) {
  if (!sek) return "0 сек";
  const m = Math.floor(sek / 60);
  const s = Math.round(sek % 60);
  return m ? `${m} мин ${s} сек` : `${s} сек`;
}

function chas(value: string) {
  return new Date(value).toLocaleString("bg-BG", {
    timeZone: "Europe/Sofia",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const POKAZHI_OBQVI = false;

const IMENA_STRANICI: Record<string, string> = {
  "/": "Начална",
  "/listings": "Всички обяви",
  "/about": "За нас",
  "/login": "Вход",
  "/signup": "Регистрация",
  "/dashboard/listings/new": "Публикувай обява",
};

function Karta({
  zaglavie,
  children,
}: {
  zaglavie: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {zaglavie}
      </h2>
      {children}
    </section>
  );
}

export default async function AdminStatistikaPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_statistika");
  const st = data as Statistika | null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Opresni />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Админ панел — статистика</h1>
        <div className="flex gap-4 text-sm">
          {[
            ["/admin", "Обяви"],
            ["/admin/users", "Потребители"],
            ["/admin/contacts", "Контакти"],
          ].map(([href, ime]) => (
            <Link
              key={href}
              href={href}
              className="text-slate-500 underline underline-offset-2 hover:text-slate-900"
            >
              {ime}
            </Link>
          ))}
        </div>
      </div>

      {!st ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          Статистиката не се зареди{error ? `: ${error.message}` : "."}
        </p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Сега на сайта
              </p>
              <p className="text-3xl font-semibold text-emerald-800">
                {st.sega}
              </p>
            </div>
            {st.periodi.map((p) => (
              <div
                key={p.ime}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {p.ime}
                </p>
                <p className="text-2xl font-semibold">{p.posetiteli}</p>
                <p className="text-xs text-slate-500">
                  {p.stranici} страници · ср. {vreme(p.sredno_sek)}
                </p>
              </div>
            ))}
          </div>
          <p className="-mt-3 text-xs text-slate-500">
            Големите числа са уникални посетители. „Ср.“ е колко време средно
            стои един човек на сайта при едно посещение. Обновява се на всеки 30
            секунди.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <Karta zaglavie="Откъде идват (7 дни)">
              <ul className="space-y-1.5 text-sm">
                {st.iztochnitsi.length === 0 && (
                  <li className="text-slate-400">Още няма данни.</li>
                )}
                {st.iztochnitsi.map((i) => (
                  <li key={i.iztochnik} className="flex justify-between">
                    <span>{i.iztochnik}</span>
                    <b>{i.posetiteli}</b>
                  </li>
                ))}
              </ul>
            </Karta>
            <Karta zaglavie="Устройство (7 дни)">
              <ul className="space-y-1.5 text-sm">
                {st.ustroistva.length === 0 && (
                  <li className="text-slate-400">Още няма данни.</li>
                )}
                {st.ustroistva.map((u) => (
                  <li key={u.ustroistvo} className="flex justify-between">
                    <span>{u.ustroistvo}</span>
                    <b>{u.posetiteli}</b>
                  </li>
                ))}
              </ul>
            </Karta>
          </div>

          {/* „Най-гледани обяви“ е скрито засега по желание на собственика;
              данните се събират и блокът се връща, като се смени на true. */}
          {POKAZHI_OBQVI && (
            <Karta zaglavie="Най-гледани обяви (7 дни)">
              <Tablica
                glava={["Обява", "Прегледи", "Хора", "Ср. време"]}
                redove={st.obqvi.map((o) => [
                  <Link
                    key="l"
                    href={`/listings/${o.listing_id}`}
                    className="underline underline-offset-2"
                  >
                    {o.title}
                  </Link>,
                  o.pregledi,
                  o.posetiteli,
                  vreme(o.sredno_sek),
                ])}
              />
            </Karta>
          )}

          <Karta zaglavie="Най-гледани страници (7 дни)">
            <Tablica
              glava={["Страница", "Прегледи", "Хора", "Ср. време"]}
              redove={st.stranici.map((s) => [
                IMENA_STRANICI[s.pat] ?? s.pat,
                s.pregledi,
                s.posetiteli,
                vreme(s.sredno_sek),
              ])}
            />
          </Karta>

          <Karta zaglavie="Последни посещения">
            <Tablica
              glava={["Кога", "Какво гледа", "Колко", "Откъде", "Устройство"]}
              redove={st.posledni.map((v) => [
                <span key="k" className="whitespace-nowrap">
                  {v.aktiven && (
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500"
                      title="сега е тук"
                    />
                  )}
                  {chas(v.zapochna)}
                </span>,
                v.title ?? IMENA_STRANICI[v.pat] ?? v.pat,
                vreme(v.sekundi),
                v.iztochnik || "директно",
                v.ustroistvo ?? "—",
              ])}
            />
          </Karta>
        </div>
      )}
    </div>
  );
}

function Tablica({
  glava,
  redove,
}: {
  glava: string[];
  redove: React.ReactNode[][];
}) {
  if (redove.length === 0) {
    return <p className="text-sm text-slate-400">Още няма данни.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {glava.map((g, i) => (
              <th
                key={g}
                className={`py-2 pr-3 font-medium ${i > 0 ? "text-right" : ""}`}
              >
                {g}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {redove.map((red, i) => (
            <tr key={i}>
              {red.map((kl, j) => (
                <td
                  key={j}
                  className={`py-2 pr-3 ${j > 0 ? "text-right text-slate-600" : ""}`}
                >
                  {kl}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
