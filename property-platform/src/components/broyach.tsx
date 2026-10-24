"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Брояч на посещенията за /admin/statistika.
 *
 * Анонимен: случаен идентификатор в localStorage (посетител) и в
 * sessionStorage (едно отваряне на сайта). Пише се адресът, откъде е
 * дошъл човекът, телефон или компютър и колко секунди страницата е била
 * видима. Без IP и без лични данни.
 *
 * Пише направо в Supabase през две функции, а не през сървъра на сайта —
 * всяко извикване към Vercel се брои в лимитите му.
 */

const PULS_SEK = 15;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function id(storage: Storage, kluch: string) {
  try {
    let v = storage.getItem(kluch);
    if (!v) {
      v = crypto.randomUUID();
      storage.setItem(kluch, v);
    }
    return v;
  } catch {
    return crypto.randomUUID();
  }
}

// Откъде е дошъл: utm_source от рекламата, иначе домейнът на препращащия
// сайт, сведен до познато име. Вътрешните преходи не са източник.
function iztochnik() {
  const utm = new URLSearchParams(location.search).get("utm_source");
  if (utm) return utm.toLowerCase();
  if (!document.referrer) return "";
  try {
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    if (host === location.hostname) return "";
    if (/facebook|fb\.|messenger|instagram/.test(host)) return "facebook";
    if (/google\./.test(host)) return "google";
    return host;
  } catch {
    return "";
  }
}

export function Broyach() {
  const pathname = usePathname();

  useEffect(() => {
    // Админът и ботовете не са посетители.
    if (!pathname || pathname.startsWith("/admin")) return;
    if (/bot|crawl|spider|preview|lighthouse/i.test(navigator.userAgent))
      return;

    const supabase = createClient();
    const posetitel = id(localStorage, "ip_posetitel");
    const sesiya = id(sessionStorage, "ip_sesiya");
    // Източникът се помни за цялата сесия — иначе при втората страница
    // човек от Facebook става „директно“.
    let izt = "";
    try {
      izt = sessionStorage.getItem("ip_iztochnik") ?? iztochnik();
      sessionStorage.setItem("ip_iztochnik", izt);
    } catch {
      izt = iztochnik();
    }
    const ustroistvo = /Mobi|Android|iPhone/i.test(navigator.userAgent)
      ? "телефон"
      : "компютър";
    const listing = pathname.match(/^\/listings\/([^/]+)$/)?.[1];

    let zapisId: string | null = null;
    let vidimi = 0;
    let ot = document.visibilityState === "visible" ? Date.now() : 0;
    const sekundi = () =>
      Math.round((vidimi + (ot ? Date.now() - ot : 0)) / 1000);

    const pulse = () => {
      if (!zapisId) return;
      // Заявката на supabase-js тръгва чак при .then — без него пулсът
      // никога не стигаше до базата и времето оставаше 0.
      supabase
        .rpc("poseshtenie_pulse", { p_id: zapisId, p_sekundi: sekundi() })
        .then(() => {});
    };

    void supabase
      .rpc("poseshtenie_nachalo", {
        p_posetitel: posetitel,
        p_sesiya: sesiya,
        p_pat: pathname,
        p_listing: listing && UUID.test(listing) ? listing : null,
        p_iztochnik: izt,
        p_ustroistvo: ustroistvo,
      })
      .then(({ data }) => {
        zapisId = (data as string | null) ?? null;
      });

    const tik = setInterval(() => {
      if (document.visibilityState === "visible") pulse();
    }, PULS_SEK * 1000);

    const vidimost = () => {
      if (document.visibilityState === "hidden") {
        if (ot) vidimi += Date.now() - ot;
        ot = 0;
        pulse();
      } else {
        ot = Date.now();
      }
    };
    document.addEventListener("visibilitychange", vidimost);

    return () => {
      clearInterval(tik);
      document.removeEventListener("visibilitychange", vidimost);
      pulse();
    };
  }, [pathname]);

  return null;
}
