"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEAL_TYPE_LABELS,
  MAX_LISTING_PHOTOS,
  MIN_LISTING_PHOTOS_HINT,
} from "@/lib/listing-labels";
import {
  MAX_AI_PHOTOS,
  MAX_ANSWER_CHARS,
  WIZARD_QUESTIONS,
  type ListingDraft,
} from "@/lib/listing-draft";
import type { ListingDealType } from "@/lib/types/database";

/**
 * Въпросникът за качване на обява с помощ.
 *
 * Шест въпроса на нормален език плюс снимките; отговорите отиват към
 * `/api/listing-assistant`, а оттам се връща попълнена черновa, която
 * човекът вижда в обикновената форма и поправя. Нищо не се публикува
 * от тук.
 *
 * Снимките се пращат смалени до 1024px — моделът чете еднакво добре
 * смалена снимка, а голямата само оскъпява заявката и бави телефона.
 */

const AI_PHOTO_MAX_EDGE = 1024;
const AI_PHOTO_QUALITY = 0.7;

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900";

async function shrinkForAi(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    AI_PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL("image/jpeg", AI_PHOTO_QUALITY);
  const data = dataUrl.split(",")[1];
  return data ? { media_type: "image/jpeg", data } : null;
}

export function AiListingWizard({
  onReady,
  onManual,
}: {
  onReady: (draft: ListingDraft, photos: File[], remaining: number | null) => void;
  onManual: () => void;
}) {
  // Стъпка 0 е сделката (два бутона), 1..6 са въпросите, 7 са снимките.
  const [step, setStep] = useState(0);
  const [dealType, setDealType] = useState<ListingDealType>("sale");
  const [answers, setAnswers] = useState<string[]>(
    () => WIZARD_QUESTIONS.map(() => ""),
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  // Полето е едно и също за всички въпроси, затова `autoFocus` хваща само
  // първия. Без това фокусът остава върху "Напред" и следващият написан
  // интервал го натиска отново — въпрос се прескача.
  useEffect(() => {
    answerRef.current?.focus();
  }, [step]);

  const previews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos],
  );

  const questionIndex = step - 1;
  const question = WIZARD_QUESTIONS[questionIndex];
  const photosStep = step === WIZARD_QUESTIONS.length + 1;

  function setAnswer(value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = value.slice(0, MAX_ANSWER_CHARS);
      return next;
    });
  }

  function handleFiles(list: FileList | null) {
    if (!list) return;
    setPhotos((prev) =>
      [...prev, ...Array.from(list)].slice(0, MAX_LISTING_PHOTOS),
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      // Към модела отиват първите няколко снимки; в обявата влизат всички.
      const shrunk = await Promise.all(
        photos.slice(0, MAX_AI_PHOTOS).map(shrinkForAi),
      );

      const response = await fetch("/api/listing-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealType,
          answers,
          photos: shrunk.filter(Boolean),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error ?? "Нещо се обърка. Опитай пак.");
        return;
      }
      onReady(
        payload.draft as ListingDraft,
        photos,
        typeof payload.remaining === "number" ? payload.remaining : null,
      );
    } catch {
      setError("Няма връзка със сървъра. Опитай пак.");
    } finally {
      setBusy(false);
    }
  }

  const answeredCount = answers.filter((a) => a.trim()).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          {step === 0
            ? "Първо най-важното"
            : photosStep
              ? "Накрая — снимките"
              : `Въпрос ${step} от ${WIZARD_QUESTIONS.length}`}
        </p>
        <button
          type="button"
          onClick={onManual}
          className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-900"
        >
          Ще попълня сам
        </button>
      </div>

      {/* Лентата показва докъде е стигнал човекът — 8 стъпки общо. */}
      <div className="flex gap-1">
        {Array.from({ length: WIZARD_QUESTIONS.length + 2 }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i <= step ? "bg-slate-900" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Продаваш или даваш под наем?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(DEAL_TYPE_LABELS) as ListingDealType[]).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setDealType(value);
                    setStep(1);
                  }}
                  className={`rounded-xl border px-5 py-6 text-lg font-medium transition ${
                    dealType === value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-900 hover:border-slate-900"
                  }`}
                >
                  {DEAL_TYPE_LABELS[value]}
                </button>
              ),
            )}
          </div>
          <p className="text-sm text-slate-500">
            След това ти задавам {WIZARD_QUESTIONS.length} въпроса и сам
            съставям обявата. Ще я видиш и ще можеш да я поправиш, преди да
            се публикува.
          </p>
        </div>
      )}

      {question && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{question.question}</h2>
          <p className="text-sm text-slate-500">{question.hint}</p>
          <textarea
            ref={answerRef}
            rows={4}
            value={answers[questionIndex]}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={question.placeholder}
            className={inputClass}
          />
          <p className="text-xs text-slate-400">
            {answers[questionIndex].length}/{MAX_ANSWER_CHARS} знака
            {question.optional ? " · може и празно" : ""}
          </p>
        </div>
      )}

      {photosStep && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">
            Качи снимки ({photos.length}/{MAX_LISTING_PHOTOS})
          </h2>
          <p className="text-sm text-slate-500">
            Ще погледна първите {MAX_AI_PHOTOS} и ще допълня описанието с
            това, което се вижда. Всички снимки влизат в обявата.
            Препоръчваме поне {MIN_LISTING_PHOTOS_HINT}.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="text-sm"
          />
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {previews.map((preview, index) => (
                <div key={index} className="group relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview.url}
                    alt=""
                    className="h-full w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotos((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:border-slate-900 disabled:opacity-60"
          >
            Назад
          </button>
        )}

        {question && (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!question.optional && !answers[questionIndex].trim()}
            className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            Напред
          </button>
        )}

        {photosStep && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || answeredCount < 2}
            className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {busy ? "Съставям обявата…" : "Направи обявата"}
          </button>
        )}
      </div>

      {busy && (
        <p className="text-sm text-slate-500">
          Чета отговорите и снимките. Отнема около половин минута.
        </p>
      )}
    </div>
  );
}
