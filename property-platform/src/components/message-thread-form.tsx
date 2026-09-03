"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "@/lib/actions/messages";

export function MessageThreadForm({
  listingId,
  toUserId,
}: {
  listingId: string;
  toUserId: string;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await sendMessage({ toUserId, listingId, content });
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
