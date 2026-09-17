import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

// Geist няма кирилица — досега целият български текст падаше на
// системния шрифт на браузъра и се разминаваше между Windows и Mac.
//
// ⚠️ Първо опитахме Manrope, но неговата кирилица е с българските
// ръкописни форми (`д` като `g`, `и` като `u`, `т` като `m`). Те са
// исторически коректни, но в дълъг текст на екран са необичайни за
// повечето читатели. Inter изписва обичайните изправени форми.
const inter = Inter({
  variable: "--font-sans-brand",
  subsets: ["latin", "cyrillic"],
});

// Само за едрите заглавия (`font-display` в Tailwind) — серифът дава
// характера, който отличава сайта от стандартните шаблони.
const playfair = Playfair_Display({
  variable: "--font-display-brand",
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotpoint.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Имоти без посредници",
    template: "%s | Имоти без посредници",
  },
  description: "Обяви за имоти директно от собственик — без агенции.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Имоти без посредници",
    description: "Обяви за имоти директно от собственик — без агенции.",
    type: "website",
    locale: "bg_BG",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="bg"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
        {/* Vercel Web Analytics — брои реални посетители (кои страници,
            откъде идват), за разлика от Observability таблото, което
            брои технически заявки. Без бисквитки и без лични данни, за
            да не се налага cookie банер по GDPR. Скриптът се зарежда
            само в production; в dev компонентът не прави нищо. */}
        <Analytics />
      </body>
    </html>
  );
}
