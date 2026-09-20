"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { FB_PIXEL_ID, pixelPageView } from "@/lib/fpixel";

/**
 * Meta (Facebook) Pixel.
 *
 * ⚠️ **Този скрипт слага бисквитка (`_fbp`) и праща данни на Meta.**
 * За разлика от Vercel Analytics (виж `layout.tsx`), това изисква
 * съгласие от посетителя по GDPR и чл. 4б от ЗЕС. Виж бележката в
 * CLAUDE.md, раздел „Meta Pixel". Когато се добави лента за съгласие,
 * единственото, което трябва да се промени тук, е условието в
 * `enabled` по-долу.
 *
 * ⚠️ В App Router навигацията е от страна на браузъра — адресът се
 * сменя без ново зареждане на страницата. Базовият скрипт праща
 * `PageView` веднъж, при първото зареждане; всяко следващо преминаване
 * между страници трябва да се прати ръчно. Точно това прави
 * `PixelTracker`.
 */
function PixelTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Базовият скрипт вече е пратил `PageView` за първата страница.
  // Без този пропуск първото зареждане се брои два пъти.
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    pixelPageView();
  }, [pathname, searchParams]);

  return null;
}

export function MetaPixel() {
  // Без зададен `NEXT_PUBLIC_FB_PIXEL_ID` не се зарежда нищо — в dev
  // и в preview това е нормалното състояние.
  const enabled = Boolean(FB_PIXEL_ID);
  if (!enabled) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${FB_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
      {/* `useSearchParams` кара всичко над себе си да се рендира в
          браузъра, ако не е зад Suspense. Затова следенето живее в
          отделен компонент — иначе цялата страница губи сървърното
          рендиране. */}
      <Suspense fallback={null}>
        <PixelTracker />
      </Suspense>
    </>
  );
}
