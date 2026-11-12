"use client";

import { useSyncExternalStore } from "react";

/**
 * Изборът на посетителя за бисквитките на Meta Pixel.
 *
 * Пази се в localStorage на неговия браузър, не в базата: "da", "ne"
 * или нищо, докато не е избрал. Самият запис не е бисквитка за следене,
 * а е нужен, за да не го питаме на всяка страница, затова не иска
 * съгласие.
 *
 * Докато няма "da", `MetaPixel` не зарежда нищо от Meta.
 */
export type Saglasie = "da" | "ne" | null;

const KLUCH = "ip_biskvitki";
const SABITIE = "ip-biskvitki";

function procheti(): Saglasie {
  try {
    const v = localStorage.getItem(KLUCH);
    return v === "da" || v === "ne" ? v : null;
  } catch {
    // Забранен localStorage (частен режим): броим го за „не е избрал“.
    return null;
  }
}

function slushay(izvikay: () => void) {
  window.addEventListener(SABITIE, izvikay);
  window.addEventListener("storage", izvikay);
  return () => {
    window.removeEventListener(SABITIE, izvikay);
    window.removeEventListener("storage", izvikay);
  };
}

/** Маха бисквитките на Meta, когато човек откаже след като е приел. */
function iztriyBiskvitkiteNaMeta() {
  const domeyn = location.hostname.replace(/^www\./, "");
  for (const ime of ["_fbp", "_fbc"]) {
    document.cookie = `${ime}=; Max-Age=0; path=/`;
    document.cookie = `${ime}=; Max-Age=0; path=/; domain=.${domeyn}`;
  }
}

export function zapishiSaglasie(izbor: Saglasie) {
  try {
    if (izbor) localStorage.setItem(KLUCH, izbor);
    else localStorage.removeItem(KLUCH);
  } catch {
    // Без localStorage изборът важи само докато страницата е отворена.
  }
  if (izbor === "da") {
    // Ако скриптът вече е зареден (приел, отказал, пак приел), той не
    // се пуска втори път, затова му казваме изрично.
    window.fbq?.("consent", "grant");
  } else {
    window.fbq?.("consent", "revoke");
    iztriyBiskvitkiteNaMeta();
  }
  window.dispatchEvent(new Event(SABITIE));
}

/**
 * Текущият избор. На сървъра и при първото рисуване е `undefined`
 * („още не знаем“), за да не мигне лентата на човек, който вече е избрал.
 */
export function useSaglasie(): Saglasie | undefined {
  return useSyncExternalStore<Saglasie | undefined>(
    slushay,
    procheti,
    () => undefined,
  );
}
