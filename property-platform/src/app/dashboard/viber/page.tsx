import type { Metadata } from "next";
import { ViberAsk } from "@/components/viber-ask";
import { getAuthedUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

/**
 * Какво вижда собственикът от Viber робота.
 *
 * Едно нещо е важното на тази страница: **кой чака отговор и откога**.
 * Всичко останало е контекст, затова стои отдолу и по-бледо.
 *
 * ⚠️ Три състояния, не две. Първата версия делеше разговорите на "чака" и
 * "отговорено" — и това беше дефект, не опростяване: щом роботът не успее да
 * разпознае кой е писал последен, единственото, което можеше да каже, беше
 * "клиентът" — тоест "чака те". На живо 16 от 17 разговора излязоха чакащи.
 * Затова "не е ясно" вече е отделен раздел: по-полезно е да видиш, че роботът
 * не е разчел, отколкото да ти покаже измислен чакащ.
 *
 * Роботът вижда само списъка с чатове, не самите разговори — виж
 * `api/viber/ingest/route.ts` защо. Затова тук няма текст на съобщения,
 * а само откъса, който Viber сам показва в списъка.
 */

export const metadata: Metadata = { title: "Viber" };

// Данните идват от робот, който може да е спрял. Страница, която показва
// вчерашно състояние като днешно, е по-лоша от празна.
const ROBOT_STALE_MINUTES = 25;

type ViberChat = {
  chat_key: string;
  display_name: string;
  last_preview: string | null;
  last_time_label: string | null;
  /** NULL = роботът не е разпознал кой е писал последен. */
  last_from_me: boolean | null;
  kind: "person" | "group";
  unread_count: number;
  waiting_since: string | null;
  updated_at: string;
};

/** "3 часа", "2 дни", "12 мин." — за колко време чака клиентът. */
function humanDuration(fromMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.round((nowMs - fromMs) / 60_000));
  if (minutes < 60) {
    return `${minutes} мин.`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? "1 час" : `${hours} часа`;
  }
  const days = Math.round(hours / 24);
  return days === 1 ? "1 ден" : `${days} дни`;
}

/** Колкото по-дълго чака, толкова по-силен е цветът. */
function urgencyClass(hoursWaited: number): string {
  if (hoursWaited >= 24) return "border-red-300 bg-red-50";
  if (hoursWaited >= 3) return "border-amber-300 bg-amber-50";
  return "border-slate-200 bg-white";
}

type PreparedChat = ViberChat & { waitedLabel: string; urgency: string };

/**
 * Всичко, което зависи от часовника, се смята тук — веднъж, преди render.
 * Вътре в компонента `Date.now()` е нечисто: при повторен render числата биха
 * се разминали. Обикновена функция извън компонента няма този проблем.
 */
function prepare(chats: ViberChat[]) {
  const nowMs = Date.now();

  // Групите и каналите се отделят ПРЕДИ всичко останало. Там "последното
  // съобщение е чуждо" е нормалното състояние, не сигнал — автокъщи и
  // официални акаунти трупат стотици непрочетени, които никой не чака
  // да бъдат отговорени.
  const people = chats.filter((c) => c.kind !== "group");
  const groups = chats
    .filter((c) => c.kind === "group")
    .sort((a, b) => b.unread_count - a.unread_count);

  const waiting: PreparedChat[] = people
    .filter((c): c is ViberChat & { waiting_since: string } => Boolean(c.waiting_since))
    .sort((a, b) => (a.waiting_since < b.waiting_since ? -1 : 1))
    .map((c) => {
      const since = new Date(c.waiting_since).getTime();
      return {
        ...c,
        waitedLabel: humanDuration(since, nowMs),
        urgency: urgencyClass((nowMs - since) / 3_600_000),
      };
    });

  const rest = people.filter((c) => !c.waiting_since);

  // Най-скорошното обновяване показва дали роботът изобщо работи.
  const lastSeenMs = chats.reduce(
    (latest, c) => Math.max(latest, new Date(c.updated_at).getTime()),
    0,
  );

  return {
    waiting,
    unclear: rest.filter((c) => c.last_from_me === null),
    answered: rest.filter((c) => c.last_from_me === true),
    groups,
    robotSilentFor: lastSeenMs ? humanDuration(lastSeenMs, nowMs) : null,
    robotStale: !lastSeenMs || nowMs - lastSeenMs > ROBOT_STALE_MINUTES * 60_000,
  };
}

export default async function ViberPage() {
  const user = await getAuthedUser();
  const supabase = await createClient();

  // RLS ограничава до собственика; owner_id тук е за индекса, не за защитата.
  const { data } = await supabase
    .from("viber_chats")
    .select(
      "chat_key, display_name, last_preview, last_time_label, last_from_me, kind, unread_count, waiting_since, updated_at",
    )
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  const chats = (data ?? []) as ViberChat[];
  const { waiting, unclear, answered, groups, robotSilentFor, robotStale } =
    prepare(chats);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl text-brand-600">Viber</h1>

      {chats.length > 0 && <ViberAsk />}

      {chats.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-slate-600">
          <p className="font-medium text-slate-800">Още няма данни.</p>
          <p className="mt-2 text-sm">
            Роботът или не е пуснат, или Viber не е бил отворен, откакто тръгна.
            Стъпките за пускане са в <code>docs/РЪЧНИ-СТЪПКИ.md</code>, раздел A7.
          </p>
        </div>
      ) : (
        <>
          {robotStale && (
            <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              ⚠️ Роботът не се е обаждал от{" "}
              {robotSilentFor ?? "неизвестно кога"}. Провери
              дали Mac-ът е буден и Viber отворен — списъкът отдолу може да е стар.
            </p>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">
              Чакат отговор
              {waiting.length > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-sm text-red-700">
                  {waiting.length}
                </span>
              )}
            </h2>

            {waiting.length === 0 ? (
              <p className="mt-3 rounded-lg bg-accent-500/10 px-4 py-3 text-sm text-slate-700">
                ✅ Няма разговор, за който да е сигурно, че чака отговор.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {waiting.map((chat) => (
                  <li
                    key={chat.chat_key}
                    className={`rounded-xl border p-4 ${chat.urgency}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-slate-900">
                        {chat.display_name}
                      </span>
                      <span className="shrink-0 text-sm font-medium text-red-700">
                        чака {chat.waitedLabel}
                      </span>
                    </div>
                    {chat.last_preview && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {chat.last_preview}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {chat.last_time_label}
                      {chat.unread_count > 0 && ` · ${chat.unread_count} непрочетени`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {unclear.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-slate-900">
                Не е ясно кой е писал последен ({unclear.length})
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Роботът не е различил дали последното съобщение е твое. Тези
                разговори нарочно не се броят за чакащи — по-добре да ги
                погледнеш сам, отколкото да те лъже числото горе.
              </p>
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {unclear.map((chat) => (
                  <li key={chat.chat_key} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium text-slate-800">
                        {chat.display_name}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {chat.last_time_label}
                      </span>
                    </div>
                    {chat.last_preview && (
                      <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                        {chat.last_preview}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {answered.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-slate-900">
                Ти си писал последен ({answered.length})
              </h2>
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {answered.map((chat) => (
                  <li
                    key={chat.chat_key}
                    className="flex items-baseline justify-between gap-3 px-4 py-3"
                  >
                    <span className="truncate text-slate-700">{chat.display_name}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {chat.last_time_label}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {groups.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-slate-500">
                Групи и канали ({groups.length})
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Тук никой не чака отговор лично от теб, затова не влизат в
                броя горе.
              </p>
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50">
                {groups.map((chat) => (
                  <li
                    key={chat.chat_key}
                    className="flex items-baseline justify-between gap-3 px-4 py-3"
                  >
                    <span className="truncate text-slate-600">{chat.display_name}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {chat.unread_count > 0
                        ? `${chat.unread_count} непрочетени`
                        : chat.last_time_label}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <p className="mt-10 text-xs text-slate-400">
        Тук се пази само редът от списъка с чатове — име, откъсът, който Viber
        сам показва, часът и броят непрочетени. Роботът не отваря разговори и
        няма достъп до историята им. Снимката на прозореца обаче се разчита от
        модел, затова дръж настрана разговор, който не искаш да бъде прочетен.
      </p>
    </div>
  );
}
