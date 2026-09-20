"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "@/lib/actions/messages";
import { pixelEvent } from "@/lib/fpixel";

/**
 * ⚠️ `isFirstContact` идва от страницата, защото само тя знае дали в
 * разговора вече има съобщение от този потребител. Без него `Lead` щеше
 * да се праща на всяка реплика и една дълга кореспонденция щеше да
 * изглежда като двайсет отделни контакта в Events Manager.
 */
export function MessageThreadForm({
  listingId,
  toUserId,
  isFirstContact = false,
}: {
  listingId: string;
  toUserId: string;
  isFirstContact?: boolean;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Пази от повторно броене, ако човекът напише две съобщения подред,
  // преди страницата да се презареди.
  const contacted = useRef(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await sendMessage({ toUserId, listingId, content });
      if (isFirstContact && !contacted.current) {
        contacted.current = true;
        pixelEvent("Lead", {
          content_type: "product",
          content_ids: [listingId],
        });
      }
      setContent("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Грешка.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Напиши съобщение…"
        className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-end rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "Изпращане…" : "Изпрати"}
      </button>
    </form>
  );
}
