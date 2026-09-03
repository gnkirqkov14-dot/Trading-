import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <Logo />
      <div>
        <p className="text-sm font-medium text-emerald-600">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Тази страница не съществува
        </h1>
        <p className="mt-2 max-w-sm text-slate-500">
          Обявата може да е изтрита или адресът е сгрешен. Провери отново
          или разгледай наличните обяви.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white transition hover:bg-slate-700"
        >
          Начална страница
        </Link>
        <Link
          href="/listings"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Разгледай обяви
        </Link>
      </div>
    </div>
  );
}
