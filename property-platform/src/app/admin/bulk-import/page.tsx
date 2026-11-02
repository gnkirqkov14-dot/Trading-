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
      <BulkImport />
    </div>
  );
}
