// Упражнения. Всяко упражнение рисува в `stage` и връща Promise с резултат:
// { correct: true|false|null, quality: 0..3 }  (null = пропуснато)
import { h, esc, shuffle, norm, diffHtml, levenshtein, vibrate, sleep } from './util.js';
import { say, canListen, listen, LISTEN_ERRORS, canSpeak } from './speech.js';
import { getState } from './store.js';
import { sfx } from './sfx.js';

// ---------- Общи части ----------

export function speakBtn(text, { big = false, slow = true, label } = {}) {
  const wrap = h('span.speak-wrap');
  const b = h(`button.btn-speak${big ? '.big' : ''}`, { type: 'button', 'aria-label': 'Чуй', onclick: (e) => { e.stopPropagation(); say(text); } }, label || '🔊');
  wrap.append(b);
  if (slow) wrap.append(h('button.btn-speak.slow', { type: 'button', 'aria-label': 'Чуй бавно', onclick: (e) => { e.stopPropagation(); say(text, { slow: true }); } }, '🐢'));
  if (!canSpeak()) wrap.hidden = true;
  return wrap;
}

/** Долна лента с обратна връзка. Връща Promise, изпълнен при "Продължи". */
function feedback(stage, { ok, title, html, speak, almost }) {
  return new Promise((resolve) => {
    ok ? sfx.ok() : sfx.bad();
    vibrate(ok ? 15 : [30, 40, 30]);
    const bar = h(`div.feedback.${ok ? (almost ? 'almost' : 'good') : 'bad'}`, {}, [
      h('div.fb-title', {}, title || (ok ? pickPraise() : 'Не съвсем…')),
      html ? h('div.fb-body', { html }) : null,
      h('div.fb-actions', {}, [
        speak ? speakBtn(speak) : null,
        h('button.btn.primary.fb-next', { type: 'button', onclick: () => { bar.remove(); resolve(); } }, 'Продължи ➜'),
      ]),
    ]);
    stage.append(bar);
    if (speak && getState().settings.autoplay) say(speak);
    setTimeout(() => bar.querySelector('.fb-next')?.focus(), 50);
  });
}

const PRAISE = ['Браво! 🎉', 'Точно така! ✅', 'Супер! ⭐', 'Отлично! 💪', 'Вярно! 👏', 'Чудесно! 🌟'];
const pickPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

function header(title, sub) {
  return h('div.ex-head', {}, [h('div.ex-kind', {}, title), sub ? h('div.ex-sub', { html: sub }) : null]);
}

// ---------- 1. Нова дума (карта) ----------

export function introCard(stage, w, { index, total } = {}) {
  return new Promise((resolve) => {
    const s = getState().settings;
    const card = h('div.word-card.pop', { style: { '--c': w._color || 'var(--accent)' } }, [
      h('div.wc-emoji', {}, w.emoji),
      h('div.wc-en', {}, [w.en, ' ', speakBtn(w.en, { big: true })]),
      h('div.wc-bg', {}, w.bg),
      h('div.wc-ex', {}, [
        h('div.wc-ex-en', { html: highlight(w.ex, w.en) }),
        h('div.wc-ex-bg', {}, w.exBg),
        speakBtn(w.ex),
      ]),
      w.tip ? h('div.wc-tip', {}, ['💡 ', w.tip]) : null,
    ]);
    const speakArea = h('div.speak-area');
    if (canListen() && s.speak) speakArea.append(micButton(w.en, { compact: true }));
    stage.replaceChildren(
      header(index != null ? `Нова дума ${index + 1} от ${total}` : 'Нова дума', 'Погледни, чуй и повтори на глас.'),
      card,
      speakArea,
      h('div.ex-actions', {}, h('button.btn.primary.wide', { type: 'button', onclick: () => resolve({ correct: null }) }, 'Запомних ➜'))
    );
    if (s.autoplay) setTimeout(() => say(w.en).then(() => sleep(350)).then(() => document.contains(card) && say(w.ex)), 250);
  });
}

function highlight(sentence, word) {
  const re = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
  return esc(sentence).replace(re, '<mark>$1</mark>');
}

// ---------- 2. Избор от няколко отговора ----------

/**
 * opts: { title, sub, prompt (Node|string), audio (текст за автоматично произнасяне),
 *         options: [{ html, value }], answer (value), explain (html при грешка), speak (след отговор) }
 */
export function choice(stage, opts) {
  return new Promise((resolve) => {
    let answered = false;
    const grid = h(`div.options${opts.options.length > 4 ? '.many' : ''}${opts.optionsBig ? '.big' : ''}`);
    for (const o of opts.options) {
      const b = h('button.option', { type: 'button', html: o.html });
      b.addEventListener('click', async () => {
        if (answered) return;
        answered = true;
        const ok = o.value === opts.answer;
        b.classList.add(ok ? 'right' : 'wrong');
        [...grid.children].forEach((x, i) => { if (opts.options[i].value === opts.answer) x.classList.add('right'); x.disabled = true; });
        await feedback(stage, { ok, speak: opts.speak, html: ok ? opts.okHtml : opts.explain });
        resolve({ correct: ok, quality: ok ? 2 : 0 });
      });
      grid.append(b);
    }
    const promptEl = typeof opts.prompt === 'string' ? h('div.prompt', { html: opts.prompt }) : opts.prompt;
    stage.replaceChildren(header(opts.title, opts.sub), promptEl, grid);
    if (opts.audio && getState().settings.autoplay) setTimeout(() => say(opts.audio), 250);
  });
}

// ---------- 3. Писане с поправка ----------

/** opts: { title, sub, prompt, answers: [..], speak, hintLetters } */
export function typeAnswer(stage, opts) {
  return new Promise((resolve) => {
    const main = opts.answers[0];
    const input = h('input.type-input', {
      type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
      placeholder: 'Напиши на английски…', enterkeyhint: 'done', lang: 'en',
    });
    let hintUsed = 0;
    const hintBtn = h('button.btn.ghost', { type: 'button' }, '💡 Подсказка');
    hintBtn.onclick = () => {
      hintUsed++;
      input.value = main.slice(0, Math.min(main.length - 1, hintUsed));
      input.focus();
      if (hintUsed >= main.length - 1) hintBtn.disabled = true;
    };
    const check = h('button.btn.primary', { type: 'submit' }, 'Провери');
    const form = h('form.type-form', {}, [input, h('div.ex-actions.row', {}, [hintBtn, check])]);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const typed = input.value.trim();
      if (!typed) { input.focus(); return; }
      input.disabled = true; check.disabled = true; hintBtn.disabled = true;
      const t = norm(typed);
      const exact = opts.answers.some((a) => norm(a) === t);
      const closest = opts.answers.reduce((best, a) => {
        const d = levenshtein(t, norm(a));
        return d < best.d ? { a, d } : best;
      }, { a: main, d: Infinity });
      const almost = !exact && closest.d <= (norm(closest.a).length >= 8 ? 2 : 1) && norm(closest.a).length >= 4;
      const ok = exact || almost;
      let html;
      if (exact) html = hintUsed ? `С малко помощ – <b>${esc(main)}</b>` : null;
      else html = `<div class="diff-label">Ти написа:</div><div class="diff">${esc(typed)}</div>
        <div class="diff-label">Правилно:</div><div class="diff">${diffHtml(typed, closest.a)}</div>
        ${almost ? '<div class="small">Малка грешка в буква – приемам, но запомни правописа 😉</div>' : ''}`;
      await feedback(stage, { ok, almost, title: almost ? 'Почти! ✍️' : undefined, html, speak: opts.speak || main });
      resolve({ correct: ok, quality: exact ? (hintUsed ? 1 : 2) : almost ? 1 : 0 });
    };
    const promptEl = typeof opts.prompt === 'string' ? h('div.prompt', { html: opts.prompt }) : opts.prompt;
    stage.replaceChildren(header(opts.title, opts.sub), promptEl, form);
    if (opts.audio && getState().settings.autoplay) setTimeout(() => say(opts.audio), 250);
    setTimeout(() => input.focus(), 300);
  });
}

// ---------- 4. Подреди изречението ----------

export function tokenize(sentence) {
  return sentence.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean);
}

/** opts: { title, sub, prompt, answer (английско изречение), extra: [думи-капани] } */
export function buildSentence(stage, opts) {
  return new Promise((resolve) => {
    const target = tokenize(opts.answer);
    const tiles = shuffle([...target, ...(opts.extra || [])].map((t, i) => ({ t, i })));
    const line = h('div.build-line');
    const bank = h('div.build-bank');
    const chosen = [];
    const render = () => {
      line.replaceChildren(...chosen.map((tile) => h('button.tile.in', { type: 'button', onclick: () => { chosen.splice(chosen.indexOf(tile), 1); render(); } }, tile.t)));
      if (!chosen.length) line.append(h('span.placeholder', {}, 'Докосни думите по ред…'));
      bank.replaceChildren(...tiles.map((tile) => {
        const used = chosen.includes(tile);
        return h(`button.tile${used ? '.used' : ''}`, { type: 'button', disabled: used, onclick: () => { chosen.push(tile); say(tile.t, { rate: 1 }); render(); } }, tile.t);
      }));
      check.disabled = !chosen.length;
    };
    const check = h('button.btn.primary.wide', { type: 'button' }, 'Провери');
    check.onclick = async () => {
      check.disabled = true;
      const built = chosen.map((c) => c.t).join(' ');
      const ok = norm(built) === norm(target.join(' '));
      [...line.children].forEach((x) => (x.disabled = true));
      [...bank.children].forEach((x) => (x.disabled = true));
      await feedback(stage, {
        ok,
        html: ok ? null : `<div class="diff-label">Правилно:</div><div class="diff big">${esc(opts.answer)}</div>`,
        speak: opts.answer,
      });
      resolve({ correct: ok, quality: ok ? 2 : 0 });
    };
    const promptEl = typeof opts.prompt === 'string' ? h('div.prompt', { html: opts.prompt }) : opts.prompt;
    stage.replaceChildren(header(opts.title, opts.sub), promptEl, line, bank, h('div.ex-actions', {}, check));
    render();
  });
}

// ---------- 5. Говорене ----------

function micButton(expected, { compact = false, onResult } = {}) {
  const out = h('div.mic-result');
  const btn = h(`button.btn-mic${compact ? '.compact' : ''}`, { type: 'button' }, [h('span.mic-ico', {}, '🎤'), h('span', {}, compact ? 'Кажи го' : 'Натисни и кажи')]);
  btn.onclick = async () => {
    btn.classList.add('listening');
    btn.disabled = true;
    out.innerHTML = '<span class="small">Слушам… 👂</span>';
    const r = await listen(expected);
    btn.classList.remove('listening');
    btn.disabled = false;
    if (r.error) {
      out.innerHTML = `<span class="warn">${esc(LISTEN_ERRORS[r.error] || LISTEN_ERRORS.error)}</span>`;
    } else if (r.ok) {
      sfx.ok();
      out.innerHTML = `<span class="good-text">✅ Чух: „${esc(r.heard)}“ – отлично произношение!</span>`;
    } else {
      sfx.bad();
      out.innerHTML = `<span class="bad-text">🤔 Чух: „${esc(r.heard)}“. Чуй пак 🔊 и опитай отново.</span>`;
    }
    onResult?.(r);
  };
  return h('div.mic-wrap', {}, [btn, out]);
}

/** Връща {correct:null} ако браузърът не поддържа или е пропуснато. */
export function speakIt(stage, { text, bg, emoji, title = 'Говорене' }) {
  return new Promise((resolve) => {
    if (!canListen() || !getState().settings.speak) return resolve({ correct: null });
    let tries = 0;
    const next = h('button.btn.primary.wide', { type: 'button', disabled: true }, 'Продължи ➜');
    let result = null;
    const mic = micButton(text, {
      onResult: (r) => {
        if (r.error === 'not-allowed' || r.error === 'service-not-allowed' || r.error === 'unsupported') {
          next.disabled = false;
          return;
        }
        if (r.error) return;
        tries++;
        if (r.ok && result === null) result = { correct: true, quality: tries === 1 ? 2 : 1 };
        if (r.ok || tries >= 3) next.disabled = false;
        if (!r.ok && tries >= 3) result = result || { correct: false, quality: 0 };
      },
    });
    next.onclick = () => resolve(result || { correct: null });
    stage.replaceChildren(
      header(title, 'Чуй и кажи на глас. Приложението ще провери произношението ти.'),
      h('div.prompt.speak-prompt', {}, [
        emoji ? h('div.big-emoji', {}, emoji) : null,
        h('div.say-en', {}, text),
        bg ? h('div.say-bg', {}, bg) : null,
        speakBtn(text, { big: true }),
      ]),
      mic,
      h('div.ex-actions.row', {}, [
        h('button.btn.ghost', { type: 'button', onclick: () => resolve({ correct: null }) }, 'Не мога сега'),
        next,
      ])
    );
    if (getState().settings.autoplay) setTimeout(() => say(text), 250);
  });
}

// ---------- 6. Граматика ----------

export function grammarCard(stage, g, color) {
  return new Promise((resolve) => {
    const legend = h('div.legend', {}, [
      h('span.p-s', {}, 'кой'), h('span.p-v', {}, 'действие'), h('span.p-o', {}, 'какво/къде'), h('span.p-k', {}, 'правилото'),
    ]);
    const table = g.table?.length
      ? h('table.g-table', {}, g.table.map((row) => h('tr', {}, row.map((c, i) => h(i === 0 ? 'th' : 'td', {}, c)))))
      : null;
    const ex = (g.examples || []).map((e) => {
      const en = e.parts.map(([t, k]) => (k ? `<span class="p-${k}">${esc(t)}</span>` : esc(t))).join(' ');
      const plain = e.parts.map((p) => p[0]).join(' ');
      return h('div.g-example', {}, [h('div.g-en', { html: en }), h('div.g-bg', {}, e.bg), speakBtn(plain)]);
    });
    stage.replaceChildren(
      header('Правило', 'Прочети спокойно и чуй примерите.'),
      h('div.grammar-card', { style: { '--c': color } }, [
        h('h2', {}, g.title),
        h('p', { html: g.explain }),
        table,
        legend,
        ...ex,
      ]),
      h('div.ex-actions', {}, h('button.btn.primary.wide', { type: 'button', onclick: () => resolve({ correct: null }) }, 'Разбрах ➜'))
    );
  });
}

// ---------- 7. Четене ----------

export function readingCard(stage, r, color) {
  return new Promise((resolve) => {
    let showBg = false;
    const lines = r.text.map((s) =>
      h('div.r-line', {}, [
        h('button.r-en', { type: 'button', onclick: () => say(s.en) }, s.en),
        h('div.r-bg', {}, s.bg),
      ])
    );
    const box = h('div.reading-card', { style: { '--c': color } }, [h('h2', {}, ['📖 ', r.title]), ...lines]);
    const toggle = h('button.btn.ghost', { type: 'button' }, '👁 Покажи превода');
    toggle.onclick = () => {
      showBg = !showBg;
      box.classList.toggle('show-bg', showBg);
      toggle.textContent = showBg ? '🙈 Скрий превода' : '👁 Покажи превода';
    };
    const playAll = h('button.btn.ghost', { type: 'button' }, '🔊 Чуй целия текст');
    playAll.onclick = async () => {
      for (const [i, s] of r.text.entries()) {
        if (!document.contains(box)) return;
        lines.forEach((l, j) => l.classList.toggle('reading-now', i === j));
        await say(s.en);
        await sleep(250);
      }
      lines.forEach((l) => l.classList.remove('reading-now'));
    };
    stage.replaceChildren(
      header('Четене', 'Прочети текста. Докосни изречение, за да го чуеш. Опитай първо без превод!'),
      box,
      h('div.ex-actions.row', {}, [playAll, toggle]),
      h('div.ex-actions', {}, h('button.btn.primary.wide', { type: 'button', onclick: () => resolve({ correct: null }) }, 'Към въпросите ➜'))
    );
  });
}

// ---------- 8. Чифтосване (за урока и за играта) ----------

/** pairs: [{ id, left, right }] – връща { mistakes, time } */
export function matchPairs(container, pairs, { onMatch } = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    let mistakes = 0, found = 0, selected = null;
    const left = shuffle(pairs).map((p) => ({ p, side: 'L', html: p.left }));
    const right = shuffle(pairs).map((p) => ({ p, side: 'R', html: p.right }));
    const mk = (item) => {
      const b = h('button.match-tile', { type: 'button', html: item.html });
      b.onclick = () => {
        if (b.classList.contains('done')) return;
        if (item.side === 'L' && item.p.say) say(item.p.say, { rate: 1 });
        if (!selected || selected.item.side === item.side) {
          selected?.b.classList.remove('sel');
          selected = { item, b };
          b.classList.add('sel');
          return;
        }
        if (selected.item.p.id === item.p.id) {
          sfx.ok();
          selected.b.classList.remove('sel');
          selected.b.classList.add('done');
          b.classList.add('done');
          onMatch?.(item.p, true);
          selected = null;
          if (++found === pairs.length) setTimeout(() => resolve({ mistakes, time: (Date.now() - start) / 1000 }), 350);
        } else {
          sfx.bad();
          vibrate(40);
          mistakes++;
          onMatch?.(selected.item.p, false);
          onMatch?.(item.p, false);
          const a = selected.b;
          a.classList.add('shake'); b.classList.add('shake');
          setTimeout(() => { a.classList.remove('shake', 'sel'); b.classList.remove('shake'); }, 400);
          selected = null;
        }
      };
      return b;
    };
    container.replaceChildren(
      h('div.match-grid', {}, [h('div.match-col', {}, left.map(mk)), h('div.match-col', {}, right.map(mk))])
    );
  });
}
