"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Презарежда данните на всеки 30 секунди, докато страницата е отворена. */
export function Opresni() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
