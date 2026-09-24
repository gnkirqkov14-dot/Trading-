// Произношение (синтез на реч) и проверка на говоренето (разпознаване на реч).
import { getState } from './store.js';
import { norm, similarity } from './util.js';

// ---------- Говорене от приложението ----------

let voices = [];
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
}
if ('speechSynthesis' in window) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export const canSpeak = () => 'speechSynthesis' in window;

export function englishVoices() {
  loadVoices();
  return voices;
}

function bestVoice() {
  const wanted = getState().settings.voice;
  if (wanted) {
    const v = voices.find((x) => x.name === wanted);
    if (v) return v;
  }
  const score = (v) =>
    (/en[-_]US/i.test(v.lang) ? 3 : /en[-_]GB/i.test(v.lang) ? 2.5 : 1) +
    (/google|samantha|daniel|natural|enhanced|premium|siri|aria|jenny|guy/i.test(v.name) ? 2 : 0) +
    (v.localService ? 0.5 : 0);
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

/** Произнася текст на английски. Връща Promise, който се изпълнява при край. */
export function say(text, { slow = false, rate } = {}) {
  return new Promise((resolve) => {
    if (!canSpeak()) return resolve();
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = bestVoice();
      if (v) u.voice = v;
      u.lang = v?.lang || 'en-US';
      u.rate = rate ?? (slow ? 0.55 : getState().settings.rate || 0.85);
      u.onend = u.onerror = () => resolve();
      speechSynthesis.speak(u);
      // Някои браузъри не връщат onend – предпазен таймер.
      setTimeout(resolve, 800 + text.length * 120);
    } catch {
      resolve();
    }
  });
}

export function stopSpeaking() {
  try { speechSynthesis.cancel(); } catch {}
}

// ---------- Проверка на произношението ----------

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
// В режим „преглед“ (вградена страница) микрофонът не е достъпен.
export const canListen = () => !!Recognition && !window.__PREVIEW;

/**
 * Слуша потребителя и сравнява с очаквания текст.
 * Връща { ok, score (0..1), heard, error }
 */
export function listen(expected, { timeout = 7000 } = {}) {
  return new Promise((resolve) => {
    if (!Recognition) return resolve({ ok: false, error: 'unsupported' });
    stopSpeaking();
    const r = new Recognition();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 5;
    r.continuous = false;
    let done = false;
    const finish = (res) => {
      if (done) return;
      done = true;
      try { r.abort(); } catch {}
      resolve(res);
    };
    r.onresult = (e) => {
      const alts = [...e.results[0]].map((a) => a.transcript);
      let best = { score: 0, heard: alts[0] || '' };
      for (const a of alts) {
        const sc = matchScore(a, expected);
        if (sc > best.score) best = { score: sc, heard: a };
      }
      finish({ ok: best.score >= 0.75, score: best.score, heard: best.heard });
    };
    r.onerror = (e) => finish({ ok: false, error: e.error || 'error', heard: '' });
    r.onend = () => finish({ ok: false, error: 'no-speech', heard: '' });
    setTimeout(() => finish({ ok: false, error: 'no-speech', heard: '' }), timeout);
    try { r.start(); } catch (e) { finish({ ok: false, error: 'start' }); }
  });
}

// Разпознаването понякога връща цифри ("2" вместо "two") – уеднаквяваме.
const NUM = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20, thirty: 30, fifty: 50, hundred: 100 };
function canon(s) {
  return norm(s)
    .split(' ')
    .map((w) => (w in NUM ? String(NUM[w]) : w))
    .join(' ')
    .replace(/\bi'm\b/g, 'i am').replace(/\bit's\b/g, 'it is').replace(/\bi'd\b/g, 'i would')
    .replace(/\bdon't\b/g, 'do not').replace(/\bcan't\b/g, 'cannot').replace(/\bcan not\b/g, 'cannot')
    .replace(/\bok\b/g, 'okay').replace(/-/g, ' ');
}
function matchScore(heard, expected) {
  const a = canon(heard), b = canon(expected);
  if (a === b || a.includes(b)) return 1;
  return similarity(a, b);
}

export const LISTEN_ERRORS = {
  unsupported: 'Този браузър не може да проверява говоренето. Опитай с Chrome или Safari.',
  'not-allowed': 'Нямам достъп до микрофона. Разреши го от настройките на браузъра (иконката с катинарчето до адреса).',
  'service-not-allowed': 'Разпознаването на реч е изключено в този браузър/режим.',
  'no-speech': 'Не чух нищо. Натисни 🎤 и говори веднага след сигнала.',
  'audio-capture': 'Не намирам микрофон.',
  network: 'Разпознаването на реч изисква интернет.',
  start: 'Не успях да включа микрофона. Опитай пак.',
  error: 'Нещо се обърка. Опитай пак.',
  aborted: 'Прекъснато.',
};
