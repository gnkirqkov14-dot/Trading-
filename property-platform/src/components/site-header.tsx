import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { Logo } from "@/components/logo";
import { MobileNav, type NavLink } from "@/components/mobile-nav";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sectionLinks: NavLink[] = [
    { href: "/listings?type=sale", label: "Продажби" },
    { href: "/listings?type=rent", label: "Наеми" },
    { href: "/listings", label: "Всички обяви" },
    { href: "/about", label: "За нас" },
  ];

  const accountLinks: NavLink[] = user
    ? [
        { href: "/dashboard", label: "Моят профил" },
        { href: "/dashboard/messages", label: "Съобщения" },
      ]
    : [{ href: "/login", label: "Вход" }];

  const navLinkClassName =
    "whitespace-nowrap rounded-full px-4 py-2 font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <div className="relative mx-auto flex h-[4.75rem] max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center">
          <Logo wordmarkClassName="hidden sm:inline" />
        </Link>

        {/* Широк екран: всичко е на един ред. */}
        <nav className="hidden items-center gap-1 text-[0.92rem] md:flex">
          {sectionLinks.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClassName}>
              {link.label}
            </Link>
          ))}
          <span className="w-2" />
          {accountLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <form action={signOut}>
              <button type="submit" className={navLinkClassName}>
                Изход
              </button>
            </form>
          ) : (
            <Link
              href="/register"
              className="whitespace-nowrap rounded-full bg-slate-900 px-5 py-2.5 font-bold text-white shadow-[0_10px_24px_-12px_rgba(15,36,56,0.8)] transition hover:bg-slate-700"
            >
              Публикувай обява
            </Link>
          )}
        </nav>

        {/* Телефон: само призивът + меню, за да не се чупи на два реда. */}
        <div className="flex items-center gap-2 md:hidden">
          {!user && (
            <Link
              href="/register"
              className="whitespace-nowrap rounded-full bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
            >
              Публикувай
            </Link>
          )}
          <MobileNav
            links={[...sectionLinks, ...accountLinks]}
            isLoggedIn={Boolean(user)}
          />
        </div>
      </div>
    </header>
  );
}
