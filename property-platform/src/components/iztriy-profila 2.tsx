"use client";

import { useState } from "react";
import { deleteAccount } from "@/lib/actions/profile";

const DUMA = "ИЗТРИЙ";

/**
 * „Изтрий профила ми“ в настройките. Изтриването не се връща, затова
 * иска две стъпки: отваряне и изписване на думата.
 */
export function IztriyProfila() {
  const [otvoreno, setOtvoreno] = useState(false);
  const [duma, setDuma] = useState("");
  const [greshka, setGreshka] = useState<string | null>(null);
  const [triene, setTriene] = useState(false);

  async function iztriy() {
    setGreshka(null);
    setTriene(true);
    const rezultat = await deleteAccount();
    // При успех действието препраща към началната страница.
    if (rezultat?.error) {
      setGreshka(rezultat.error);
      setTriene(false);
    }
  }

  return (
    <section className="mt-12 border-t border-slate-200 pt-6">
      <h2 className="text-lg font-semibold text-slate-900">
        Изтриване на профила
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Изтриват се профилът, всичките ти обяви със снимките и съобщенията
        ти. Това не може да се върне.
      </p>

      {!otvoreno ? (
        <button
          type="button"
          onClick={() => setOtvoreno(true)}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Изтрий профила ми
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <label className="text-sm text-slate-800">
            За да потвърдиш, напиши <strong>{DUMA}</strong>:
            <input
              value={duma}
              onChange={(e) => setDuma(e.target.value)}
              autoComplete="off"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
            />
          </label>
          {greshka && <p className="text-sm text-red-700">{greshka}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={iztriy}
              disabled={triene || duma.trim().toUpperCase() !== DUMA}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {triene ? "Изтриване…" : "Изтрий завинаги"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOtvoreno(false);
                setDuma("");
                setGreshka(null);
              }}
              disabled={triene}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Отказ
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
