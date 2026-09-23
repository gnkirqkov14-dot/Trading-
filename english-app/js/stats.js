// Статистика, календар, поредица, ръчно въвеждане на време, речник и настройки.
import { h, dayKey, parseDay, addDays, fmtMin } from './util.js';
import { getState, save, dayMinutes, addManual, removeManual, exportCode, decodeCode, mergeIn, resetAll } from './store.js';
import { counts, level, LEVELS, isKnown } from './srs.js';
import { WORDS, LESSONS } from './content/index.js';
import { speakBtn } from './exercises.js';
import { englishVoices, say, canListen, canSpeak } from './speech.js';

export const STREAK_MIN = 5; // минимум минути, за да се брои денят

export function streak() {
  let d = new Date();
  // Ако днес още не е отбелязан, поредицата не е прекъсната – броим от вчера.
  if (dayMinutes(dayKey(d)) < STREAK_MIN) d = addDays(d, -1);
  let n = 0;
  while (dayMinutes(dayKey(d)) >= STREAK_MIN) { n++; d = addDays(d, -1); }
  return n;
}

export function bestStreak() {
  const keys = Object.keys(getState().days).filter((k) => dayMinutes(k) >= STREAK_MIN).sort();
  let best = 0, cur = 0, prev = null;
  for (const k of keys) {
    cur = prev && dayKey(addDays(parseDay(prev), 1)) === k ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = k;
  }
  return best;
}

const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

let calMonth = null;

export function statsPage(root) {
  const s = getState();
  const c = counts();
  const goal = s.settings.goal || 30;
  const total = Object.keys(s.days).reduce((sum, k) => sum + dayMinutes(k), 0);
  const tMin = dayMinutes(dayKey());

  const page = h('div.page', {}, [
    h('div.page-head', {}, [h('h1', {}, '📊 Статистика'), h('button.btn.primary.sm', { type: 'button', onclick: () => manualDialog(() => statsPage(root)) }, '+ Добави време')]),
    h('div.tiles', {}, [
      tile('🔥', streak(), 'дни поред', `Рекорд: ${bestStreak()}`),
      tile('⏱', Math.round(tMin), 'мин днес', `Цел: ${goal}`),
      tile('🧠', c.known, 'думи знам', `${c.introduced} започнати`),
      tile('📅', fmtMin(total), 'общо', `${Object.keys(s.lessons).length}/${LESSONS.length} урока`),
    ]),
    h('section.card', {}, [h('h2', {}, 'Календар'), calendar(root, goal)]),
    h('section.card', {}, [h('h2', {}, 'Минути на ден (последните 14 дни)'), barChart(goal)]),
    h('section.card', {}, [h('h2', {}, 'Колко добре знам думите'), strengthBar(c)]),
    h('section.card', {}, [h('h2', {}, 'Ръчно добавено време'), manualList(root)]),
  ]);
  root.replaceChildren(page);
}

const tile = (ico, n, label, sub) =>
  h('div.tile-stat', {}, [h('div.ts-ico', {}, ico), h('div.ts-n', {}, String(n)), h('div.ts-l', {}, label), sub ? h('div.ts-sub', {}, sub) : null]);

function calendar(root, goal) {
  const now = new Date();
  if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysIn = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(h('div.cal-cell.blank'));
  const detail = h('div.cal-detail.muted', {}, 'Докосни ден, за да видиш подробности.');
  for (let d = 1; d <= daysIn; d++) {
    const k = dayKey(new Date(y, m, d));
    const min = dayMinutes(k);
    const cls = min >= goal ? 'full' : min >= STREAK_MIN ? 'part' : min > 0 ? 'tiny' : '';
    const isToday = k === dayKey();
    cells.push(h(`button.cal-cell${cls ? '.' + cls : ''}${isToday ? '.today' : ''}`, {
      type: 'button',
      'aria-label': `${d} ${MONTHS[m]}: ${Math.round(min)} минути`,
      onclick: () => {
        const day = getState().days[k];
        const man = (day?.manual || []).reduce((a, x) => a + x.min, 0);
        detail.innerHTML = `<b>${d} ${MONTHS[m]}</b>: ${Math.round(min)} мин` +
          (min ? ` (в приложението ${Math.round((day?.app || 0) / 60)} мин${man ? `, ръчно ${man} мин` : ''})` : '') +
          (min >= goal ? ' ✅ целта е изпълнена' : '');
      },
    }, [h('span', {}, String(d)), min >= STREAK_MIN ? h('i', {}, min >= goal ? '★' : '•') : null]));
  }
  const nav = (delta) => { calMonth = new Date(y, m + delta, 1); statsPage(root); };
  return h('div', {}, [
    h('div.cal-nav', {}, [
      h('button.btn.ghost.sm', { type: 'button', 'aria-label': 'Предишен месец', onclick: () => nav(-1) }, '‹'),
      h('b', {}, `${MONTHS[m]} ${y}`),
      h('button.btn.ghost.sm', { type: 'button', 'aria-label': 'Следващ месец', onclick: () => nav(1) }, '›'),
    ]),
    h('div.cal-grid', {}, [...WD.map((w) => h('div.cal-wd', {}, w)), ...cells]),
    h('div.cal-legend', {}, [
      h('span', {}, [h('i.sw.full'), ` ${goal}+ мин`]),
      h('span', {}, [h('i.sw.part'), ` ${STREAK_MIN}+ мин`]),
      h('span', {}, [h('i.sw.tiny'), ' под 5 мин']),
    ]),
    detail,
  ]);
}

function barChart(goal) {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    days.push({ d, k: dayKey(d), min: dayMinutes(dayKey(d)) });
  }
  const max = Math.max(goal * 1.2, ...days.map((x) => x.min));
  const tip = h('div.chart-tip.muted', {}, 'Докосни стълбче за стойност.');
  const bars = days.map((x) => {
    const pct = (x.min / max) * 100;
    return h('button.bar-col', {
      type: 'button',
      'aria-label': `${x.d.getDate()}.${x.d.getMonth() + 1}: ${Math.round(x.min)} минути`,
      onclick: (e) => {
        [...e.currentTarget.parentNode.children].forEach((b) => b.classList.remove('on'));
        e.currentTarget.classList.add('on');
        tip.innerHTML = `<b>${WD[(x.d.getDay() + 6) % 7]}, ${x.d.getDate()}.${x.d.getMonth() + 1}</b> – ${Math.round(x.min)} мин`;
      },
    }, [
      h('div.bar-area', {}, h('div.bar', { style: { height: `${pct}%` } })),
      h('div.bar-lbl', {}, WD[(x.d.getDay() + 6) % 7].slice(0, 1) + (x.k === dayKey() ? '•' : '')),
    ]);
  });
  const goalLine = h('div.goal-line', { style: { bottom: `${(goal / max) * 100}%` } }, h('span', {}, `цел ${goal}`));
  return h('div', {}, [h('div.bar-chart', {}, [goalLine, ...bars]), tip]);
}

function strengthBar(c) {
  const total = c.introduced || 1;
  if (!c.introduced) return h('p.muted', {}, 'Още няма думи. Започни първия урок!');
  return h('div', {}, [
    h('div.stack', {}, c.byLevel.map((n, i) => (n ? h('div.stack-seg', { style: { flex: n, background: `var(--lv${i})` }, title: `${LEVELS[i].name}: ${n}` }) : null))),
    h('div.stack-legend', {}, c.byLevel.map((n, i) => h('span', {}, [h('i.sw', { style: { background: `var(--lv${i})` } }), ` ${LEVELS[i].name}: `, h('b', {}, String(n))]))),
    h('p.small.muted', {}, '„Знам“ = познал си думата поне в два различни дни. Колкото по-дълго я помниш, толкова по-рядко идва за повторение.'),
  ]);
}

function manualList(root) {
  const s = getState();
  const rows = [];
  for (const k of Object.keys(s.days).sort().reverse()) {
    for (const m of s.days[k].manual || []) rows.push({ k, m });
  }
  if (!rows.length) return h('p.muted', {}, 'Учил си извън приложението (урок в чат, книга, филм)? Добави времето с бутона „+ Добави време“.');
  return h('ul.manual-list', {}, rows.slice(0, 30).map(({ k, m }) => {
    const d = parseDay(k);
    return h('li', {}, [
      h('span', {}, `${d.getDate()}.${d.getMonth() + 1} · `),
      h('b', {}, `${m.min} мин`),
      m.note ? h('span.muted', {}, ` · ${m.note}`) : null,
      h('button.btn-x', { type: 'button', 'aria-label': 'Изтрий', onclick: () => { if (confirm('Да изтрия ли този запис?')) { removeManual(k, m.id); statsPage(root); } } }, '🗑'),
    ]);
  }));
}

// ---------- Ръчно въвеждане на време ----------

export function manualDialog(onDone) {
  let min = 15;
  const input = h('input.num-input', { type: 'number', min: 1, max: 600, value: min, inputmode: 'numeric' });
  const date = h('input.date-input', { type: 'date', value: dayKey(), max: dayKey() });
  const note = h('input.text-input', { type: 'text', placeholder: 'Напр. урок в чат, филм с субтитри…', maxlength: 80 });
  const quick = h('div.quick-mins', {}, [10, 15, 20, 30, 45, 60].map((n) =>
    h('button.chip', { type: 'button', onclick: (e) => { input.value = n; [...e.target.parentNode.children].forEach((x) => x.classList.toggle('on', x === e.target)); } }, `${n} мин`)));
  const dlg = modal('⏱ Добави учене извън приложението', [
    h('label', {}, 'Колко минути?'), quick, input,
    h('label', {}, 'Кога?'), date,
    h('label', {}, 'Какво учи? (по желание)'), note,
  ], [
    { text: 'Отказ' },
    {
      text: 'Запази', primary: true, onclick: () => {
        const v = Math.round(Number(input.value));
        if (!v || v < 1 || v > 600) { alert('Въведи минути между 1 и 600.'); return false; }
        addManual(date.value || dayKey(), v, note.value.trim());
        onDone?.();
      },
    },
  ]);
  return dlg;
}

export function modal(title, body, buttons) {
  const close = () => { wrap.remove(); document.body.classList.remove('modal-open'); };
  const wrap = h('div.modal-back', { onclick: (e) => { if (e.target === wrap) close(); } }, [
    h('div.modal', { role: 'dialog', 'aria-modal': 'true' }, [
      h('h2', {}, title),
      h('div.modal-body', {}, body),
      h('div.modal-actions', {}, buttons.map((b) => h(`button.btn${b.primary ? '.primary' : '.ghost'}`, {
        type: 'button', onclick: () => { if (b.onclick?.() !== false) close(); },
      }, b.text))),
    ]),
  ]);
  document.body.append(wrap);
  document.body.classList.add('modal-open');
  return { close };
}

// ---------- Речник ----------

let dictFilter = 'all';
export function dictionaryPage(root) {
  const s = getState();
  const q = h('input.text-input.search', { type: 'search', placeholder: '🔍 Търси на английски или български…' });
  const list = h('div.dict-list');
  const filters = [['all', 'Всички'], ['weak', 'За упражнение'], ['known', 'Знам']];
  const fRow = h('div.chips', {}, filters.map(([k, t]) => h(`button.chip${dictFilter === k ? '.on' : ''}`, { type: 'button', onclick: () => { dictFilter = k; dictionaryPage(root); } }, t)));
  const draw = () => {
    const term = q.value.trim().toLowerCase();
    const ws = WORDS.filter((w) => s.cards[w.id])
      .filter((w) => dictFilter === 'all' || (dictFilter === 'known' ? isKnown(s.cards[w.id]) : !isKnown(s.cards[w.id])))
      .filter((w) => !term || w.en.toLowerCase().includes(term) || w.bg.toLowerCase().includes(term));
    if (!ws.length) {
      list.replaceChildren(h('p.muted.center', {}, Object.keys(s.cards).length ? 'Няма такива думи.' : 'Тук ще се появяват думите, които учиш. 📚'));
      return;
    }
    list.replaceChildren(...ws.map((w) => {
      const lv = level(s.cards[w.id]);
      return h('div.dict-row', {}, [
        h('div.dr-emoji', {}, w.emoji),
        h('div.dr-text', {}, [h('div.dr-en', {}, w.en), h('div.dr-bg', {}, w.bg)]),
        h('span.lv-dot', { style: { background: `var(--lv${lv})` }, title: LEVELS[lv].name }),
        speakBtn(w.en, { slow: false }),
      ]);
    }));
  };
  q.oninput = draw;
  root.replaceChildren(h('div.page', {}, [h('h1', {}, '📚 Моите думи'), q, fRow, list]));
  draw();
}

// ---------- Настройки и пренос ----------

export function settingsPage(root) {
  const s = getState();
  const set = (k, v) => { s.settings[k] = v; save(true); };
  const voices = englishVoices();
  const voiceSel = h('select.select', { onchange: (e) => { set('voice', e.target.value); say('Hello! How are you today?'); } }, [
    h('option', { value: '' }, 'Автоматично (най-добрият)'),
    ...voices.map((v) => h('option', { value: v.name, selected: v.name === s.settings.voice }, `${v.name} (${v.lang})`)),
  ]);
  const rate = h('input', { type: 'range', min: 0.5, max: 1.2, step: 0.05, value: s.settings.rate, onchange: (e) => { set('rate', Number(e.target.value)); say('This is my speed.'); } });
  const goal = h('select.select', { onchange: (e) => set('goal', Number(e.target.value)) }, [10, 15, 20, 30, 45, 60].map((n) => h('option', { value: n, selected: n === s.settings.goal }, `${n} минути на ден`)));
  const toggle = (k, label, disabledNote) => h('label.switch-row', {}, [
    h('span', {}, [label, disabledNote ? h('small.muted', {}, ` (${disabledNote})`) : null]),
    h('input', { type: 'checkbox', checked: !!s.settings[k], disabled: !!disabledNote, onchange: (e) => set(k, e.target.checked) }),
  ]);
  const codeOut = h('textarea.code', { readonly: true, rows: 3, placeholder: 'Натисни „Създай код“' });
  const codeIn = h('textarea.code', { rows: 3, placeholder: 'Постави кода от другото устройство тук…' });
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true });

  const doImport = async (text) => {
    try {
      const data = await decodeCode(text);
      mergeIn(data);
      alert('✅ Прогресът е обединен успешно!');
      location.hash = '#/';
    } catch (e) {
      alert('❌ Кодът не е валиден. Провери дали е копиран целият.');
    }
  };
  fileIn.onchange = async () => { const f = fileIn.files[0]; if (f) doImport(await f.text()); };

  root.replaceChildren(h('div.page', {}, [
    h('h1', {}, '⚙️ Настройки'),
    h('section.card', {}, [
      h('h2', {}, '🔊 Глас'),
      canSpeak() ? null : h('p.warn', {}, 'Този браузър не може да произнася текст.'),
      h('label', {}, 'Глас'), voiceSel,
      h('label', {}, 'Скорост'), rate,
      toggle('autoplay', 'Автоматично произнасяне'),
      toggle('speak', 'Упражнения с говорене (микрофон)', canListen() ? null : 'не се поддържа тук – ползвай Chrome или Safari'),
    ]),
    h('section.card', {}, [h('h2', {}, '🎯 Дневна цел'), goal]),
    h('section.card', {}, [
      h('h2', {}, '🔄 Пренос между телефон и компютър'),
      h('p.small', { html: 'Прогресът се пази на това устройство. За да го пренесеш:<br>1) Тук натисни <b>„Създай код“</b> и го изпрати на себе си (Viber, имейл…).<br>2) На другото устройство отвори Настройки → постави кода → <b>„Обедини“</b>.<br>Нищо не се губи – от двете устройства се взима по-новото.' }),
      codeOut,
      h('div.ex-actions.row', {}, [
        h('button.btn.primary', { type: 'button', onclick: async () => { codeOut.value = await exportCode(); codeOut.select(); } }, 'Създай код'),
        h('button.btn.ghost', { type: 'button', onclick: async () => {
          if (!codeOut.value) codeOut.value = await exportCode();
          try { await navigator.clipboard.writeText(codeOut.value); alert('📋 Копирано!'); } catch { codeOut.select(); document.execCommand('copy'); }
        } }, '📋 Копирай'),
        navigator.share ? h('button.btn.ghost', { type: 'button', onclick: async () => {
          if (!codeOut.value) codeOut.value = await exportCode();
          try { await navigator.share({ title: 'Моят прогрес по английски', text: codeOut.value }); } catch {}
        } }, '📤 Сподели') : null,
        h('button.btn.ghost', { type: 'button', onclick: () => {
          const blob = new Blob([JSON.stringify({ ...getState(), current: null })], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `english-progress-${dayKey()}.json` });
          document.body.append(a); a.click(); a.remove();
        } }, '💾 Файл'),
      ]),
      h('label', {}, 'Код от другото устройство'),
      codeIn,
      h('div.ex-actions.row', {}, [
        h('button.btn.primary', { type: 'button', onclick: () => codeIn.value.trim() && doImport(codeIn.value) }, 'Обедини'),
        h('button.btn.ghost', { type: 'button', onclick: () => fileIn.click() }, '📂 От файл'),
        fileIn,
      ]),
    ]),
    h('section.card', {}, [
      h('h2', {}, '📱 Инсталирай като приложение'),
      h('p.small', { html: '<b>iPhone (Safari):</b> бутон „Сподели“ ⬆️ → „Добави към началния екран“.<br><b>Android (Chrome):</b> меню ⋮ → „Инсталирай приложението“ / „Добави към началния екран“.<br><b>Компютър (Chrome/Edge):</b> иконата ⊕ в адресната лента.' }),
    ]),
    h('section.card.danger', {}, [
      h('h2', {}, '⚠️ Изтриване'),
      h('button.btn.ghost', { type: 'button', onclick: () => {
        if (confirm('Сигурен ли си? Целият прогрес ще бъде изтрит от това устройство.') && confirm('Наистина ли? Това не може да се върне.')) { resetAll(); location.hash = '#/'; }
      } }, 'Изтрий целия прогрес'),
    ]),
    h('p.small.muted.center', {}, 'English A1 · работи и без интернет'),
  ]));
}
