import Link from "next/link";
import { strParam } from "@/lib/format";
import { unsubscribe } from "../actions";

export const metadata = { title: "Отписване", robots: { index: false } };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const token = strParam(p.token) ?? "";
  if (strParam(p.done)) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
        <h1 className="text-2xl font-bold">Отписахте се</h1>
        <p className="text-slate-600">Няма да получавате повече писма от нас.</p>
        <Link href="/alerts" className="font-medium text-brand-600 hover:underline">
          Абонирайте се отново
        </Link>
      </div>
    );
  }
  return (
    <form action={unsubscribe} className="mx-auto max-w-xl space-y-4 py-10 text-center">
      <h1 className="text-2xl font-bold">Спиране на известията</h1>
      <input type="hidden" name="token" value={token} />
      <button className="rounded-lg bg-slate-800 px-5 py-2 font-semibold text-white hover:bg-slate-900">
        Отпиши ме
      </button>
    </form>
  );
}
