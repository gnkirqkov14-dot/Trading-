import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
