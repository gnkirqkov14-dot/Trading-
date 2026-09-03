import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:justify-between">
        <Logo />

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/listings" className="hover:text-slate-900">
            Обяви
          </Link>
          <Link href="/pricing" className="hover:text-slate-900">
            Планове
          </Link>
          <Link href="/register" className="hover:text-slate-900">
            Публикувай безплатно
          </Link>
        </nav>

        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} Имоти без посредници
        </p>
      </div>
    </footer>
  );
}
