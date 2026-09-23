// Повторение в точния момент (spaced repetition), вариант на алгоритъма SM-2.
// Всяка дума има "карта" с интервал в дни. Верен отговор → интервалът расте,
// грешен → думата се връща в началото и идва отново още днес/утре.
import { getState, save } from './store.js';
import { WORDS, WORD } from './content/index.js';
import { dayKey } from './util.js';

const DAY = 86400000;
const startOfToday = () => new Date(new Date().setHours(0, 0, 0, 0)).getTime();

export function card(id) {
  return getState().cards[id];
}

/** Думата се показва за пръв път – създаваме карта. */
export function introduce(id) {
  const s = getState();
  if (!s.cards[id]) {
    s.cards[id] = { iv: 0, ease: 2.5, reps: 0, lapses: 0, ok: 0, bad: 0, due: Date.now(), last: Date.now(), seen: dayKey() };
    save();
  }
  return s.cards[id];
}

/**
 * Оценка на отговор.
 * q: 0 = грешно, 1 = трудно (вярно, но с подсказка/грешка в буква), 2 = вярно, 3 = лесно
 */
export function grade(id, q) {
  if (!WORD[id]) return;
  const c = introduce(id);
  const now = Date.now();
  const reviewedToday = c.lastOkDay === dayKey();
  if (q === 0) {
    c.bad++;
    c.lapses += c.iv >= 1 ? 1 : 0;
    c.iv = 0;
    c.reps = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = now + 10 * 60 * 1000; // пак след 10 минути
    c.lastOkDay = null;
  } else {
    c.ok++;
    // В рамките на един ден интервалът расте само веднъж – истинското
    // запомняне се проверява на следващ ден.
    if (!reviewedToday) {
      c.reps++;
      if (c.reps === 1) c.iv = 1;
      else if (c.reps === 2) c.iv = q === 1 ? 2 : 3;
      else c.iv = Math.round(c.iv * (q === 1 ? 1.2 : q === 3 ? c.ease * 1.3 : c.ease));
      if (q === 1) c.ease = Math.max(1.3, c.ease - 0.15);
      if (q === 3) c.ease = Math.min(3, c.ease + 0.1);
      c.iv = Math.min(c.iv, 180);
      c.due = startOfToday() + c.iv * DAY + 3 * 3600 * 1000;
      c.lastOkDay = dayKey();
    }
  }
  c.last = now;
  save();
}

/** Сила на думата 0..5 за показване. */
export function level(c) {
  if (!c) return -1;
  if (c.iv < 1) return 0;   // учи се
  if (c.iv < 3) return 1;   // запомня се
  if (c.iv < 7) return 2;   // знам
  if (c.iv < 21) return 3;  // добре
  if (c.iv < 60) return 4;  // много добре
  return 5;                 // усвоена
}

export const LEVELS = [
  { name: 'Уча я', color: '#EF5350' },
  { name: 'Запомням', color: '#FFA726' },
  { name: 'Знам', color: '#FFD54F' },
  { name: 'Знам добре', color: '#9CCC65' },
  { name: 'Много добре', color: '#26A69A' },
  { name: 'Усвоена', color: '#42A5F5' },
];

/** "Знам" = познах думата поне в два различни дни. */
export const isKnown = (c) => !!c && c.iv >= 3;

export function introducedWords() {
  const s = getState();
  return WORDS.filter((w) => s.cards[w.id]);
}

export function dueWords(limit = Infinity) {
  const s = getState();
  const now = Date.now();
  return WORDS.filter((w) => s.cards[w.id] && s.cards[w.id].due <= now)
    .sort((a, b) => s.cards[a.id].due - s.cards[b.id].due)
    .slice(0, limit);
}

/** Колко "слаба" е думата – колкото по-голямо, толкова по-често се пада в игрите. */
export function weakness(w) {
  const c = card(w.id);
  if (!c) return 0;
  const errRate = c.bad / (c.ok + c.bad + 1);
  let x = 1 + c.lapses * 1.5 + errRate * 5;
  if (c.iv < 1) x += 3;
  else if (c.iv < 3) x += 1.5;
  if (c.due <= Date.now()) x += 2;
  if (c.iv >= 21) x *= 0.4;
  return x;
}

export function counts() {
  const s = getState();
  const cs = Object.values(s.cards);
  const byLevel = [0, 0, 0, 0, 0, 0];
  for (const c of cs) byLevel[level(c)]++;
  return { introduced: cs.length, known: cs.filter(isKnown).length, byLevel, due: dueWords().length };
}
