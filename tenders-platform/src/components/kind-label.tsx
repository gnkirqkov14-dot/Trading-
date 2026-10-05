/**
 * Надпис „Обществена поръчка“ / „Европейска програма“ най-отпред на
 * картичката. Екранният четец го чува в заглавието (`KindPrefix`), затова
 * видимият надпис е скрит за него — да не се казва два пъти.
 */
export function KindBadge({ text, tone }: { text: string; tone: "tender" | "grant" }) {
  return (
    <span
      aria-hidden="true"
      className={`rounded-full px-2 py-0.5 font-semibold ${
        tone === "tender" ? "bg-slate-800 text-white" : "bg-blue-700 text-white"
      }`}
    >
      {text}
    </span>
  );
}

export function KindPrefix({ text }: { text: string }) {
  return <span className="sr-only">{text}: </span>;
}
