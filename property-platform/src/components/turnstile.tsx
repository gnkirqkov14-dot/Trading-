"use client";

import { useCallback, useEffect, useRef } from "react";
import Script from "next/script";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

/**
 * Джаджата „не съм робот“ на Cloudflare. Във форма сама добавя скрито поле
 * `cf-turnstile-response`. Жетонът важи за едно изпращане, затова при
 * смяна на `resetKey` (напр. грешка от сървъра) се иска нов.
 * Без ключ не показва нищо.
 */
export function Turnstile({
  onToken,
  resetKey,
}: {
  onToken?: (token: string) => void;
  resetKey?: unknown;
}) {
  const kutiya = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const naZheton = useRef(onToken);
  useEffect(() => {
    naZheton.current = onToken;
  });

  const narisuvay = useCallback(() => {
    if (!kutiya.current || !window.turnstile || id.current) return;
    id.current = window.turnstile.render(kutiya.current, {
      sitekey: TURNSTILE_SITE_KEY,
      language: "bg",
      callback: (t: string) => naZheton.current?.(t),
      "expired-callback": () => naZheton.current?.(""),
      "error-callback": () => naZheton.current?.(""),
    });
  }, []);

  useEffect(() => {
    narisuvay();
    return () => {
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, [narisuvay]);

  const parvi = useRef(true);
  useEffect(() => {
    if (parvi.current) {
      parvi.current = false;
      return;
    }
    if (id.current) {
      window.turnstile?.reset(id.current);
      naZheton.current?.("");
    }
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={narisuvay}
      />
      <div ref={kutiya} />
    </>
  );
}
