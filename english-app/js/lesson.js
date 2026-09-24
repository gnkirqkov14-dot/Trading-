// Дневният урок: план от раздели и упражнения + изпълнението му.
import { h, esc, shuffle, dayKey } from './util.js';
import { LESSONS, WORD, LESSON } from './content/index.js';
import { getState, save, today } from './store.js';
import { dueWords, introducedWords, weakness, grade, card, counts } from './srs.js';
import { runStep, reviewType } from './steps.js';
import { canListen, stopSpeaking } from './speech.js';
import { sfx } from './sfx.js';
import { confetti } from './confetti.js';
import { ask } from './ui.js';

// ---------- Кога може да има нови думи ----------

/** Минимален резултат на теста, за да се отключи следващият урок. */
export const PASS = 80;

export const passed = (id) => (getState().lessons[id]?.score || 0) >= PASS;

/** Първият урок, който още не е взет с нужния резултат. */
export function nextLesson() {
  return LESSONS.find((l) => !passed(l.id)) || null;
}

/**
 * Нищо ново, преди старото да е усвоено: следващ урок се отключва веднага,
 * щом тестът на предишния е взет с поне 80%. Иначе същият урок се повтаря.
 */
export function todayInfo() {
  const s = getState();
  const cur = s.current && s.current.day === dayKey() ? s.current : null;
  const next = nextLesson();
  const doneToday = (s.days[dayKey()]?.lessons || 0) > 0;
  const kind = !next ? 'review' : s.lessons[next.id] ? 'retry' : 'new';
  return { cur, next, kind, doneToday, lastScore: next ? s.lessons[next.id]?.score : null };
}

// ---------- План ----------

const SECTIONS = {
  warm: { name: 'Загрявка', emoji: '🔥' },
  words: { name: 'Нови думи', emoji: '✨' },
  grammar: { name: 'Правило', emoji: '📐' },
  listen: { name: 'Слушане', emoji: '🎧' },
  read: { name: 'Четене', emoji: '📖' },
  trans: { name: 'Превод', emoji: '🔄' },
  write: { name: 'Писане', emoji: '✍️' },
  speak: { name: 'Говорене', emoji: '🗣️' },
  test: { name: 'Тест', emoji: '🏁' },
  weak: { name: 'Слаби думи', emoji: '🎯' },
};

export function buildPlan(mode) {
  const s = getState();
  const info = todayInfo();
  if (mode === 'review') info.kind = 'review';
  const steps = [];
  const add = (sec, list) => list.forEach((st) => steps.push({ ...st, s: sec }));
  const ids = (ws) => ws.map((w) => w.id);

  // 1. Загрявка – думите, чийто момент за повторение е дошъл
  const due = dueWords(info.kind === 'review' ? 25 : 15);
  add('warm', due.map((w) => ({ t: reviewType(card(w.id)), w: w.id, g: 1 })));

  let lessonId = null;
  if (info.kind === 'new' || info.kind === 'retry') {
    const L = info.next;
    lessonId = L.id;
    const W = L.words;
    const a = W.slice(0, 5), b = W.slice(5);
    // 2. Нови думи на две порции, всяка последвана от бърза проверка
    add('words', [
      ...a.map((w, i) => ({ t: 'intro', w: w.id, i, n: W.length })),
      ...shuffle(a).map((w, i) => ({ t: i % 2 ? 'mcq_en_bg' : 'mcq_emoji', w: w.id, g: 1 })),
      ...b.map((w, i) => ({ t: 'intro', w: w.id, i: i + 5, n: W.length })),
      ...shuffle(b).map((w, i) => ({ t: i % 2 ? 'mcq_emoji' : 'mcq_en_bg', w: w.id, g: 1 })),
      { t: 'match', ws: ids(shuffle(W).slice(0, 5)), g: 1 },
      ...shuffle(W).slice(0, 4).map((w) => ({ t: 'mcq_bg_en', w: w.id, g: 1 })),
    ]);
    // 3. Граматика
    add('grammar', [{ t: 'grammar', l: L.id }, ...L.grammar.examples.slice(0, 2).map((_, i) => ({ t: 'gbuild', l: L.id, i }))]);
    // 4. Слушане
    const sh = shuffle(W);
    add('listen', [
      ...sh.slice(0, 4).map((w) => ({ t: 'audio', w: w.id, g: 1 })),
      ...sh.slice(4, 6).map((w) => ({ t: 'audio_sentence', w: w.id, g: 1 })),
      ...sh.slice(6, 8).map((w) => ({ t: 'dictation', w: w.id, g: 1 })),
    ]);
    // 5. Четене
    add('read', [{ t: 'reading', l: L.id }, ...L.reading.questions.map((_, i) => ({ t: 'rq', l: L.id, i }))]);
    // 6. Превод в двете посоки
    const sh2 = shuffle(W);
    add('trans', [
      { t: 'pchoice', l: L.id, i: 0 },
      { t: 'pbuild', l: L.id, i: 1 },
      ...sh2.slice(0, 2).map((w) => ({ t: 'build', w: w.id, g: 1 })),
      { t: 'pchoice', l: L.id, i: 2 },
      { t: 'pbuild', l: L.id, i: 0 },
    ]);
    // 7. Писане
    const sh3 = shuffle(W);
    add('write', [
      ...sh3.slice(0, 3).map((w) => ({ t: 'type', w: w.id, g: 1 })),
      ...sh3.slice(3, 6).map((w) => ({ t: 'gap', w: w.id, g: 1 })),
    ]);
    // 8. Говорене (само ако браузърът може)
    if (canListen() && s.settings.speak) {
      add('speak', [...shuffle(W).slice(0, 3).map((w) => ({ t: 'say', w: w.id, g: 1 })), { t: 'sayp', l: L.id, i: 0 }, { t: 'sayp', l: L.id, i: 1 }]);
    }
    // 9. Финален тест: всички нови думи + няколко стари
    const old = introducedWords().filter((w) => w.lesson !== L.id);
    const oldPick = shuffle(old).sort((x, y) => weakness(y) - weakness(x)).slice(0, 4);
    const testTypes = ['type', 'audio', 'mcq_bg_en', 'dictation', 'gap', 'mcq_en_bg'];
    add('test', shuffle([...W, ...oldPick]).map((w, i) => ({ t: testTypes[i % testTypes.length], w: w.id, g: 1, test: 1 })));
  } else {
    // Ден за затвърждаване – най-слабите думи, по всички умения
    const pool = introducedWords().filter((w) => !due.includes(w));
    const weak = pool.sort((x, y) => weakness(y) - weakness(x)).slice(0, 12);
    const all = [...due, ...weak];
    if (weak.length >= 4) {
      add('weak', [{ t: 'match', ws: ids(shuffle(weak).slice(0, Math.min(6, weak.length))), g: 1 }, ...weak.map((w) => ({ t: 'mcq_bg_en', w: w.id, g: 1 }))]);
    }
    const lastL = LESSONS.filter((l) => s.lessons[l.id]).slice(-1)[0];
    if (all.length) {
      const sh = shuffle(all);
      add('listen', [...sh.slice(0, 4).map((w) => ({ t: 'audio', w: w.id, g: 1 })), ...sh.slice(4, 6).map((w) => ({ t: 'audio_sentence', w: w.id, g: 1 }))]);
    }
    if (lastL) {
      const doneLs = LESSONS.filter((l) => s.lessons[l.id]);
      const rl = shuffle(doneLs)[0];
      add('read', [{ t: 'reading', l: rl.id }, ...rl.reading.questions.map((_, i) => ({ t: 'rq', l: rl.id, i }))]);
      const pl = shuffle(doneLs).slice(0, 3);
      add('trans', [
        ...pl.map((l, i) => ({ t: i % 2 ? 'pchoice' : 'pbuild', l: l.id, i: Math.floor(Math.random() * l.phrases.length) })),
        ...shuffle(all).slice(0, 2).map((w) => ({ t: 'build', w: w.id, g: 1 })),
      ]);
    }
    if (all.length) {
      const sh = shuffle(all);
      add('write', [...sh.slice(0, 3).map((w) => ({ t: 'type', w: w.id, g: 1 })), ...sh.slice(3, 6).map((w) => ({ t: 'gap', w: w.id, g: 1 }))]);
      if (canListen() && s.settings.speak) add('speak', shuffle(all).slice(0, 4).map((w) => ({ t: 'say', w: w.id, g: 1 })));
      const testTypes = ['type', 'audio', 'mcq_bg_en', 'dictation', 'gap'];
      add('test', shuffle(all).slice(0, 10).map((w, i) => ({ t: testTypes[i % testTypes.length], w: w.id, g: 1, test: 1 })));
    }
  }

  const secs = [...new Set(steps.map((x) => x.s))];
  return { day: dayKey(), lessonId, steps, idx: 0, secs, test: { ok: 0, total: 0 }, stats: { ok: 0, bad: 0 }, started: Date.now() };
}

// ---------- Изпълнение ----------

export async function runLesson(root, { onExit, mode }) {
  const s = getState();
  let plan = s.current && s.current.day === dayKey() && s.current.steps?.length ? s.current : buildPlan(mode);
  if (!plan.steps.length) {
    root.replaceChildren(h('div.page', {}, [h('div.empty', {}, [h('div.big-emoji', {}, '🎉'), h('p', {}, 'В момента няма думи за повторение. Продължи с урока или поиграй в „Свободно време“.'), h('button.btn.primary', { onclick: onExit }, 'Към началото')])]));
    return;
  }
  s.current = plan;
  save();

  const bar = h('div.progress-fill');
  const secRow = h('div.sec-row');
  const stage = h('div.stage');
  let quit = false;
  const close = h('button.btn-close', { type: 'button', 'aria-label': 'Затвори' }, '✕');
  close.onclick = async () => {
    if (await ask('Да прекъсна ли урока?', 'Прогресът ти е запазен и можеш да продължиш по-късно днес.', { yes: 'Прекъсни', no: 'Продължи урока' })) {
      quit = true;
      stopSpeaking();
      onExit();
    }
  };
  root.replaceChildren(h('div.lesson-view', {}, [h('div.lesson-top', {}, [close, h('div.progress', {}, bar)]), secRow, stage]));

  const drawSecs = () => {
    const curSec = plan.steps[plan.idx]?.s;
    secRow.replaceChildren(...plan.secs.map((k) => {
      const first = plan.steps.findIndex((x) => x.s === k);
      const last = plan.steps.length - 1 - [...plan.steps].reverse().findIndex((x) => x.s === k);
      const st = plan.idx > last ? 'done' : k === curSec ? 'now' : '';
      return h(`span.sec-chip${st ? '.' + st : ''}`, { title: SECTIONS[k].name }, [SECTIONS[k].emoji, k === curSec ? ' ' + SECTIONS[k].name : '']);
    }));
    bar.style.width = `${(plan.idx / plan.steps.length) * 100}%`;
  };

  let lastSec = null;
  while (plan.idx < plan.steps.length && !quit) {
    const step = plan.steps[plan.idx];
    drawSecs();
    if (step.s !== lastSec && lastSec !== null) await sectionIntro(stage, step.s);
    if (quit) return;
    lastSec = step.s;
    stage.scrollTop = 0;
    window.scrollTo(0, 0);
    const meta = step.t === 'intro' ? { index: step.i, total: step.n } : {};
    const res = await runStep(stage, step, meta);
    if (quit) return;
    if (step.g && step.w && res.correct != null) grade(step.w, res.correct ? res.quality ?? 2 : 0);
    if (res.multi) for (const [id, ok] of Object.entries(res.multi)) grade(id, ok ? 2 : 0);
    if (res.correct != null) {
      plan.stats[res.correct ? 'ok' : 'bad']++;
      if (step.test) { plan.test.total++; if (res.correct) plan.test.ok++; }
    }
    plan.idx++;
    save();
  }
  if (quit) return;
  bar.style.width = '100%';
  finish(root, plan, onExit);
}

function sectionIntro(stage, key) {
  const sec = SECTIONS[key];
  return new Promise((resolve) => {
    stage.replaceChildren(h('div.section-intro.pop', {}, [h('div.big-emoji', {}, sec.emoji), h('h2', {}, sec.name)]));
    setTimeout(resolve, 900);
  });
}

function finish(root, plan, onExit) {
  const s = getState();
  const pct = plan.test.total ? Math.round((plan.test.ok / plan.test.total) * 100) : 100;
  const L = plan.lessonId ? LESSON[plan.lessonId] : null;
  let ok = true;
  if (L) {
    const prev = s.lessons[L.id];
    s.lessons[L.id] = { done: plan.day, score: Math.max(pct, prev?.score || 0), tries: (prev?.tries || 0) + 1 };
    ok = pct >= PASS || (prev?.score || 0) >= PASS;
  }
  today().lessons = (today().lessons || 0) + 1;
  s.current = null;
  save(true);
  if (ok) { sfx.win(); confetti(); } else sfx.ok();
  const mins = Math.max(1, Math.round((Date.now() - plan.started) / 60000));
  const c = counts();
  const next = nextLesson();
  const again = () => runLesson(root, { onExit });

  let title, msg, actions;
  if (L && ok) {
    title = `Урок ${L.id} е взет! 🎉`;
    msg = next ? `Отключи Урок ${next.id}: ${next.emoji} ${next.title}. Можеш да продължиш веднага!` : 'Премина всички уроци! 🏆';
    actions = [
      next ? h('button.btn.primary.wide', { type: 'button', onclick: again }, `▶ Урок ${next.id}: ${next.title}`) : null,
      h('button.btn.ghost.wide', { type: 'button', onclick: () => (location.hash = '#/games') }, '🎮 Поиграй с думите'),
      h('button.btn.ghost.wide', { type: 'button', onclick: onExit }, 'Към началото'),
    ];
  } else if (L) {
    title = `Урок ${L.id}: ${pct}%`;
    msg = `За да отключиш следващия урок, трябват ${PASS}%. Думите, които сбърка, вече са отбелязани – опитай пак и ще ги знаеш! 💪`;
    actions = [
      h('button.btn.primary.wide', { type: 'button', onclick: again }, `🔁 Опитай пак урок ${L.id}`),
      h('button.btn.ghost.wide', { type: 'button', onclick: () => (location.hash = '#/games') }, '🎮 Първо поиграй с думите'),
      h('button.btn.ghost.wide', { type: 'button', onclick: onExit }, 'Към началото'),
    ];
  } else {
    title = 'Повторението е готово!';
    msg = pct >= 80 ? 'Много добре помниш думите! 🌟' : 'Думите, които сбърка, ще се върнат по-често. 🔁';
    actions = [
      next ? h('button.btn.primary.wide', { type: 'button', onclick: again }, `▶ Урок ${next.id}: ${next.title}`) : null,
      h('button.btn.ghost.wide', { type: 'button', onclick: onExit }, 'Към началото'),
    ];
  }

  root.replaceChildren(
    h('div.page.finish', {}, [
      h('div.big-emoji', {}, ok ? '🏆' : '🌱'),
      h('h1', {}, title),
      L ? h('p.muted', {}, `${L.emoji} ${L.title} – ${L.goal}`) : null,
      h(`div.score-ring${ok ? '' : '.low'}`, { style: { '--p': pct } }, [h('span', {}, `${pct}%`), h('small', {}, L ? `нужни ${PASS}%` : 'тест')]),
      h('p', {}, msg),
      h('div.tiles', {}, [
        tile('✅', plan.stats.ok, 'верни'),
        tile('🔁', plan.stats.bad, 'за повторение'),
        tile('📚', c.introduced, 'думи общо'),
        tile('⏱', mins, 'минути'),
      ]),
      h('div.ex-actions', {}, actions),
    ])
  );
}

const tile = (ico, n, label) => h('div.tile-stat', {}, [h('div.ts-ico', {}, ico), h('div.ts-n', {}, String(n)), h('div.ts-l', {}, label)]);

export { SECTIONS };
