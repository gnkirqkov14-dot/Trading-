import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_NAME, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";
import "./globals.css";

// Inter има кирилица с обичайните изправени форми (виж бележката за
// шрифтовете в property-platform/CLAUDE.md).
const inter = Inter({ variable: "--font-sans-brand", subsets: ["latin", "cyrillic"] });

const description =
  "Всички нови обществени поръчки в България всяка сутрин: търсене по бранш, област и бюджет, известия по имейл и данни за AI агенти.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — обществени поръчки в България`, template: `%s | ${SITE_NAME}` },
  description,
  alternates: { canonical: "/" },
  openGraph: { title: SITE_NAME, description, type: "website", locale: "bg_BG" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bg" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="whitespace-nowrap text-lg font-bold text-brand-700">
              {SITE_NAME}
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
              <Link href="/" className="hidden hover:text-brand-600 sm:inline">
                Поръчки
              </Link>
              <Link
                href="/alerts"
                className="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 text-white hover:bg-brand-700"
              >
                <span className="sm:hidden">Известия</span>
                <span className="hidden sm:inline">Известия по имейл</span>
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl space-y-2 px-4 py-8 text-sm text-slate-500">
            <p>
              Данните са от отворените данни на{" "}
              <a className="underline" href="https://app.eop.bg/today/reporting/open-data">
                ЦАИС ЕОП
              </a>{" "}
              на Агенцията по обществени поръчки и се обновяват всяка сутрин. Преди да
              кандидатствате, проверявайте условията на официалната страница на поръчката.
            </p>
            <p>
              <Link className="underline" href="/api/agent">
                Достъп за AI агенти и програми
              </Link>
              {SUPPORT_EMAIL ? (
                <>
                  {" · "}
                  <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
                    {SUPPORT_EMAIL}
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
