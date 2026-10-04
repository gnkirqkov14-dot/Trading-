import Link from "next/link";
import { strParam } from "@/lib/format";
import { confirm } from "../actions";

export const metadata = { title: "Потвърждение", robots: { index: false } };

// Потвърждаването е с бутон, а не направо при отваряне на връзката:
// някои пощенски програми сами отварят връзките в писмата, за да ги
// проверят, и така биха абонирали човек, който не е искал.
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const token = strParam(p.token) ?? "";
  if (strParam(p.done)) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
        <h1 className="text-2xl font-bold">Готово</h1>
        <p className="text-slate-600">Известията са включени. Първото писмо идва със следващите нови поръчки.</p>
        <Link href="/" className="font-medium text-brand-600 hover:underline">
          Към поръчките
        </Link>
      </div>
    );
  }
  return (
    <form action={confirm} className="mx-auto max-w-xl space-y-4 py-10 text-center">
      <h1 className="text-2xl font-bold">Потвърдете известията</h1>
      <input type="hidden" name="token" value={token} />
      <button className="rounded-lg bg-brand-600 px-5 py-2 font-semibold text-white hover:bg-brand-700">
        Да, искам известията
      </button>
    </form>
  );
}
