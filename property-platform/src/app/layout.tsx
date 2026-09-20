import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AiAssistant } from "@/components/assistant/ai-assistant";
import { MetaPixel } from "@/components/meta-pixel";
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
  // Верификация на домейна пред Meta (Business Settings → Brand Safety →
  // Domains). Нужна е, преди да тръгнат реклами — иначе Meta не
  // позволява да се настройват събитията на пиксела за този домейн.
  // Стои в кода, а не като DNS запис, за да се вижда и да не се загуби
  // при смяна на домейн. Излиза като
  // `<meta name="facebook-domain-verification" content="...">`.
  verification: {
    other: {
      "facebook-domain-verification": "h8hgvqzzlhh3l44bzhj578384fer6r",
    },
  },
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
        {/* Плаващият 3D помощник върви с посетителя по всяка страница.
            Ключът за AI-я стои само на сървъра — тук пращаме единствено
            дали изобщо е настроен, за да не показваме поле за въпроси,
            което няма как да отговори. */}
        <AiAssistant aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)} />
        {/* Vercel Web Analytics — брои реални посетители (кои страници,
            откъде идват), за разлика от Observability таблото, което
            брои технически заявки. Без бисквитки и без лични данни, за
            да не се налага cookie банер по GDPR. Скриптът се зарежда
            само в production; в dev компонентът не прави нищо. */}
        <Analytics />
        {/* Meta (Facebook) Pixel — за рекламите във Facebook/Instagram.
            ⚠️ За разлика от Vercel Analytics отгоре, ТОЙ слага
            бисквитка и праща данни на Meta, тоест изисква съгласие по
            GDPR. Виж CLAUDE.md, раздел „Meta Pixel". Зарежда се само
            ако `NEXT_PUBLIC_FB_PIXEL_ID` е зададен. */}
        <MetaPixel />
      </body>
    </html>
  );
}
