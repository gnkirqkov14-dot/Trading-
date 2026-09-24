// Главен файл: навигация, начален екран, отчитане на времето.
import { h, esc, dayKey } from './util.js';
import { getState, save, today, dayMinutes, onExternalChange } from './store.js';
import { LESSONS, LESSON } from './content/index.js';
import { counts } from './srs.js';
import { todayInfo, runLesson } from './lesson.js';
import { gamesMenu, playGame, GAMES } from './games.js';
import { statsPage, dictionaryPage, settingsPage, manualDialog, streak, modal } from './stats.js';
import { speakBtn } from './exercises.js';
import { stopSpeaking } from './speech.js';

const main = document.getElementById('main');
const nav = document.getElementById('nav');

// ---------- Отчитане на времето ----------
// Броим само реално активно време: страницата е видима и е имало действие в последните 90 секунди.
let lastActive = Date.now();
['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((ev) => addEventListener(ev, () => (lastActive = Date.now()), { passive: true }));
let ticks = 0;
setInterval(() => {
  if (document.visibilityState !== 'visible' || Date.now() - lastActive > 90000) return;
  today().app = (today().app || 0) + 1;
  if (++ticks % 15 === 0) { save(); updateNavBadge(); }
}, 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(true); });
addEventListener('pagehide', () => save(true));

// ---------- Навигация ----------

const ROUTES = [
  { path: '/', label: 'Днес', ico: '🏠' },
  { path: '/games', label: 'Игри', ico: '🎮' },
  { path: '/words', label: 'Думи', ico: '📚' },
  { path: '/stats', label: 'Статистика', ico: '📊' },
];

function drawNav(path) {
  nav.replaceChildren(...ROUTES.map((r) =>
    h(`a.nav-item${path === r.path ? '.on' : ''}`, { href: `#${r.path}` }, [h('span.nav-ico', {}, r.ico), h('span.nav-lbl', {}, r.label)])));
}
function updateNavBadge() {
  const m = Math.round(dayMinutes(dayKey()));
  const el = document.getElementById('today-min');
  if (el) el.textContent = m;
}

function route() {
  stopSpeaking();
  const path = location.hash.replace(/^#/, '') || '/';
  const full = path === '/lesson' || path.startsWith('/game/');
  document.body.classList.toggle('fullscreen', full);
  drawNav(path);
  main.scrollTop = 0;
  window.scrollTo(0, 0);
  if (path === '/') return home();
  if (path === '/lesson') return runLesson(main, { onExit: () => (location.hash = '#/') });
  if (path === '/games') return gamesMenu(main);
  if (path.startsWith('/game/')) return playGame(main, path.split('/')[2]);
  if (path === '/words') return dictionaryPage(main);
  if (path === '/stats') return statsPage(main);
  if (path === '/settings') return settingsPage(main);
  location.hash = '#/';
}
addEventListener('hashchange', route);
onExternalChange(() => {
  // В друг раздел има промяна – обновяваме екрана (освен по време на урок/игра).
  if (!document.body.classList.contains('fullscreen')) route();
});

// ---------- Начален екран ----------

function greeting() {
  const hr = new Date().getHours();
  if (hr < 11) return ['Good morning!', 'Добро утро'];
  if (hr < 18) return ['Hello!', 'Здравей'];
  return ['Good evening!', 'Добър вечер'];
}

function home() {
  const s = getState();
  const info = todayInfo();
  const c = counts();
  const goal = s.settings.goal || 30;
  const min = dayMinutes(dayKey());
  const pct = Math.min(100, (min / goal) * 100);
  const [gEn, gBg] = greeting();
  const st = streak();

  // Главната карта с днешния урок
  let title, sub, btn, color = 'var(--accent)', emoji = '📘';
  if (info.cur) {
    const L = info.cur.lessonId ? LESSON[info.cur.lessonId] : null;
    title = L ? `Урок ${L.id}: ${L.title}` : 'Затвърждаване';
    sub = `Започнат – ${Math.round((info.cur.idx / info.cur.steps.length) * 100)}% готово`;
    btn = '▶ Продължи урока';
    if (L) { color = L.color; emoji = L.emoji; }
  } else if (info.kind === 'new') {
    const L = info.next;
    title = `Урок ${L.id}: ${L.title}`;
    sub = L.goal;
    btn = info.doneToday ? '▶ Още един урок' : '▶ Започни днешния урок';
    color = L.color; emoji = L.emoji;
  } else {
    title = 'Ден за затвърждаване';
    emoji = '🎯';
    color = '#7E57C2';
    if (!info.next) sub = 'Премина всички уроци! 🏆 Повтаряй, за да не забравяш.';
    else if (info.newToday) sub = 'Днес вече научи нови думи. Сега е време да ги затвърдиш – новият урок идва утре 😴';
    else sub = `${info.gate.reason} Урок ${info.next.id} ще се отключи след малко повторение.`;
    btn = info.doneToday ? '▶ Още упражнения' : '▶ Започни упражненията';
  }

  const doneBadge = info.doneToday ? h('div.done-badge', {}, '✓ Днес вече учи – браво!') : null;

  main.replaceChildren(h('div.page.home', {}, [
    h('div.home-head', {}, [
      h('div', {}, [h('div.hello', {}, [gEn, ' ', speakBtn(gEn, { slow: false })]), h('div.muted', {}, gBg + '!')]),
      h('a.icon-btn', { href: '#/settings', 'aria-label': 'Настройки' }, '⚙️'),
    ]),
    h('div.today-row', {}, [
      h('div.ring', { style: { '--p': pct }, 'aria-label': `${Math.round(min)} от ${goal} минути днес` }, [
        h('div.ring-in', {}, [h('b#today-min', {}, String(Math.round(min))), h('small', {}, `/ ${goal} мин`)]),
      ]),
      h('div.today-stats', {}, [
        h('div.streak', {}, [h('span.flame' + (st ? '.lit' : ''), {}, '🔥'), h('b', {}, String(st)), ` ${st === 1 ? 'ден' : 'дни'} поред`]),
        h('div.muted', {}, `🧠 ${c.known} думи знам · ${c.introduced} започнати`),
        c.due ? h('div.muted', {}, `🔁 ${c.due} думи чакат повторение`) : null,
        h('button.link-btn', { type: 'button', onclick: () => manualDialog(home) }, '+ Добави време от друго учене'),
      ]),
    ]),
    h('div.lesson-hero', { style: { '--c': color } }, [
      h('div.lh-emoji', {}, emoji),
      h('div.lh-title', {}, title),
      h('div.lh-sub', {}, sub),
      doneBadge,
      h('a.btn.primary.wide.hero-btn', { href: '#/lesson' }, btn),
      h('div.lh-plan', {}, '🔥 загрявка · ✨ думи · 📐 правило · 🎧 слушане · 📖 четене · 🔄 превод · ✍️ писане · 🗣️ говорене · 🏁 тест'),
    ]),
    c.introduced >= 4 ? h('section', {}, [
      h('h2', {}, '🎮 2 минути свободни?'),
      h('div.quick-games', {}, GAMES.slice(0, 3).map((g) => h('a.qg', { href: `#/game/${g.id}` }, [h('span', {}, g.emoji), h('small', {}, g.name)]))),
    ]) : null,
    h('section', {}, [h('h2', {}, '🗺️ Твоят път'), courseMap()]),
  ]));
}

function courseMap() {
  const s = getState();
  const nextId = LESSONS.find((l) => !s.lessons[l.id])?.id;
  return h('div.course', {}, LESSONS.map((L) => {
    const done = s.lessons[L.id];
    const isNext = L.id === nextId;
    const cls = done ? 'done' : isNext ? 'next' : 'locked';
    return h(`button.course-item.${cls}`, {
      type: 'button', style: { '--c': L.color },
      onclick: () => (done || isNext) && lessonPreview(L, !!done),
    }, [
      h('span.ci-emoji', {}, done || isNext ? L.emoji : '🔒'),
      h('span.ci-text', {}, [h('b', {}, `${L.id}. ${L.title}`), h('small', {}, done ? `✓ ${done.score}%` : isNext ? 'Следващ' : L.goal)]),
    ]);
  }));
}

function lessonPreview(L, done) {
  modal(`${L.emoji} Урок ${L.id}: ${L.title}`, [
    h('p.muted', {}, L.goal),
    h('div.preview-words', {}, L.words.map((w) => h('div.pw', {}, [h('span.pw-e', {}, w.emoji), h('span', {}, [h('b', {}, w.en), h('br'), h('small', {}, w.bg)]), speakBtn(w.en, { slow: false })]))),
    h('p', {}, ['📐 ', h('b', {}, L.grammar.title)]),
    done ? null : h('p.small.muted', {}, 'Това е следващият ти урок – започни го от бутона на началния екран.'),
  ], [{ text: 'Затвори' }]);
}

// ---------- Старт ----------
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.__PREVIEW) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW', e));
}
