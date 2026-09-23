// Дребни помощни функции, ползвани навсякъде.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Създава DOM елемент: h('div.card#x', {onclick}, [деца или текст]) */
export function h(tag, attrs = {}, children = []) {
  const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9]*)(.*)$/i);
  const el = document.createElement(name || 'div');
  for (const m of rest.matchAll(/([.#])([\w-]+)/g)) {
    if (m[1] === '.') el.classList.add(m[2]);
    else el.id = m[2];
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Претеглен избор на n различни елемента. weightFn(x) >= 0 */
export function weightedSample(arr, n, weightFn) {
  const pool = arr.map((x) => ({ x, w: Math.max(0.0001, weightFn(x)) }));
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].w;
      if (r <= 0) break;
    }
    out.push(pool[i].x);
    pool.splice(i, 1);
  }
  return out;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Локална дата като 'YYYY-MM-DD' */
export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Нормализира текст за сравнение на отговори */
export function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[.,!?;:"“”„()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function similarity(a, b) {
  a = norm(a); b = norm(b);
  const max = Math.max(a.length, b.length) || 1;
  return 1 - levenshtein(a, b) / max;
}

/**
 * Подравнява написаното с верния отговор и връща HTML,
 * в който грешните/липсващите букви са оцветени.
 */
export function diffHtml(typed, correct) {
  const a = typed, b = correct;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  const eq = (x, y) => x.toLowerCase() === y.toLowerCase();
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (eq(a[i - 1], b[j - 1]) ? 0 : 1));
  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (eq(a[i - 1], b[j - 1]) ? 0 : 1)) {
      ops.push(eq(a[i - 1], b[j - 1]) ? ['ok', b[j - 1]] : ['sub', b[j - 1]]);
      i--; j--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      ops.push(['miss', b[j - 1]]); j--;
    } else {
      ops.push(['extra', a[i - 1]]); i--;
    }
  }
  ops.reverse();
  return ops
    .map(([t, c]) => {
      const ch = c === ' ' ? '&nbsp;' : esc(c);
      if (t === 'ok') return ch;
      if (t === 'extra') return `<del class="d-extra">${ch}</del>`;
      return `<ins class="d-${t}">${ch}</ins>`;
    })
    .join('');
}

export function fmtMin(totalMinutes) {
  const m = Math.round(totalMinutes);
  if (m < 60) return `${m} мин`;
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh} ч ${mm} мин` : `${hh} ч`;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export const vibrate = (p) => { try { navigator.vibrate?.(p); } catch {} };
