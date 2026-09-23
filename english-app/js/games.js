// Режим „Свободно време“ – кратки игри по 2–3 минути.
// Думите се избират претеглено: по-слабите (често бъркани) се падат най-често.
import { h, esc, shuffle, weightedSample, sleep, vibrate } from './util.js';
import { introducedWords, weakness, grade } from './srs.js';
import { getState, save } from './store.js';
import { matchPairs, speakBtn, buildSentence } from './exercises.js';
import { distractors } from './steps.js';
import { say, stopSpeaking } from './speech.js';
import { sfx } from './sfx.js';
import { confetti } from './confetti.js';

export const GAMES = [
  { id: 'match', emoji: '🧩', name: 'Чифтосване', desc: 'Свържи думата с превода – колкото по-бързо, толкова по-добре.', min: 5 },
  { id: 'sound', emoji: '👂', name: 'Познай по звук', desc: 'Чуваш дума – избираш картинката.', min: 4 },
  { id: 'rush', emoji: '⏱️', name: 'Срещу часовника', desc: '60 секунди. Колко думи ще познаеш?', min: 4 },
  { id: 'spell', emoji: '🔤', name: 'Сглоби думата', desc: 'Подреди буквите в правилната дума.', min: 3 },
  { id: 'sentence', emoji: '🧱', name: 'Строител на изречения', desc: 'Подреди думите в изречение.', min: 3 },
  { id: 'truefalse', emoji: '✅', name: 'Вярно или грешно?', desc: 'Бързо: вярен ли е преводът?', min: 4 },
];

const pickWords = (n) => weightedSample(introducedWords(), n, weakness);

export function gamesMenu(root) {
  const n = introducedWords().length;
  const s = getState();
  root.replaceChildren(
    h('div.page', {}, [
      h('h1', {}, '🎮 Свободно време'),
      h('p.muted', {}, n ? `Игри по 2–3 минути с твоите ${n} думи. Думите, които бъркаш, се падат по-често.` : 'Първо направи първия урок – после ще играеш с научените думи.'),
      h('div.game-grid', {}, GAMES.map((g) => {
        const locked = n < g.min;
        return h(`button.game-card${locked ? '.locked' : ''}`, { type: 'button', disabled: locked, onclick: () => (location.hash = `#/game/${g.id}`) }, [
          h('div.gc-emoji', {}, g.emoji),
          h('div.gc-name', {}, g.name),
          h('div.gc-desc', {}, locked ? `🔒 Нужни са поне ${g.min} думи` : g.desc),
          s.best[g.id] ? h('div.gc-best', {}, `🏅 Рекорд: ${s.best[g.id]}`) : null,
        ]);
      })),
    ])
  );
}

export async function playGame(root, id) {
  const g = GAMES.find((x) => x.id === id);
  if (!g || introducedWords().length < g.min) return (location.hash = '#/games');
  let stopped = false;
  const stage = h('div.stage');
  const hud = h('div.hud');
  const close = h('button.btn-close', { type: 'button', 'aria-label': 'Затвори', onclick: () => { stopped = true; stopSpeaking(); location.hash = '#/games'; } }, '✕');
  root.replaceChildren(h('div.lesson-view.game-view', {}, [h('div.lesson-top', {}, [close, h('div.game-title', {}, `${g.emoji} ${g.name}`), hud]), stage]));
  const ctx = { stage, hud, stopped: () => stopped || !document.contains(stage) };
  const score = await RUNNERS[id](ctx);
  if (ctx.stopped() || score == null) return;
  const s = getState();
  const record = score > (s.best[id] || 0);
  if (record) { s.best[id] = score; save(true); confetti(); }
  sfx.win();
  stage.replaceChildren(
    h('div.finish', {}, [
      h('div.big-emoji', {}, record ? '🏆' : '⭐'),
      h('h2', {}, record ? 'Нов рекорд!' : 'Браво!'),
      h('div.score-big', {}, String(score)),
      h('p.muted', {}, `точки · рекорд: ${s.best[id] || score}`),
      h('div.ex-actions', {}, [
        h('button.btn.primary.wide', { type: 'button', onclick: () => playGame(root, id) }, '🔁 Още веднъж'),
        h('button.btn.ghost.wide', { type: 'button', onclick: () => (location.hash = '#/games') }, 'Други игри'),
      ]),
    ])
  );
}

const RUNNERS = {
  // 🧩 Чифтосване: 3 рунда по 5 двойки; точки = бързина - грешки
  async match({ stage, hud, stopped }) {
    let total = 0;
    for (let round = 1; round <= 3; round++) {
      if (stopped()) return null;
      const ws = pickWords(5);
      hud.textContent = `Рунд ${round}/3 · ${total} т.`;
      const box = h('div');
      stage.replaceChildren(h('p.muted.center', {}, 'Свържи двойките'), box);
      const bad = new Set();
      const r = await matchPairs(box, ws.map((w) => ({ id: w.id, left: esc(w.en), right: `${w.emoji} ${esc(w.bg)}`, say: w.en })), {
        onMatch: (p, ok) => { if (!ok) bad.add(p.id); },
      });
      ws.forEach((w) => grade(w.id, bad.has(w.id) ? 0 : 2));
      total += Math.max(10, Math.round(100 - r.time * 3 - r.mistakes * 10));
    }
    return total;
  },

  // 👂 По звук: 10 думи
  async sound({ stage, hud, stopped }) {
    const ws = pickWords(Math.min(10, introducedWords().length));
    let pts = 0;
    for (const [i, w] of ws.entries()) {
      if (stopped()) return null;
      hud.textContent = `${i + 1}/${ws.length} · ${pts} т.`;
      const opts = shuffle([w, ...distractors(w, 3)]);
      const ok = await quickChoice(stage, {
        prompt: h('div.prompt', {}, speakBtn(w.en, { big: true, label: '🔊 Пак' })),
        options: opts.map((x) => ({ html: `<span class="opt-emoji">${x.emoji}</span><span class="opt-cap">${esc(x.bg)}</span>`, ok: x === w })),
        onShow: () => say(w.en),
        big: true,
      });
      grade(w.id, ok ? 2 : 0);
      if (ok) pts += 10;
    }
    return pts;
  },

  // ⏱️ Срещу часовника: 60 секунди
  async rush({ stage, hud, stopped }) {
    const end = Date.now() + 60000;
    let pts = 0, streak = 0;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      hud.innerHTML = `⏱ <b>${left}</b> с · ${pts} т.${streak >= 3 ? ` · 🔥x${streak}` : ''}`;
      if (left <= 5 && left > 0) sfx.tick();
    }, 250);
    try {
      while (Date.now() < end && !stopped()) {
        const [w] = pickWords(1);
        const dir = Math.random() < 0.5;
        const opts = shuffle([w, ...distractors(w, 3)]);
        const ok = await quickChoice(stage, {
          prompt: h('div.prompt', {}, dir ? h('div.big-en', {}, w.en) : [h('div.big-emoji', {}, w.emoji), h('div.big-bg', {}, w.bg)]),
          options: opts.map((x) => ({ html: esc(dir ? x.bg : x.en), ok: x === w })),
          fast: true,
          deadline: end,
        });
        if (ok === null) break;
        grade(w.id, ok ? 2 : 0);
        if (ok) { streak++; pts += 10 + Math.min(streak, 10); } else streak = 0;
      }
    } finally {
      clearInterval(timer);
    }
    return stopped() ? null : pts;
  },

  // 🔤 Сглоби думата от букви
  async spell({ stage, hud, stopped }) {
    const ws = pickWords(8).filter((w) => w.en.replace(/[^a-z]/gi, '').length <= 12);
    let pts = 0;
    for (const [i, w] of ws.entries()) {
      if (stopped()) return null;
      hud.textContent = `${i + 1}/${ws.length} · ${pts} т.`;
      const ok = await spellRound(stage, w);
      grade(w.id, ok ? 2 : 0);
      if (ok) pts += 10 + w.en.length;
    }
    return pts;
  },

  // 🧱 Изречения от примерите на научените думи
  async sentence({ stage, hud, stopped }) {
    const ws = pickWords(5);
    let pts = 0;
    for (const [i, w] of ws.entries()) {
      if (stopped()) return null;
      hud.textContent = `${i + 1}/${ws.length} · ${pts} т.`;
      const r = await buildSentence(stage, { title: 'Подреди изречението', prompt: `<div class="big-bg">${esc(w.exBg)}</div>`, answer: w.ex });
      grade(w.id, r.correct ? 2 : 0);
      if (r.correct) pts += 20;
    }
    return pts;
  },

  // ✅ Вярно или грешно
  async truefalse({ stage, hud, stopped }) {
    let pts = 0;
    const ws = pickWords(Math.min(15, introducedWords().length));
    for (const [i, w] of ws.entries()) {
      if (stopped()) return null;
      hud.textContent = `${i + 1}/${ws.length} · ${pts} т.`;
      const truth = Math.random() < 0.5;
      const shown = truth ? w : distractors(w, 1)[0];
      const ok = await quickChoice(stage, {
        prompt: h('div.prompt', {}, [h('div.big-en', {}, w.en), h('div.tf-eq', {}, '='), h('div.big-bg', {}, `${shown.emoji} ${shown.bg}`)]),
        options: [{ html: '✅ Вярно', ok: truth }, { html: '❌ Грешно', ok: !truth }],
        onShow: () => say(w.en, { rate: 1 }),
        reveal: `${esc(w.en)} = ${w.emoji} ${esc(w.bg)}`,
        fast: true,
      });
      grade(w.id, ok ? 2 : 0);
      if (ok) pts += 10;
    }
    return pts;
  },
};

/** Бърз избор без лента за обратна връзка – за игрите. Връща true/false (null при изтекло време). */
function quickChoice(stage, { prompt, options, onShow, fast, big, deadline, reveal }) {
  return new Promise((resolve) => {
    let done = false;
    const grid = h(`div.options${big ? '.big' : ''}${options.length === 2 ? '.two' : ''}`);
    const note = h('div.quick-note');
    options.forEach((o) => {
      const b = h('button.option', { type: 'button', html: o.html });
      b.onclick = async () => {
        if (done) return;
        done = true;
        b.classList.add(o.ok ? 'right' : 'wrong');
        [...grid.children].forEach((x, i) => { if (options[i].ok) x.classList.add('right'); x.disabled = true; });
        o.ok ? sfx.ok() : sfx.bad();
        if (!o.ok) { vibrate(40); if (reveal) note.innerHTML = reveal; }
        await sleep(o.ok ? (fast ? 350 : 700) : 1300);
        resolve(o.ok);
      };
      grid.append(b);
    });
    stage.replaceChildren(prompt, grid, note);
    onShow?.();
    if (deadline) {
      const t = setInterval(() => {
        if (!document.contains(grid)) return clearInterval(t);
        if (Date.now() >= deadline && !done) { done = true; clearInterval(t); resolve(null); }
      }, 200);
    }
  });
}

function spellRound(stage, w) {
  return new Promise((resolve) => {
    const target = w.en.toLowerCase();
    const letters = shuffle([...target].filter((c) => c !== ' ').map((c, i) => ({ c, i })));
    const built = [];
    const slots = h('div.spell-slots');
    const bank = h('div.build-bank');
    let mistakes = 0;
    const clean = target.replace(/ /g, '');
    const draw = () => {
      let k = 0;
      slots.replaceChildren(...[...target].map((c) => (c === ' ' ? h('span.slot.space') : h(`span.slot${built[k] ? '.full' : ''}`, {}, built[k++]?.c || ''))));
      bank.replaceChildren(...letters.map((l) => h(`button.tile.letter${built.includes(l) ? '.used' : ''}`, {
        type: 'button', disabled: built.includes(l),
        onclick: () => {
          const need = clean[built.length];
          if (l.c === need) {
            built.push(l);
            sfx.tick();
            draw();
            if (built.length === clean.length) { sfx.ok(); say(w.en); setTimeout(() => resolve(mistakes < 3), 900); }
          } else {
            mistakes++;
            sfx.bad();
            vibrate(30);
            const btn = bank.children[letters.indexOf(l)];
            btn.classList.add('shake');
            setTimeout(() => btn.classList.remove('shake'), 400);
          }
        },
      }, l.c)));
    };
    stage.replaceChildren(
      h('div.prompt', {}, [h('div.big-emoji', {}, w.emoji), h('div.big-bg', {}, w.bg), speakBtn(w.en)]),
      slots, bank,
      h('div.ex-actions', {}, h('button.btn.ghost', { type: 'button', onclick: () => { resolve(false); } }, 'Пропусни'))
    );
    draw();
  });
}
