import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 h-16 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold">
          Имоти без посредници
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href="/dashboard" className="text-slate-700 hover:text-slate-900">
                Моят профил
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Изход
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-slate-700 hover:text-slate-900">
                Вход
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700"
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
