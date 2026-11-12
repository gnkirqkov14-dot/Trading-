"use client";

import { useState } from "react";
import { pokazhiTelefon } from "@/lib/actions/telefon";
import { PhoneLink } from "@/components/phone-link";
import { Turnstile } from "@/components/turnstile";

/**
 * Телефонът зад „Покажи телефона“ + проверка „не съм робот“. Номерът не е
 * в страницата, докато проверката не мине — идва от сървъра след нея.
 */
export function TelefonSProverka({
  listingId,
  city,
}: {
  listingId: string;
  city?: string | null;
}) {
  const [otvoren, setOtvoren] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [greshka, setGreshka] = useState<string | null>(null);
  const [opit, setOpit] = useState(0);

  if (phone) {
    return <PhoneLink phone={phone} listingId={listingId} city={city} />;
  }

  async function sZheton(token: string) {
    if (!token) return;
    const otgovor = await pokazhiTelefon(listingId, token);
    if ("phone" in otgovor) {
      setPhone(otgovor.phone);
    } else {
      setGreshka(otgovor.error);
    }
  }

  if (!otvoren) {
    return (
      <button
        type="button"
        onClick={() => setOtvoren(true)}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        Покажи телефона
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {greshka ? (
        <>
          <p className="text-sm font-normal text-red-700">{greshka}</p>
          <button
            type="button"
            onClick={() => {
              setGreshka(null);
              setOpit((n) => n + 1);
            }}
            className="self-start text-sm font-medium text-slate-900 underline"
          >
            Опитай пак
          </button>
        </>
      ) : (
        <p className="text-sm font-normal text-slate-500">
          Проверяваме, че не си робот…
        </p>
      )}
      <Turnstile onToken={sZheton} resetKey={opit} />
    </div>
  );
}
