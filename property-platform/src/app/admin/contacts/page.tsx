import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { ContactsImport } from "@/components/contacts-import";

export const metadata: Metadata = { title: "Админ панел — контакти" };

type GroupRow = { id: string; name: string };

export default async function AdminContactsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: groups }, { count: total }, { count: unsubscribed }, { data: recent }] =
    await Promise.all([
      supabase.from("contact_groups").select("id, name").order("name"),
      supabase.from("contacts").select("id", { count: "exact", head: true }),
      supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .not("unsubscribed_at", "is", null),
      supabase
        .from("contacts")
        .select("id, phone, name, source, consent_at, unsubscribed_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const groupRows = (groups ?? []) as GroupRow[];

  // Броят на всяка група върви с отделна заявка за брой — групите са
  // единици, а да се тегли целият списък само за да се преброи е излишно.
  const groupCounts = await Promise.all(
    groupRows.map(async (group) => {
      const { count } = await supabase
        .from("contact_group_members")
        .select("contact_id", { count: "exact", head: true })
        .eq("group_id", group.id);
      return { ...group, count: count ?? 0 };
    }),
  );

  const reachable = (total ?? 0) - (unsubscribed ?? 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Админ панел — контакти</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/admin" className="text-slate-500 underline underline-offset-2 hover:text-slate-900">
            Обяви
          </Link>
          <Link href="/admin/users" className="text-slate-500 underline underline-offset-2 hover:text-slate-900">
            Потребители
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Общо телефони", value: total ?? 0 },
          { label: "Може да им се пише", value: reachable },
          { label: "Отписали се", value: unsubscribed ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <ContactsImport groups={groupRows.map((g) => g.name)} />

      {groupCounts.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Групи</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {groupCounts.map((group) => (
              <li
                key={group.id}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
              >
                {group.name}{" "}
                <span className="text-slate-500">· {group.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Последно внесени</h2>
        {!recent || recent.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Още няма контакти.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 font-medium">Телефон</th>
                  <th className="py-2 font-medium">Име</th>
                  <th className="py-2 font-medium">Откъде</th>
                  <th className="py-2 font-medium">Състояние</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 font-mono">{row.phone}</td>
                    <td className="py-2">
                      {row.name || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 text-slate-600">
                      {row.source || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2">
                      {row.unsubscribed_at ? (
                        <span className="text-red-700">отписан</span>
                      ) : row.consent_at ? (
                        <span className="text-emerald-700">със съгласие</span>
                      ) : (
                        <span className="text-amber-700">без съгласие</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
