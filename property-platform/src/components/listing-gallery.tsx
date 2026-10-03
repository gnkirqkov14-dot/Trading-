"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

/**
 * Снимките на обявата: решетка, а при натискане — снимката на цял екран.
 *
 * Квадратчетата изрязват кадъра, за да е подредено; в голямото се вижда
 * целият, защото там човекът гледа имота, не оформлението.
 *
 * Управление: стрелки и Esc от клавиатура, плъзгане с пръст на телефон,
 * натискане извън снимката за затваряне. Докато е отворено, страницата
 * отзад не се превърта — иначе на телефон под пръста бяга фонът.
 */

type Photo = { url: string; position?: number };

export function ListingGallery({
  photos,
  title,
}: {
  photos: Photo[];
  title: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);

  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null
          ? null
          : (current + delta + photos.length) % photos.length,
      ),
    [photos.length],
  );

  useEffect(() => {
    if (openIndex === null) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [openIndex, close, step]);

  if (photos.length === 0) return null;

  const open = openIndex !== null ? photos[openIndex] : null;

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <button
            key={photo.url}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={`Виж снимка ${index + 1} от ${photos.length} на цял екран`}
            className="relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-lg bg-slate-100 transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <Image
              src={photo.url}
              alt={title}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Снимка ${(openIndex ?? 0) + 1} от ${photos.length}`}
          onClick={close}
          onTouchStart={(event) =>
            setTouchStartX(event.touches[0]?.clientX ?? null)
          }
          onTouchEnd={(event) => {
            if (touchStartX === null) return;
            const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX;
            // Под 50px е трепване на пръста, не плъзгане.
            if (Math.abs(delta) > 50) step(delta < 0 ? 1 : -1);
            setTouchStartX(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Затвори"
            className="absolute right-4 top-4 rounded-full bg-white/10 px-4 py-2 text-2xl leading-none text-white transition hover:bg-white/20"
          >
            ✕
          </button>

          {photos.length > 1 && (
            <p className="absolute left-4 top-5 text-sm text-white/80">
              {(openIndex ?? 0) + 1} от {photos.length}
            </p>
          )}

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  step(-1);
                }}
                aria-label="Предишна снимка"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-2xl leading-none text-white transition hover:bg-white/20 sm:left-6"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  step(1);
                }}
                aria-label="Следваща снимка"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-2xl leading-none text-white transition hover:bg-white/20 sm:right-6"
              >
                ›
              </button>
            </>
          )}

          {/* Натискането върху самата снимка не затваря — иначе човек я
              закрива, докато се опитва да я разгледа. */}
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative h-full w-full"
          >
            <Image
              src={open.url}
              alt={title}
              fill
              sizes="100vw"
              priority
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
