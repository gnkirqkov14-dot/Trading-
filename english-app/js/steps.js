// Превръща "стъпка" от плана на урока в конкретно упражнение.
import { h, esc, shuffle, pick } from './util.js';
import { WORD, WORDS, LESSON } from './content/index.js';
import { getState } from './store.js';
import { introduce } from './srs.js';
import {
  introCard, choice, typeAnswer, buildSentence, speakIt, grammarCard, readingCard, matchPairs, speakBtn, tokenize,
} from './exercises.js';
import { say } from './speech.js';

/** Думи-примамки: първо от същия урок, после от въведените, после от всички. */
export function distractors(w, n, key = 'en') {
  const s = getState();
  const bad = (x) => x.id === w.id || x[key] === w[key] || x.bg === w.bg || x.emoji === w.emoji;
  const same = shuffle(LESSON[w.lesson].words.filter((x) => !bad(x)));
  const known = shuffle(WORDS.filter((x) => s.cards[x.id] && x.lesson !== w.lesson && !bad(x)));
  const rest = shuffle(WORDS.filter((x) => x.lesson !== w.lesson && !bad(x)));
  const out = [];
  for (const x of [...same, ...known, ...rest]) {
    if (out.length >= n) break;
    if (!out.some((o) => o[key] === x[key] || o.bg === x.bg)) out.push(x);
  }
  return out;
}

const bigEn = (w) => h('div.prompt', {}, [h('div.big-en', {}, w.en), speakBtn(w.en)]);
const emojiBg = (w) => h('div.prompt', {}, [h('div.big-emoji', {}, w.emoji), h('div.big-bg', {}, w.bg)]);
const answersFor = (w) => [w.en, ...(w.alt || [])];
const colorOf = (w) => LESSON[w.lesson]?.color;

function gapSentence(w) {
  const re = new RegExp(`\\b${w.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  if (!re.test(w.ex)) return null;
  return esc(w.ex).replace(re, '<span class="gap">_____</span>');
}

/**
 * Изпълнява стъпка. Връща { correct, quality, word? }.
 * step.t – вид упражнение; step.w – id на дума; step.l – id на урок; step.i – индекс.
 */
export async function runStep(stage, step, meta = {}) {
  const w = step.w ? WORD[step.w] : null;
  const L = step.l ? LESSON[step.l] : null;
  if (w) w._color = colorOf(w);

  switch (step.t) {
    case 'intro':
      introduce(w.id);
      return introCard(stage, w, meta);

    case 'mcq_en_bg': {
      const opts = shuffle([w, ...distractors(w, 3, 'bg')]);
      return choice(stage, {
        title: 'Какво означава?', prompt: bigEn(w), audio: w.en,
        options: opts.map((x) => ({ html: esc(x.bg), value: x.id })), answer: w.id,
        explain: `<b>${esc(w.en)}</b> = ${esc(w.bg)} ${w.emoji}`,
      });
    }

    case 'mcq_bg_en': {
      const opts = shuffle([w, ...distractors(w, 3)]);
      return choice(stage, {
        title: 'Как е на английски?', prompt: emojiBg(w),
        options: opts.map((x) => ({ html: esc(x.en), value: x.id })), answer: w.id, speak: w.en,
        explain: `${w.emoji} ${esc(w.bg)} = <b>${esc(w.en)}</b>`,
      });
    }

    case 'mcq_emoji': {
      const opts = shuffle([w, ...distractors(w, 3)]);
      return choice(stage, {
        title: 'Коя картинка?', sub: 'Избери картинката към думата.', prompt: bigEn(w), audio: w.en, optionsBig: true,
        options: opts.map((x) => ({ html: `<span class="opt-emoji">${x.emoji}</span>`, value: x.id })), answer: w.id,
        explain: `<b>${esc(w.en)}</b> = ${w.emoji} ${esc(w.bg)}`,
      });
    }

    case 'audio': {
      const opts = shuffle([w, ...distractors(w, 3)]);
      return choice(stage, {
        title: 'Слушане', sub: 'Чуй думата и избери какво означава.',
        prompt: h('div.prompt', {}, speakBtn(w.en, { big: true, label: '🔊 Чуй' })), audio: w.en,
        options: opts.map((x) => ({ html: `<span class="opt-emoji-sm">${x.emoji}</span> ${esc(x.bg)}`, value: x.id })), answer: w.id,
        explain: `Чу се <b>${esc(w.en)}</b> = ${esc(w.bg)}`,
      });
    }

    case 'audio_sentence': {
      const others = shuffle(distractors(w, 6)).slice(0, 2);
      const opts = shuffle([w, ...others]);
      return choice(stage, {
        title: 'Слушане', sub: 'Чуй изречението и избери превода.',
        prompt: h('div.prompt', {}, speakBtn(w.ex, { big: true, label: '🔊 Чуй' })), audio: w.ex,
        options: opts.map((x) => ({ html: esc(x.exBg), value: x.id })), answer: w.id,
        explain: `<b>${esc(w.ex)}</b><br>${esc(w.exBg)}`,
      });
    }

    case 'type':
      return typeAnswer(stage, { title: 'Писане', sub: 'Напиши думата на английски.', prompt: emojiBg(w), answers: answersFor(w) });

    case 'dictation':
      return typeAnswer(stage, {
        title: 'Диктовка', sub: 'Чуй и напиши каквото чуваш.',
        prompt: h('div.prompt', {}, speakBtn(w.en, { big: true, label: '🔊 Чуй' })), audio: w.en, answers: answersFor(w),
      });

    case 'gap': {
      const g = gapSentence(w);
      if (!g) return runStep(stage, { ...step, t: 'type' }, meta);
      return typeAnswer(stage, {
        title: 'Попълни липсващата дума',
        prompt: h('div.prompt', {}, [h('div.gap-en', { html: g }), h('div.gap-bg', {}, w.exBg), h('div.small', {}, `(${w.emoji} ${w.bg})`)]),
        answers: answersFor(w), speak: w.ex,
      });
    }

    case 'build': {
      const extra = shuffle(distractors(w, 4).map((x) => tokenize(x.en)[0]))
        .filter((t) => !tokenize(w.ex).some((y) => y.toLowerCase() === t.toLowerCase()))
        .slice(0, 2);
      return buildSentence(stage, { title: 'Превод', sub: 'Подреди думите на английски.', prompt: `<div class="big-bg">${esc(w.exBg)}</div>`, answer: w.ex, extra });
    }

    case 'say':
      return speakIt(stage, { text: w.en, bg: w.bg, emoji: w.emoji });

    case 'match': {
      const ws = step.ws.map((id) => WORD[id]);
      stage.replaceChildren(
        h('div.ex-head', {}, [h('div.ex-kind', {}, 'Чифтосване'), h('div.ex-sub', {}, 'Свържи английската дума с картинката и превода.')])
      );
      const box = h('div');
      stage.append(box);
      const results = {};
      await matchPairs(box, ws.map((x) => ({ id: x.id, left: esc(x.en), right: `${x.emoji} ${esc(x.bg)}`, say: x.en })), {
        onMatch: (p, ok) => { if (!ok) results[p.id] = false; else if (!(p.id in results)) results[p.id] = true; },
      });
      return { correct: null, multi: results };
    }

    // ----- стъпки на ниво урок -----
    case 'grammar':
      return grammarCard(stage, L.grammar, L.color);

    case 'gbuild': {
      const e = L.grammar.examples[step.i];
      const en = e.parts.map((p) => p[0]).join(' ');
      return buildSentence(stage, { title: 'Приложи правилото', sub: 'Подреди думите.', prompt: `<div class="big-bg">${esc(e.bg)}</div>`, answer: en });
    }

    case 'reading':
      return readingCard(stage, L.reading, L.color);

    case 'rq': {
      const q = L.reading.questions[step.i];
      const textBox = h('details.reading-peek', {}, [h('summary', {}, '📖 Виж текста'), ...L.reading.text.map((s) => h('p', {}, s.en))]);
      return choice(stage, {
        title: `Въпрос ${step.i + 1} от ${L.reading.questions.length}`, prompt: h('div.prompt', {}, [h('div.q', {}, q.q), textBox]),
        options: q.options.map((o, i) => ({ html: esc(o), value: i })), answer: q.answer,
      });
    }

    case 'pbuild': {
      const p = L.phrases[step.i];
      return buildSentence(stage, { title: 'Превод', sub: 'Как ще го кажеш на английски?', prompt: `<div class="big-bg">${esc(p.bg)}</div>`, answer: p.en });
    }

    case 'pchoice': {
      const p = L.phrases[step.i];
      const pool = shuffle(Object.values(LESSON).flatMap((x) => x.phrases).filter((x) => x.en !== p.en)).slice(0, 2);
      const opts = shuffle([p, ...pool]);
      return choice(stage, {
        title: 'Превод', sub: 'Какво означава?', prompt: h('div.prompt', {}, [h('div.big-en.sentence', {}, p.en), speakBtn(p.en)]), audio: p.en,
        options: opts.map((x) => ({ html: esc(x.bg), value: x.en })), answer: p.en,
      });
    }

    case 'sayp': {
      const p = L.phrases[step.i];
      return speakIt(stage, { text: p.en, bg: p.bg, title: 'Говорене – изречение' });
    }

    default:
      console.warn('Непозната стъпка', step);
      return { correct: null };
  }
}

/** Упражнение за повторение според това колко добре е известна думата. */
export function reviewType(c) {
  const iv = c?.iv || 0;
  if (iv < 1) return pick(['mcq_en_bg', 'mcq_emoji', 'audio', 'mcq_bg_en']);
  if (iv < 7) return pick(['mcq_bg_en', 'audio', 'type', 'gap', 'mcq_en_bg']);
  return pick(['type', 'dictation', 'gap', 'audio_sentence', 'build']);
}

export { say };
