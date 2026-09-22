"use client";

import { useState } from "react";

/**
 * Питане с думи върху това, което роботът е видял във Viber.
 *
 * Примерите отгоре не са украса: без тях човек пред празно поле пита
 * "как е?" и получава мъгла. Те показват какъв въпрос дава полезен отговор —
 * с име, с период, с конкретно искане.
 */

const EXAMPLES = [
  "Има ли клиенти от последните 4 дни, които чакат нещо от мен?",
  "Кой чака най-дълго и какво е искал?",
  "Какво съм си говорил последно с ",
];

const MAX_CHARS = 500;

export function ViberAsk() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    setAnswer(null);

    try {
      const response = await fetch("/api/viber/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = (await response.json()) as {
        answer?: string;
        error?: string;
      };

      if (!response.ok || !data.answer) {
        setError(data.error ?? "Нещо се обърка. Опитай пак.");
        return;
      }
      setAnswer(data.answer);
    } catch {
      // Мрежова грешка изглежда точно като счупен сайт, ако не се каже.
      setError("Няма връзка със сървъра. Провери интернета и опитай пак.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Питай за кореспонденцията</h2>
      <p className="mt-1 text-sm text-slate-500">
        С думи, както би попитал човек. Отговорът е по това, което роботът е
        уловил — не по самите разговори.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setQuestion(example)}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:border-accent-500 hover:text-slate-900"
          >
            {example.length > 44 ? `${example.slice(0, 44)}…` : example}
          </button>
        ))}
      </div>

      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value.slice(0, MAX_CHARS))}
          rows={3}
          placeholder="Например: има ли клиенти от последните 4 дни, които чакат нещо от мен?"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-accent-500"
          // Enter праща, Shift+Enter слага нов ред — както във всеки чат.
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void ask(question);
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            {question.length}/{MAX_CHARS} · до 15 въпроса на ден
          </span>
          <button
            type="submit"
            disabled={busy || question.trim().length === 0}
            className="rounded-xl bg-brand-600 px-5 py-2 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Чета…" : "Попитай"}
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {answer && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-800">
          {answer.split("\n").map((line, index) =>
            line.trim() === "" ? (
              <br key={index} />
            ) : (
              <p key={index} className="mt-1 first:mt-0 whitespace-pre-wrap">
                {line}
              </p>
            ),
          )}
        </div>
      )}
    </section>
  );
}
