"use client";

import { useEffect, useRef } from "react";
import { pixelEvent } from "@/lib/fpixel";

/**
 * Праща едно събитие към Meta Pixel при показване на страницата.
 *
 * Съществува, защото страниците са сървърни компоненти, а `fbq` живее
 * в браузъра. Вместо всяка такава страница да става клиентска, тя
 * рендира този малък компонент.
 *
 * ⚠️ Пази се от двойно пращане: в dev React монтира компонентите два
 * пъти нарочно (Strict Mode), а без `sent` събитието щеше да излиза
 * два пъти и в Events Manager.
 *
 * ⚠️ В `params` не влизат лични данни — виж бележката в `lib/fpixel.ts`.
 */
export function PixelEvent({
  name,
  params,
}: {
  name: string;
  params?: Record<string, unknown>;
}) {
  const sent = useRef(false);
  // Обектът се пресъздава при всяко рендиране; ако влезе в масива с
  // зависимости, ефектът тръгва наново без нужда. `useRef` запомня
  // стойността от първото рендиране — точно тази, която ни трябва,
  // защото събитието е еднократно.
  const payload = useRef(params);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    pixelEvent(name, payload.current ?? {});
  }, [name]);

  return null;
}
