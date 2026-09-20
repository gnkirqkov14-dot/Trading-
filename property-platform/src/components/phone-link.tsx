"use client";

import { pixelEvent } from "@/lib/fpixel";

/**
 * Телефонът на собственика в обявата. Изнесен като отделен клиентски
 * компонент само за да може натискането да се отчете като `Contact`
 * към Meta Pixel — това е най-близкото до „сделка" действие, което
 * сайтът може да измери, и е събитието, по което се оптимизират
 * рекламите.
 *
 * ⚠️ Самият номер НЕ се праща към Meta — той е личен данни. Пращат се
 * само id-то на обявата и градът.
 */
export function PhoneLink({
  phone,
  listingId,
  city,
}: {
  phone: string;
  listingId: string;
  city?: string | null;
}) {
  return (
    <a
      href={`tel:${phone}`}
      className="hover:underline"
      onClick={() =>
        pixelEvent("Contact", {
          content_type: "property",
          content_ids: [listingId],
          ...(city ? { city } : {}),
        })
      }
    >
      {phone}
    </a>
  );
}
