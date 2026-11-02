"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Покана за регистрация след 30 секунди скролване.
 *
 * Брои само секундите, в които човекът наистина скролва, а не всяко
 * стоене на страницата, и брои през страниците на едно отваряне на сайта.
 * Екранът се замъглява леко и може да се затвори с „Не сега“; тогава
 * броенето започва отначало.
 *
 * Сесията се проверява чак накрая: гледа бисквитката и не прави заявка.
 */

const SEKUNDI = 30;
const SKROL_VALIDEN_MS = 5000;
const KLUCH = "ip_skrol_sek";

function procheti() {
  try {
    return Number(sessionStorage.getItem(KLUCH)) || 0;
  } catch {
    return 0;
  }
}

function zapishi(sek: number) {
  try {
    sessionStorage.setItem(KLUCH, String(sek));
  } catch {
    /* без sessionStorage броенето просто не се пази между страниците */
  }
}

export function RegistraciyaSledSkrol() {
  const pathname = usePathname();
  const [otvoren, setOtvoren] = useState(false);

  // Само в списъците с обяви. Формите и профилът не се пипат, а отворената
  // обява има своя стена (`zadalzhitelna-registraciya.tsx`).
  const razreshena =
    pathname === "/" ||
    pathname === "/listings" ||
    pathname.startsWith("/imoti");
  const pokazan = otvoren && razreshena;

  useEffect(() => {
    if (!razreshena || otvoren) return;

    let posledenSkrol = 0;
    const naSkrol = () => {
      posledenSkrol = Date.now();
    };
    window.addEventListener("scroll", naSkrol, { passive: true });

    const tiktak = setInterval(async () => {
      if (document.hidden || Date.now() - posledenSkrol > SKROL_VALIDEN_MS) {
        return;
      }
      const sek = procheti() + 1;
      zapishi(sek);
      if (sek < SEKUNDI) return;

      clearInterval(tiktak);
      const { data } = await createClient().auth.getSession();
      if (!data.session) setOtvoren(true);
    }, 1000);

    return () => {
      window.removeEventListener("scroll", naSkrol);
      clearInterval(tiktak);
    };
  }, [razreshena, otvoren]);

  useEffect(() => {
    if (!pokazan) return;
    const predishen = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = predishen;
    };
  }, [pokazan]);

  if (!pokazan) return null;

  function neSega() {
    zapishi(0);
    setOtvoren(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="registraciya-zaglavie"
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 p-4 backdrop-blur-[3px]"
    >
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_24px_60px_-20px_rgba(15,36,56,0.45)]">
        <h2
          id="registraciya-zaglavie"
          className="font-display text-2xl font-semibold text-slate-900"
        >
          Продължи да разглеждаш безплатно
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Регистрацията е безплатна и отнема минута. Така виждаш пълните детайли
          и пишеш директно на собствениците.
        </p>
        <Link
          href="/register"
          className="mt-5 block rounded-full bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-700"
        >
          Регистрирай се
        </Link>
        <Link
          href="/login"
          className="mt-2 block rounded-full border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Вече имам профил
        </Link>
        <button
          type="button"
          onClick={neSega}
          className="mt-3 text-sm text-slate-500 underline-offset-2 hover:underline"
        >
          Не сега
        </button>
      </div>
    </div>
  );
}
