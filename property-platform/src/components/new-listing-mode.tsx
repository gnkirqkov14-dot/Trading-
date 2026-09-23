"use client";

import { useState } from "react";
import { AiListingWizard } from "@/components/ai-listing-wizard";
import { NewListingForm } from "@/components/new-listing-form";
import { WIZARD_QUESTIONS, type ListingDraft } from "@/lib/listing-draft";

type Neighborhood = { id: string; city_id: string; name: string };

/**
 * Страницата "Нова обява": обикновената форма плюс помощникът отстрани.
 *
 * Формата е това, което човекът вижда пръв — качването на обява не зависи
 * от помощника. Той стои в карта встрани и се пуска само ако някой го
 * поиска; тогава връща чернова, която влиза в същата форма. Така обявата
 * винаги минава през едни и същи проверки и човекът я вижда, преди да я
 * публикува.
 */
export function NewListingMode({
  userId,
  neighborhoods,
  profilePhone,
  aiEnabled,
}: {
  userId: string;
  neighborhoods: Neighborhood[];
  profilePhone: string;
  /** Без ключ за Claude помощникът просто го няма — формата си работи. */
  aiEnabled: boolean;
}) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [draftsLeft, setDraftsLeft] = useState<number | null>(null);

  if (wizardOpen) {
    return (
      <div className="mx-auto max-w-2xl">
        <AiListingWizard
          onReady={(nextDraft, nextPhotos, left) => {
            setDraft(nextDraft);
            setPhotos(nextPhotos);
            setDraftsLeft(left);
            setWizardOpen(false);
          }}
          onManual={() => setWizardOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* На телефон картата излиза над формата — иначе никой няма да я
          види чак след всички полета. На широк екран отива вдясно и
          върви с превъртането, спирайки под sticky хедъра (77px). */}
      {aiEnabled && !draft && (
        <aside className="lg:sticky lg:top-24 lg:order-2 lg:w-72 lg:shrink-0">
          <div className="rounded-xl border border-slate-900 bg-slate-900 px-5 py-5 text-white">
            <p className="text-base font-semibold">
              Да я попълня вместо теб?
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Отговаряш на {WIZARD_QUESTIONS.length} въпроса на нормален
              език и качваш снимките. Аз описвам имота и попълвам полетата,
              а ти проверяваш всичко преди публикуване.
            </p>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="mt-4 w-full rounded-lg bg-white px-4 py-2.5 font-medium text-slate-900 transition hover:bg-slate-200"
            >
              Помогни ми с въпроси
            </button>
          </div>
        </aside>
      )}

      <div className="min-w-0 flex-1 lg:order-1">
        <NewListingForm
          userId={userId}
          neighborhoods={neighborhoods}
          profilePhone={profilePhone}
          draft={draft}
          initialPhotos={photos}
          draftsLeft={draftsLeft}
        />
      </div>
    </div>
  );
}
