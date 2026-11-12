"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { FB_PIXEL_ID, pixelPageView } from "@/lib/fpixel";
import { useSaglasie } from "@/lib/saglasie";

/**
 * Meta (Facebook) Pixel.
 *
 * ⚠️ **Този скрипт слага бисквитка (`_fbp`) и праща данни на Meta.**
 * По GDPR и чл. 4б от ЗЕС това иска предварително съгласие. Затова
 * нищо от Meta не се зарежда, докато посетителят не натисне „Приемам“
 * в `BiskvitkiLenta` (изборът се пази от `lib/saglasie.ts`). Събитията
 * преди съгласието не се пращат и не се наваксват.
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
  // и в preview това е нормалното състояние. Без съгласие също.
  const saglasie = useSaglasie();
  if (!FB_PIXEL_ID || saglasie !== "da") return null;

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
fbq('consent', 'grant');
fbq('init', '${FB_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
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
