// Съхранение на прогреса в браузъра (localStorage) + пренос между устройства.
import { dayKey } from './util.js';

const KEY = 'english-a1-progress-v1';

function blank() {
  return {
    v: 1,
    created: Date.now(),
    cards: {},        // wordId -> карта за повторение (виж srs.js)
    lessons: {},      // lessonId -> { done: 'YYYY-MM-DD', score: 0..100 }
    days: {},         // 'YYYY-MM-DD' -> { app: секунди, manual: [{id, min, note}] , lessons: брой }
    current: null,    // незавършен урок: { day, plan, stage }
    best: {},         // рекорди в игрите
    settings: { rate: 0.85, voice: '', speak: true, goal: 30, autoplay: true },
  };
}

let state = load();
let saveTimer = null;
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const b = blank();
      return { ...b, ...s, settings: { ...b.settings, ...(s.settings || {}) } };
    }
  } catch (e) {
    console.warn('Неуспешно зареждане на прогреса', e);
  }
  return blank();
}

export const getState = () => state;

export function save(now = false) {
  clearTimeout(saveTimer);
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Неуспешен запис', e);
    }
    listeners.forEach((fn) => fn(state));
  };
  if (now) write();
  else saveTimer = setTimeout(write, 300);
}

export const onChange = (fn) => listeners.add(fn);

// Ако приложението е отворено в друг раздел и запише прогрес – презареждаме го тук,
// за да не презапишем по-новите данни със старите.
export const onExternalChange = (fn) =>
  addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    state = load();
    fn(state);
  });

export function today() {
  const k = dayKey();
  if (!state.days[k]) state.days[k] = { app: 0, manual: [], lessons: 0 };
  return state.days[k];
}

export function dayMinutes(k) {
  const d = state.days[k];
  if (!d) return 0;
  return (d.app || 0) / 60 + (d.manual || []).reduce((s, x) => s + (x.min || 0), 0);
}

export function addManual(key, min, note) {
  if (!state.days[key]) state.days[key] = { app: 0, manual: [], lessons: 0 };
  state.days[key].manual.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), min, note: note || '' });
  save(true);
}

export function removeManual(key, id) {
  const d = state.days[key];
  if (!d) return;
  d.manual = d.manual.filter((x) => x.id !== id);
  save(true);
}

export function resetAll() {
  state = blank();
  save(true);
}

// ---------- Пренос между устройства ----------

async function gzip(str) {
  const cs = new CompressionStream('gzip');
  const stream = new Blob([str]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes) {
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return await new Response(stream).text();
}
const toB64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Връща текстов код с целия прогрес. */
export async function exportCode() {
  const json = JSON.stringify({ ...state, current: null });
  if (typeof CompressionStream !== 'undefined') {
    try { return 'EN1:' + toB64(await gzip(json)); } catch {}
  }
  return 'EN0:' + toB64(new TextEncoder().encode(json));
}

export async function decodeCode(code) {
  code = code.trim().replace(/\s+/g, '');
  if (code.startsWith('{')) return JSON.parse(code);
  const [tag, body] = [code.slice(0, 4), code.slice(4)];
  if (tag === 'EN1:') return JSON.parse(await gunzip(fromB64(body)));
  if (tag === 'EN0:') return JSON.parse(new TextDecoder().decode(fromB64(body)));
  throw new Error('Непознат код');
}

/**
 * Слива чужд прогрес с текущия, без да губи нищо:
 * за всяка дума остава по-скорошното състояние, за всеки ден – повече минути.
 */
export function mergeIn(other) {
  if (!other || typeof other !== 'object' || !other.cards) throw new Error('Невалидни данни');
  for (const [id, c] of Object.entries(other.cards || {})) {
    const mine = state.cards[id];
    if (!mine || (c.last || 0) > (mine.last || 0)) state.cards[id] = c;
  }
  for (const [id, l] of Object.entries(other.lessons || {})) {
    const mine = state.lessons[id];
    if (!mine || (l.score || 0) > (mine.score || 0)) state.lessons[id] = l;
  }
  for (const [k, d] of Object.entries(other.days || {})) {
    const mine = state.days[k] || (state.days[k] = { app: 0, manual: [], lessons: 0 });
    mine.app = Math.max(mine.app || 0, d.app || 0);
    mine.lessons = Math.max(mine.lessons || 0, d.lessons || 0);
    if (d.newLesson && !mine.newLesson) mine.newLesson = d.newLesson;
    const ids = new Set(mine.manual.map((x) => x.id));
    for (const m of d.manual || []) if (!ids.has(m.id)) mine.manual.push(m);
  }
  for (const [g, v] of Object.entries(other.best || {})) state.best[g] = Math.max(state.best[g] || 0, v);
  state.created = Math.min(state.created || Date.now(), other.created || Date.now());
  save(true);
}

// Молим браузъра да не трие данните при липса на място.
try { navigator.storage?.persist?.(); } catch {}
