// Прозорци и известия, вградени в страницата (вместо alert/confirm на браузъра).
import { h } from './util.js';

export function modal(title, body, buttons) {
  const close = () => { wrap.remove(); document.body.classList.remove('modal-open'); };
  const wrap = h('div.modal-back', { onclick: (e) => { if (e.target === wrap) close(); } }, [
    h('div.modal', { role: 'dialog', 'aria-modal': 'true' }, [
      h('h2', {}, title),
      h('div.modal-body', {}, body),
      h('div.modal-actions', {}, buttons.map((b) => h(`button.btn${b.primary ? '.primary' : b.danger ? '.danger' : '.ghost'}`, {
        type: 'button', onclick: () => { if (b.onclick?.() !== false) close(); },
      }, b.text))),
    ]),
  ]);
  document.body.append(wrap);
  document.body.classList.add('modal-open');
  return { close };
}

/** Потвърждение в страницата. Връща Promise<boolean>. */
export function ask(title, text, { yes = 'Да', no = 'Отказ', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = modal(title, text ? [h('p', {}, text)] : [], [
      { text: no, onclick: () => { answered = true; resolve(false); } },
      { text: yes, primary: !danger, danger, onclick: () => { answered = true; resolve(true); } },
    ]);
    // Затваряне с докосване извън прозореца = отказ
    const obs = new MutationObserver(() => { if (!document.querySelector('.modal-back')) { obs.disconnect(); if (!answered) resolve(false); } });
    obs.observe(document.body, { childList: true });
    return m;
  });
}

let toastTimer;
export function toast(text) {
  document.querySelector('.toast')?.remove();
  const t = h('div.toast', { role: 'status' }, text);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2600);
}
