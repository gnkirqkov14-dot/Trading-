import type { Metadata } from "next";
import Link from "next/link";
import { getAuthedUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

type RawMessage = {
  from_user_id: string;
  to_user_id: string;
  listing_id: string | null;
  content: string;
  created_at: string;
  listings: { title: string } | null;
  from_profile: { name: string | null } | null;
  to_profile: { name: string | null } | null;
};

export const metadata: Metadata = { title: "Съобщения" };

export default async function MessagesPage() {
  const user = await getAuthedUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("messages")
    .select(
      "from_user_id, to_user_id, listing_id, content, created_at, listings(title), from_profile:profiles!messages_from_user_id_fkey(name), to_profile:profiles!messages_to_user_id_fkey(name)",
    )
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const messages = (data ?? []) as unknown as RawMessage[];

  const seen = new Set<string>();
  const conversations = messages.filter((m) => {
    if (!m.listing_id) return false;
    const otherId = m.from_user_id === user.id ? m.to_user_id : m.from_user_id;
    const key = `${m.listing_id}::${otherId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Съобщения</h1>

      {conversations.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          Нямаш съобщения още.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {conversations.map((m) => {
            const otherId =
              m.from_user_id === user.id ? m.to_user_id : m.from_user_id;
            const otherName =
              (m.from_user_id === user.id ? m.to_profile : m.from_profile)
                ?.name ?? "Потребител";

            return (
              <li key={`${m.listing_id}-${otherId}`}>
                <Link
                  href={`/dashboard/messages/${m.listing_id}/${otherId}`}
                  className="flex flex-col gap-1 p-4 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">
                      {otherName}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(m.created_at).toLocaleDateString("bg-BG")}
                    </span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {m.listings?.title}
                  </span>
                  <span className="truncate text-sm text-slate-600">
                    {m.content}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
