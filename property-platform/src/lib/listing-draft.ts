import type { ListingDealType, PropertyType } from "@/lib/types/database";

/**
 * Общото между въпросника (`components/ai-listing-wizard.tsx`) и route-а,
 * който вика Claude (`app/api/listing-assistant/route.ts`).
 *
 * Черновата е с полета-низове там, където формата държи низове — така
 * влиза директно в `NewListingForm` без превод по средата и без риск
 * "3" да стане 3 на едно място и "3.0" на друго.
 */

export type DraftSettlement = {
  id: string;
  name: string;
  region: string;
  municipality: string | null;
  is_village: boolean;
};

export type ListingDraft = {
  type: ListingDealType;
  propertyType: PropertyType;
  settlement: DraftSettlement | null;
  neighborhoodId: string;
  address: string;
  price: string;
  areaSqm: string;
  rooms: string;
  floor: string;
  yearBuilt: string;
  heating: string;
  hasParking: boolean;
  hasElevator: boolean;
  hasTerrace: boolean;
  isFurnished: boolean;
  title: string;
  description: string;
  /** Какво помощникът не е успял да разбере — показва се на човека, за да го допълни. */
  notes: string[];
};

/** Колко отговора приема route-ът. Въпросите са 6 — повече хора се отказват. */
export const WIZARD_STEPS = 6;

/** Таван на един отговор. По-дълъг текст почти винаги е поставено съдържание. */
export const MAX_ANSWER_CHARS = 600;

/** Колко снимки отиват към Claude за разчитане (всички качени влизат в обявата). */
export const MAX_AI_PHOTOS = 5;

export type WizardQuestion = {
  key: string;
  question: string;
  hint: string;
  placeholder: string;
  /** Въпрос, на който може да се мине нататък без отговор. */
  optional?: boolean;
};

/**
 * Въпросите са на човешки език, не на езика на формата. Полетата
 * (тип имот, квадратура, етаж, отопление) ги вади Claude от отговорите —
 * затова един въпрос покрива няколко полета наведнъж.
 */
export const WIZARD_QUESTIONS: WizardQuestion[] = [
  {
    key: "what",
    question: "Какво е имотът и къде се намира?",
    hint: "Пиши както ти дойде — тип имот, град или село, квартал, улица.",
    placeholder: "Тристаен апартамент в Пловдив, кв. Кючук Париж, до парка",
  },
  {
    key: "size",
    question: "Колко е голям и на кой етаж е?",
    hint: "Квадратура, брой стаи, етаж, а ако знаеш — и година на строеж.",
    placeholder: "86 кв.м, 3 стаи, 4-ти етаж от 6, строен 2008 г.",
  },
  {
    key: "inside",
    question: "Какво има в имота?",
    hint: "Отопление, обзавеждане, паркомясто, асансьор, тераса, мазе.",
    placeholder: "ТЕЦ, обзаведен, с тераса и паркомясто, има асансьор",
  },
  {
    key: "best",
    question: "Кое е най-хубавото на този имот?",
    hint: "Това става сърцето на описанието — какво ще хареса на хората.",
    placeholder: "Много слънчев, тихо място, до училище и спирка, нов ремонт",
  },
  {
    key: "price",
    question: "Каква цена искаш?",
    hint: "В евро. Ако е под наем — на месец.",
    placeholder: "145000",
  },
  {
    key: "extra",
    question: "Има ли още нещо, което да кажем?",
    hint: "Може и да прескочиш този въпрос.",
    placeholder: "Свободен от септември, може и с домашен любимец",
    optional: true,
  },
];
