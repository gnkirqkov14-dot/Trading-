"use client";

import Link from "next/link";
import { FB_PIXEL_ID } from "@/lib/fpixel";
import { useSaglasie, zapishiSaglasie } from "@/lib/saglasie";

/**
 * Лентата за съгласие с бисквитките на Meta Pixel (GDPR, чл. 4б ЗЕС).
 *
 * Показва се, докато посетителят не избере. Двата бутона са еднакво
 * големи и еднакво лесни: отказът не бива да е по-труден от приемането.
 * Изборът се сменя от „Бисквитки“ в долната част на сайта.
 *
 * Без `NEXT_PUBLIC_FB_PIXEL_ID` няма какво да се пита и лентата я няма.
 */
export function BiskvitkiLenta() {
  const saglasie = useSaglasie();
  if (!FB_PIXEL_ID || saglasie !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Бисквитки"
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-slate-200 bg-white p-4 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.35)]"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <p className="flex-1 text-sm text-slate-700">
          Искаме да ползваме бисквитки на Meta (Facebook), за да мерим
          рекламите си. Те пращат на Meta кои страници гледаш. Сайтът работи
          изцяло и без тях.{" "}
          <Link href="/poveritelnost" className="underline underline-offset-2">
            Повече
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => zapishiSaglasie("ne")}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 sm:flex-none"
          >
            Отказвам
          </button>
          <button
            type="button"
            onClick={() => zapishiSaglasie("da")}
            className="flex-1 rounded-lg border border-slate-900 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 sm:flex-none"
          >
            Приемам
          </button>
        </div>
      </div>
    </div>
  );
}

/** Връзката в долната част на сайта: показва лентата отново. */
export function BiskvitkiVrazka() {
  if (!FB_PIXEL_ID) return null;
  return (
    <button
      type="button"
      onClick={() => zapishiSaglasie(null)}
      className="hover:text-slate-900"
    >
      Бисквитки
    </button>
  );
}
