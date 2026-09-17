"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

export type NavLink = { href: string; label: string };

/**
 * Менюто на телефон. На широк екран линковете стоят в хедъра и този
 * компонент е скрит с `md:hidden` — затова тук няма дублирана логика за
 * breakpoint, само панелът.
 */
export function MobileNav({
  links,
  isLoggedIn,
}: {
  links: NavLink[];
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Затвори менюто" : "Отвори менюто"}
        className="flex h-11 w-11 flex-col items-center justify-center gap-[5px] rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50"
      >
        <span
          className={`block h-0.5 w-[18px] rounded bg-slate-900 transition ${open ? "translate-y-[7px] rotate-45" : ""}`}
        />
        <span
          className={`block h-0.5 w-[18px] rounded bg-slate-900 transition ${open ? "opacity-0" : ""}`}
        />
        <span
          className={`block h-0.5 w-[18px] rounded bg-slate-900 transition ${open ? "-translate-y-[7px] -rotate-45" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-b border-slate-200 bg-white p-4 shadow-lg">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}

            {isLoggedIn ? (
              <form action={signOut} className="mt-1">
                <button
                  type="submit"
                  className="w-full rounded-xl px-4 py-3 text-left font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Изход
                </button>
              </form>
            ) : (
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-xl bg-slate-900 px-4 py-3 text-center font-bold text-white transition hover:bg-slate-700"
              >
                Публикувай обява
              </Link>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
