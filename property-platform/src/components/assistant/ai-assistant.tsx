"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { HeroMark3D } from "@/components/home/hero-mark-3d";
import { SUPPORT_EMAIL } from "@/lib/listing-labels";

/**
 * Плаващият помощник — 3D знакът от логото, който върви с посетителя
 * надолу по страницата и при натискане отваря чат.
 *
 * Два режима:
 * - с настроен `ANTHROPIC_API_KEY` на сървъра — истински отговори през
 *   `/api/assistant`;
 * - без ключ — панелът показва само преките пътища из сайта. Нарочно НЕ
 *   показваме счупено поле за въпроси и нарочно НЕ пишем предварително
 *   подготвени отговори, които после ще се разминат с истинските.
 *
 * ⚠️ Ключът стои само на сървъра. Оттук тръгва обикновена заявка към
 * собствения route handler — браузърът никога не вижда ключ.
 */

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Как да публикувам обява?",
  "Наистина ли е безплатно?",
  "Как виждам телефона на собственика?",
  "Какво да гледам на оглед?",
];

const SHORTCUTS = [
  { href: "/dashboard/listings/new", label: "Публикувай обява" },
  { href: "/listings", label: "Разгледай обявите" },
  { href: "/about", label: "Как работи платформата" },
  { href: "/register", label: "Безплатна регистрация" },
];

const GREETING =
  "Здравей! Аз съм помощникът на imotpoint.com. Питай ме за платформата или за имоти изобщо.";

export function AiAssistant({ aiEnabled }: { aiEnabled: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [docked, setDocked] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // На началната страница знакът вече стои голям в hero-а — копчето се
  // появява чак когато той излезе от екрана, за да не се дублират.
  // Навсякъде другаде няма какво да чака.
  useEffect(() => {
    // Пресмята се при скрол (а не еднократно), защото началната картина
    // се мести с потока на страницата — точно затова копчето изглежда
    // все едно е дошло с посетителя, вместо да изскочи отникъде. И още
    // нещо: докато hero-ът е на екрана, копчето стои скрито, за да не
    // ляга върху търсачката на телефон.
    const update = () => {
      // Началната страница носи атрибута на две места — сцената за
      // широк екран (`story-scroll.tsx`) и началото за телефон
      // (`phone-hero.tsx`) — и винаги едното от двете е `display:none`.
      // Скритото има височина 0, тоест изглежда „вече подминато“;
      // затова търсим първото, което наистина се вижда.
      const scenes = Array.from(
        document.querySelectorAll("[data-hero-scene]"),
      );
      if (scenes.length === 0) {
        setDocked(true);
        return;
      }
      const heroScene = scenes
        .map((element) => element.getBoundingClientRect())
        .find((rect) => rect.height > 0);
      // Има начална картина, но още няма размери (стиловете или
      // снимката не са дошли). Оставяме както е — ако тук се реши
      // „подминато е“, копчето изскача върху търсачката и остава там
      // до първия скрол.
      if (!heroScene) return;
      setDocked(heroScene.bottom <= 24);
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        update();
      });
    };

    const frame = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // Височината на страницата се мени и без скрол — шрифтът идва,
    // снимката се зарежда, клавиатурата се отваря. Без това първото
    // измерване може да хване страницата още неподредена.
    const resizeObserver = new ResizeObserver(onScroll);
    resizeObserver.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open && aiEnabled) inputRef.current?.focus();
  }, [open, aiEnabled]);

  // Новото съобщение винаги трябва да е видимо.
  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [messages, pending, error]);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || pending) return;

      const next: ChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setInput("");
      setError(null);
      setPending(true);

      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
        });
        const data = (await response.json().catch(() => null)) as {
          reply?: string;
          error?: string;
          remaining?: number;
        } | null;

        if (!response.ok || !data?.reply) {
          setError(data?.error ?? "Нещо се обърка. Опитай пак след малко.");
          return;
        }
        setMessages([...next, { role: "assistant", content: data.reply }]);
        setRemaining(typeof data.remaining === "number" ? data.remaining : null);
      } catch {
        setError("Няма връзка със сървъра. Провери интернета и опитай пак.");
      } finally {
        setPending(false);
      }
    },
    [messages, pending],
  );

  if (!docked && !open) return null;

  return (
    <>
      {/* На телефон панелът е лист отдолу — фонът зад него се затъмнява и
          затваря при докосване. */}
      {open && (
        <button
          type="button"
          aria-label="Затвори помощника"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-slate-900/40 backdrop-blur-[2px] sm:hidden"
        />
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-3 p-3 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:p-0">
        {open && (
          <section
            role="dialog"
            aria-label="Помощник"
            className="pointer-events-auto flex max-h-[75vh] w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_40px_80px_-30px_rgba(15,36,56,0.55)] sm:max-h-[34rem] sm:w-[23.5rem]"
          >
            <header className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-br from-[#17344d] to-[#0f2438] px-4 py-3.5 text-white">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                <HeroMark3D compact className="h-9 w-9" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block font-display text-[1.05rem] font-semibold leading-tight">
                  Помощник
                </b>
                <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[#9fc3dd]">
                  imotpoint.com
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Затвори"
                className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </header>

            {aiEnabled ? (
              <>
                <div
                  ref={feedRef}
                  className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
                >
                  <Bubble role="assistant">{GREETING}</Bubble>

                  {messages.map((message, index) => (
                    <Bubble key={index} role={message.role}>
                      {message.content}
                    </Bubble>
                  ))}

                  {pending && (
                    <p className="text-[0.85rem] font-semibold text-slate-400">
                      Пиша отговор…
                    </p>
                  )}

                  {error && (
                    <p className="rounded-2xl bg-red-50 px-3.5 py-2.5 text-[0.85rem] font-semibold text-red-700">
                      {error}
                    </p>
                  )}

                  {messages.length === 0 && !pending && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void ask(suggestion)}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-[0.82rem] font-semibold text-slate-600 transition hover:border-brand-600 hover:text-brand-600"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void ask(input);
                  }}
                  className="border-t border-slate-100 px-3 py-3"
                >
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={input}
                      maxLength={700}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void ask(input);
                        }
                      }}
                      placeholder="Напиши въпроса си…"
                      className="max-h-28 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-slate-200 px-3.5 py-3 text-[0.92rem] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-600"
                    />
                    <button
                      type="submit"
                      disabled={pending || !input.trim()}
                      aria-label="Изпрати"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                        aria-hidden
                      >
                        <path d="M4 12h15M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                  <p className="mt-2 px-1 text-[0.7rem] leading-snug text-slate-400">
                    Отговорите се пишат от изкуствен интелект и може да съдържат
                    грешки — проверявай важното.
                    {remaining !== null && remaining <= 3 && (
                      <> Остават {remaining} въпроса за днес.</>
                    )}
                  </p>
                </form>
              </>
            ) : (
              <div className="space-y-3 overflow-y-auto px-4 py-4">
                <Bubble role="assistant">
                  Чатът се включва скоро. Междувременно най-често търсеното:
                </Bubble>
                <ul className="space-y-2">
                  {SHORTCUTS.map((shortcut) => (
                    <li key={shortcut.href}>
                      <Link
                        href={shortcut.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3.5 py-3 text-[0.9rem] font-semibold text-slate-700 transition hover:border-brand-600 hover:text-brand-600"
                      >
                        {shortcut.label}
                        <span aria-hidden>→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="px-1 text-[0.8rem] leading-relaxed text-slate-500">
                  Въпрос, който не е тук?{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="font-semibold text-brand-600 underline underline-offset-4"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </p>
              </div>
            )}
          </section>
        )}

        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Отвори помощника"
            className="group pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 p-1.5 shadow-[0_20px_44px_-18px_rgba(15,36,56,0.7)] backdrop-blur-xl transition hover:border-brand-600 hover:shadow-[0_24px_52px_-16px_rgba(26,81,128,0.65)] sm:pr-4"
          >
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <HeroMark3D compact className="h-14 w-14" />
              {/* Зелената точка казва „тук има какво да се натисне" — без
                  нея копчето изглежда просто като лого в ъгъла. */}
              <span className="absolute right-0.5 top-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-70" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-accent-500 ring-2 ring-white" />
              </span>
            </span>
            <span className="hidden text-[0.88rem] font-bold text-slate-700 transition group-hover:text-brand-600 sm:inline">
              Питай ме
            </span>
          </button>
        )}
      </div>
    </>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <p
      className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[0.9rem] leading-relaxed ${
        isUser
          ? "ml-auto bg-brand-600 font-medium text-white"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {children}
    </p>
  );
}
