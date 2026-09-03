import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthedUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { MessageThreadForm } from "@/components/message-thread-form";

type ThreadMessage = {
  id: string;
  from_user_id: string;
  content: string;
  created_at: string;
};

export const metadata: Metadata = { title: "Съобщения" };

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ listingId: string; otherUserId: string }>;
}) {
  const { listingId, otherUserId } = await params;
  const user = await getAuthedUser();
  const supabase = await createClient();

  const [{ data: listing }, { data: otherProfile }, { data: messages }] =
    await Promise.all([
      supabase.from("listings").select("id, title").eq("id", listingId).maybeSingle(),
      supabase
        .from("profiles")
        .select("name")
        .eq("id", otherUserId)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id, from_user_id, content, created_at")
        .eq("listing_id", listingId)
        .or(
          `and(from_user_id.eq.${user.id},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true }),
    ]);

  if (!listing) {
    notFound();
  }

  const thread = (messages ?? []) as ThreadMessage[];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/dashboard/messages"
        className="text-sm text-slate-500 hover:underline"
      >
        ← Всички съобщения
      </Link>

      <h1 className="mt-2 text-xl font-semibold">
        {otherProfile?.name ?? "Потребител"}
      </h1>
      <Link
        href={`/listings/${listing.id}`}
        className="text-sm text-slate-500 hover:underline"
      >
        Обява: {listing.title}
      </Link>

      <div className="mt-6 flex flex-col gap-3">
        {thread.length === 0 && (
          <p className="text-center text-sm text-slate-400">
            Все още няма съобщения — напиши първото.
          </p>
        )}
        {thread.map((message) => {
          const mine = message.from_user_id === user.id;
          return (
            <div
              key={message.id}
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                mine
                  ? "self-end bg-slate-900 text-white"
                  : "self-start bg-slate-100 text-slate-900"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p
                className={`mt-1 text-xs ${mine ? "text-slate-300" : "text-slate-400"}`}
              >
                {new Date(message.created_at).toLocaleString("bg-BG")}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <MessageThreadForm listingId={listingId} toUserId={otherUserId} />
      </div>
    </div>
  );
}
