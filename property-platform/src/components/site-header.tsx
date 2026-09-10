import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { Logo } from "@/components/logo";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const navLinkClassName =
    "whitespace-nowrap rounded-full border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50";

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-3 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center">
          <Logo wordmarkClassName="hidden sm:inline" />
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/listings" className={navLinkClassName}>
            Обяви
          </Link>
          <Link href="/pricing" className={navLinkClassName}>
            Планове
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className={navLinkClassName}>
                Моят профил
              </Link>
              <Link href="/dashboard/messages" className={navLinkClassName}>
                Съобщения
              </Link>
              <form action={signOut}>
                <button type="submit" className={navLinkClassName}>
                  Изход
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={navLinkClassName}>
                Вход
              </Link>
              <Link
                href="/register"
                className="whitespace-nowrap rounded-full bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700"
              >
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
