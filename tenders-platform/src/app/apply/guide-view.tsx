import type { GuideBlock } from "@/lib/apply/types";

/**
 * Ръководството на страницата. Семантичен HTML за екранен четец:
 * заглавия h2/h3 (VoiceOver ги прескача с ротора), истински списъци,
 * цитатите в <blockquote> с текст преди тях, а не само с цвят.
 */
export function GuideView({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className="space-y-3 text-base leading-relaxed text-slate-800 sm:text-[15px]">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h2":
            return (
              <h2 key={i} id={b.id} tabIndex={-1} className="scroll-mt-4 pt-6 text-xl font-bold text-slate-900">
                {b.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="pt-4 text-lg font-semibold text-slate-900">
                {b.text}
              </h3>
            );
          case "h4":
            return (
              <h4 key={i} className="pt-2 font-semibold text-slate-900">
                {b.text}
              </h4>
            );
          case "p":
            return <p key={i}>{b.text}</p>;
          case "field":
            return (
              <p key={i}>
                <strong className="font-semibold text-slate-900">{b.label}:</strong> {b.value}
              </p>
            );
          case "warn":
            return (
              <p key={i} className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
                <strong>Внимание:</strong> {b.text}
              </p>
            );
          case "quote":
            return (
              <figure
                key={i}
                className={`ml-1 border-l-4 pl-3 text-sm ${b.quote.verified ? "border-slate-300 text-slate-600" : "border-red-400 text-red-900"}`}
              >
                <figcaption className="font-medium">
                  {b.quote.verified
                    ? "Точният текст от обявлението:"
                    : "Внимание, този откъс не беше намерен дословно в обявлението — проверете го:"}
                </figcaption>
                <blockquote className="italic">„{b.quote.text}“</blockquote>
              </figure>
            );
          case "list":
            return (
              <ul key={i} className="list-disc space-y-1 pl-6">
                {b.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "steps":
            return (
              <ol key={i} className="list-decimal space-y-1 pl-6">
                {b.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            );
        }
      })}
    </div>
  );
}
