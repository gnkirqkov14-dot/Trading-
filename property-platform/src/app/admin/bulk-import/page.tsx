import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/dal";
import { BulkImport } from "@/components/bulk-import";

export const metadata = { title: "Пакетно внасяне на обяви" };

export default async function BulkImportPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/admin" className="text-sm text-slate-600 underline underline-offset-4">Към админ панела</Link>
      <h1 className="mt-5 text-3xl font-semibold text-slate-900">Пакетно внасяне на обяви</h1>
      <p className="mt-3 max-w-2xl text-slate-600">Избери папката с имотите или ZIP архив. Във всяка подпапка трябва да има Описание.txt и снимки. Провери данните, избери обявите и ги публикувай наведнъж.</p>
      <details className="mt-4 max-w-2xl rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <summary className="cursor-pointer font-semibold text-slate-900">Удобства и отопление в Описание.txt</summary>
        <p className="mt-2">Под „Вид имот:“ добави редовете, които са потвърдени от обявата или снимките. Пропуснатите остават „Не е посочено“.</p>
        <pre className="mt-2 rounded bg-slate-50 p-3 text-xs">{`Паркомясто: Да
Асансьор: Не
Тераса: Не е посочено
Обзавеждане: Да
Отопление: ТЕЦ или климатик`}</pre>
        <p className="mt-2">Стойности: Да, Не или Не е посочено (за обзавеждане и Обзаведен / Необзаведен). Отоплението се записва точно както е написано. Ако ред липсва, ясно казаното в текста („с асансьор“, „без тераса“) се взима и в прегледа пише „(от текста)“.</p>
      </details>
      <BulkImport />
    </div>
  );
}
