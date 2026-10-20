"""Страница за обаждания (Artifact): фирмите с телефон/имейл по градове, етап на сградите,
статус и бележки за всяка фирма (пазят се в базата на страницата).

    python contacts_list.py && python call_page.py   ->  output/obazhdania.html
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
DATA = ROOT / "output" / "kontakti.json"
OUT = ROOT / "output" / "obazhdania.html"

from contacts_list import fmt_phone  # noqa: E402

TEMPLATE = r"""<title>PHOMI обаждания</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=Unbounded:wght@600&family=JetBrains+Mono:wght@500&display=swap">
<style>
/* Layout: една колона карти (списък за обаждания), лента с филтри отгоре, цветна ивица = спешност */
:root {
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --ink: #1a2224; --muted: #5a676b; --line: #d5dcdd;
  --accent: #0e6a70; --accent-ink: #ffffff; --accent-soft: #dcefef;
  --urgent: #c2410c; --high: #a86a12; --mid: #3c7a36; --early: #6b7378;
  --st-none: #e7ebeb; --st-try: #fdf0d5; --st-int: #dcf2d6; --st-offer: #d9e8fb; --st-meet: #bfe5b2; --st-no: #e3e3e3;
  --font-body: "Golos Text", "Segoe UI", system-ui, -apple-system, sans-serif;
  --font-display: "Unbounded", "Golos Text", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #111718; --surface: #182022; --surface-2: #1e2729; --ink: #e5ecec; --muted: #9aa8ab; --line: #2b3537;
  --accent: #4fb5ba; --accent-ink: #0b1213; --accent-soft: #173638;
  --urgent: #f08a5d; --high: #e2b05a; --mid: #85c47a; --early: #9ba4a8;
  --st-none: #232c2e; --st-try: #3a3220; --st-int: #213a22; --st-offer: #1f3047; --st-meet: #2c4d27; --st-no: #2a2f30;
  color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #111718; --surface: #182022; --surface-2: #1e2729; --ink: #e5ecec; --muted: #9aa8ab; --line: #2b3537;
  --accent: #4fb5ba; --accent-ink: #0b1213; --accent-soft: #173638;
  --urgent: #f08a5d; --high: #e2b05a; --mid: #85c47a; --early: #9ba4a8;
  --st-none: #232c2e; --st-try: #3a3220; --st-int: #213a22; --st-offer: #1f3047; --st-meet: #2c4d27; --st-no: #2a2f30;
  color-scheme: dark; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { background: var(--bg); color: var(--ink); font: 15px/1.45 var(--font-body); }
.wrap { max-width: 1000px; margin: 0 auto; padding-inline: 16px; padding-block: 20px 48px; display: grid; gap: 14px; }
header h1 { font: 600 clamp(20px, 4vw, 26px)/1.15 var(--font-display); margin: 0; letter-spacing: .01em; text-wrap: balance; }
header p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.save-note { font-size: 13px; color: var(--muted); }
.save-note.warn { color: var(--urgent); }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.tab { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 999px; padding: 7px 14px;
  font: 600 14px var(--font-body); cursor: pointer; }
.tab[aria-selected="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.tab .n { font-variant-numeric: tabular-nums; opacity: .8; font-weight: 500; margin-left: 4px; }
.sheet-note { color: var(--muted); font-size: 13px; margin: 0; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: end; background: var(--surface); border: 1px solid var(--line);
  border-radius: 10px; padding: 10px 12px; position: sticky; top: env(safe-area-inset-top, 0px); z-index: 2; }
.toolbar label { display: grid; gap: 3px; font-size: 12px; color: var(--muted); }
.toolbar input[type="search"], .toolbar select { font: 14px var(--font-body); color: var(--ink); background: var(--surface-2);
  border: 1px solid var(--line); border-radius: 7px; padding: 7px 9px; min-width: 0; }
.toolbar .grow { flex: 1 1 220px; }
.toolbar .grow input { width: 100%; }
.check { display: flex !important; grid-auto-flow: column; align-items: center; gap: 6px !important; font-size: 14px !important;
  color: var(--ink) !important; padding-bottom: 7px; }
.check[hidden] { display: none !important; }
.stats { display: flex; flex-wrap: wrap; gap: 6px; }
.stat { border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; font-size: 13px; background: var(--surface);
  color: var(--ink); cursor: pointer; font-family: var(--font-body); }
.stat b { font-variant-numeric: tabular-nums; }
.stat[aria-pressed="true"] { outline: 2px solid var(--accent); outline-offset: 1px; }
.count { color: var(--muted); font-size: 13px; }
.list { display: grid; gap: 10px; }
.card { background: var(--surface); border: 1px solid var(--line); border-left: 5px solid var(--early); border-radius: 10px;
  padding: 12px 14px; display: grid; gap: 8px; min-width: 0; }
.card.p0 { border-left-color: var(--urgent); } .card.p1 { border-left-color: var(--high); }
.card.p2, .card.p3, .card.p4 { border-left-color: var(--mid); } .card.p5 { border-left-color: var(--early); }
.card[data-status="Разговор – интерес"], .card[data-status="Среща / оглед"] { background: var(--st-int); }
.card[data-status="Изпратена оферта"] { background: var(--st-offer); }
.card[data-status="Не се интересува"], .card[data-status="Грешен номер"] { opacity: .62; }
.head { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; }
.head h3 { margin: 0; font-size: 16px; font-weight: 700; min-width: 0; overflow-wrap: anywhere; }
.pill { font-size: 12px; font-weight: 600; border-radius: 999px; padding: 2px 8px; color: var(--surface);
  background: var(--early); white-space: nowrap; }
.p0 .pill { background: var(--urgent); } .p1 .pill { background: var(--high); }
.p2 .pill, .p3 .pill, .p4 .pill { background: var(--mid); }
.role { font-size: 12px; color: var(--muted); }
.now { margin: 0; font-size: 14px; }
.now b { font-weight: 600; }
.contacts { display: grid; gap: 4px; }
.line { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; min-width: 0; }
.val { font-family: var(--font-mono); font-size: 14px; user-select: all; overflow-wrap: anywhere; min-width: 0; }
.mini { font: 500 12px var(--font-body); border: 1px solid var(--line); background: var(--surface-2); color: var(--ink);
  border-radius: 6px; padding: 2px 8px; cursor: pointer; text-decoration: none; }
.mini:hover, .tab:hover, .stat:hover { border-color: var(--accent); }
.mini.done { border-color: var(--mid); color: var(--mid); }
.muted { color: var(--muted); font-size: 13px; }
a { color: var(--accent); }
.objects { margin: 0; padding-left: 18px; display: grid; gap: 3px; font-size: 13.5px; }
.objects .stg { color: var(--muted); }
details summary { cursor: pointer; color: var(--accent); font-size: 13px; }
.track { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: end; border-top: 1px dashed var(--line); padding-top: 8px; }
.track label { display: grid; gap: 3px; font-size: 12px; color: var(--muted); }
.track select, .track input, .track textarea { font: 14px var(--font-body); color: var(--ink); background: var(--surface-2);
  border: 1px solid var(--line); border-radius: 7px; padding: 6px 8px; min-width: 0; }
.track .note { flex: 1 1 260px; }
.track textarea { width: 100%; resize: vertical; min-height: 36px; }
.saved { font-size: 12px; color: var(--muted); min-height: 1em; padding-bottom: 8px; }
.saved.err { color: var(--urgent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.empty { text-align: center; color: var(--muted); padding: 28px 0; }
footer { color: var(--muted); font-size: 12.5px; display: grid; gap: 4px; }
.tab.hot { border-color: var(--urgent); }
.bulk { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.bulk .mini { font-size: 13.5px; padding: 5px 12px; }
.pick { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
.pick input { width: 18px; height: 18px; accent-color: var(--accent); }
.card.picked { outline: 2px solid var(--accent); outline-offset: -1px; }
.ok { color: var(--mid); font-weight: 600; font-size: 12.5px; }
.tab .n.over { background: var(--urgent); color: var(--surface); border-radius: 999px; padding: 0 6px; opacity: 1; }
.firms { display: grid; gap: 8px; }
.firm { border-top: 1px solid var(--line); padding-top: 7px; display: grid; gap: 4px; min-width: 0; }
.firm .fname { font-weight: 600; overflow-wrap: anywhere; }
.chip { font-size: 11.5px; border-radius: 999px; padding: 1px 8px; border: 1px solid var(--line); white-space: nowrap; }
.where { font-size: 13px; color: var(--muted); }
.log { display: grid; gap: 6px; }
.log h4 { margin: 0; font-size: 13px; color: var(--muted); font-weight: 600; }
.entry { background: var(--surface-2); border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 8px;
  padding: 7px 10px; font-size: 14px; display: grid; gap: 3px; min-width: 0; }
.entry.over { border-left-color: var(--urgent); } .entry.done { opacity: .6; }
.entry .meta { color: var(--muted); font-size: 12.5px; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; }
.entry .said { white-space: pre-wrap; overflow-wrap: anywhere; }
.entry .nx { font-weight: 600; } .entry.over .nx { color: var(--urgent); }
.addlog summary { font-weight: 600; font-size: 14px; }
.logform { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: end; padding-top: 8px; }
.logform label { display: grid; gap: 3px; font-size: 12px; color: var(--muted); flex: 1 1 200px; min-width: 0; }
.logform label.wide { flex-basis: 100%; }
.logform input, .logform textarea { font: 14px var(--font-body); color: var(--ink); background: var(--surface-2);
  border: 1px solid var(--line); border-radius: 7px; padding: 7px 9px; width: 100%; min-width: 0; }
.logform label.short { flex: 0 1 160px; }
.mini.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); font-size: 14px; padding: 6px 14px; }
.remhead { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; }
.remhead h3 { margin: 0; font-size: 15.5px; overflow-wrap: anywhere; }
@media (max-width: 520px) { .track .note { flex-basis: 100%; } }
@media (max-width: 640px) { .toolbar { position: static; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<div class="wrap">
  <header>
    <h1>PHOMI обаждания</h1>
    <p>Сгради около Акт 14 и фирмите по тях · дневник на разговорите · данни към <span id="gen"></span></p>
    <p class="save-note" id="saveNote">Статусите и бележките се зареждат…</p>
  </header>
  <nav class="tabs" role="tablist" id="tabs"></nav>
  <p class="sheet-note" id="sheetNote"></p>
  <div class="toolbar" role="search">
    <label class="grow" for="q">Търсене (фирма, телефон, квартал, лице)
      <input type="search" id="q" placeholder="напр. Младост, Гербера, 088…" autocomplete="off"></label>
    <label for="city" id="cityBox">Град
      <select id="city"><option value="">Всички</option><option>София</option><option>Пловдив</option></select></label>
    <label for="role" id="roleBox">Роля
      <select id="role"><option value="">Всички</option><option value="Инвеститор">Инвеститор</option>
        <option value="Строител">Строител</option><option value="Проект">Проектант / архитект</option>
        <option value="надзор">Надзор</option></select></label>
    <label for="ctype" id="ctypeBox">Контакт
      <select id="ctype"><option value="">Телефон или имейл</option><option value="phone">С телефон</option>
        <option value="email">С имейл</option><option value="both">Телефон и имейл</option></select></label>
    <label for="sort" id="sortBox">Подреди
      <select id="sort"><option value="">С обекти първо</option><option value="rating">Оценка в Google</option>
        <option value="name">По име</option></select></label>
    <label class="check" for="withObj" id="objBox"><input type="checkbox" id="withObj"> Само с обекти</label>
    <label class="check" for="onlyPick" id="pickBox"><input type="checkbox" id="onlyPick"> Само избраните</label>
    <label for="prio" id="prioBox">Приоритет
      <select id="prio"><option value="">Всички</option><option value="high">Висок</option><option value="mid">Среден</option></select></label>
    <label for="stf" id="stfBox">Статус
      <select id="stf"></select></label>
    <label class="check" for="onlyPhone" id="phoneBox"><input type="checkbox" id="onlyPhone"> Само с телефон</label>
  </div>
  <div class="bulk" id="bulk"><button class="mini" id="copyMails">Копирай имейлите на показаните</button>
    <button class="mini" id="copyPhones">Копирай телефоните на показаните</button><span class="muted" id="bulkMsg"></span></div>
  <div class="stats" id="stats"></div>
  <div class="count" id="count"></div>
  <main class="list" id="list"></main>
  <footer>
    <span>Етапът е приблизителен: изчислен от датата на разрешението за строеж и големината на сградата (Акт 14 не е публичен).</span>
    <span>Някои имейли и телефони от Търговския регистър са на счетоводителя – отбелязани са „(счетоводство)“.</span>
    <span>Източници: НАГ София, Община Пловдив, Търговски регистър, КСБ, КАБ, ЦАИС ЕОП.</span>
  </footer>
</div>

<script type="application/json" id="data">__DATA__</script>
<script>
(function () {
  "use strict";
  const DATA = JSON.parse(document.getElementById("data").textContent);
  const STATUSES = ["Не е звъняно", "Звъннато – няма отговор", "Разговор – интерес", "Изпратена оферта",
                    "Среща / оглед", "Не се интересува", "Грешен номер"];
  const STATUS_BG = {"Не е звъняно": "--st-none", "Звъннато – няма отговор": "--st-try", "Разговор – интерес": "--st-int",
                     "Изпратена оферта": "--st-offer", "Среща / оглед": "--st-meet", "Не се интересува": "--st-no",
                     "Грешен номер": "--st-no"};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* без запомняне */ } } };

  // Раздели: обектите около Акт 14, фирмите по градове и напомнянията от дневника
  const TABS = DATA.sheets.concat([{code: "rem", kind: "rem", title: "Напомняния", rows: [],
    note: "Следващите стъпки от дневника – първо просрочените и тези за днес."}]);
  const ALL = {};
  DATA.sheets.forEach((s) => s.rows.forEach((r) => { ALL[r.id] = r; }));

  // Състояние: статус/дата/бележка по id на картата; дневник: записи по ключ
  const state = {}, logs = {};
  let db = null, readOnly = false, mode = "loading";
  const pending = {}, timers = {};

  let tab = store.get("phomi-tab2") || TABS[0].code;
  if (!TABS.some((s) => s.code === tab)) tab = TABS[0].code;

  $("#gen").textContent = DATA.generated;
  $("#stf").innerHTML = '<option value="">Всички</option>' + STATUSES.map((s) => `<option>${esc(s)}</option>`).join("");

  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const fmtDay = (iso) => iso ? iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4) : "";
  const fmtAt = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("bg-BG", {day: "2-digit", month: "2-digit", year: "numeric"}) +
    " " + d.toLocaleTimeString("bg-BG", {hour: "2-digit", minute: "2-digit"}); };

  function sheet() { return TABS.find((s) => s.code === tab); }
  function statusOf(id) { return (state[id] && state[id].status) || "Не е звъняно"; }
  function titleOf(r) { return !r ? "" : r.kind === "obj" ? `${r.city}, ${r.where} – ${r.what}` : r.names.join(" / "); }
  function entriesFor(id) { return Object.keys(logs).filter((k) => logs[k].card === id).sort((a, b) => (logs[b].at || "").localeCompare(logs[a].at || "")); }
  function openReminders() {
    return Object.keys(logs).filter((k) => !logs[k].done && (logs[k].due || logs[k].next))
      .sort((a, b) => (logs[a].due || "9999").localeCompare(logs[b].due || "9999"));
  }

  function renderTabs() {
    const rem = openReminders(), over = rem.filter((k) => logs[k].due && logs[k].due <= today()).length;
    $("#tabs").innerHTML = TABS.map((s) => {
      const n = s.kind === "rem" ? `<span class="n${over ? " over" : ""}">${over ? over + " за днес" : rem.length}</span>` : `<span class="n">${s.rows.length}</span>`;
      return `<button class="tab${s.kind === "obj" ? " hot" : ""}" role="tab" id="tab-${s.code}" aria-selected="${s.code === tab}" data-tab="${s.code}">${esc(s.title)}${n}</button>`;
    }).join("");
    $("#sheetNote").textContent = sheet().note;
    const k = sheet().kind, arch = k === "arch";
    $("#cityBox").hidden = k !== "obj";
    $("#roleBox").hidden = arch || k === "rem";
    $("#ctypeBox").hidden = $("#sortBox").hidden = $("#objBox").hidden = $("#pickBox").hidden = $("#bulk").hidden = !arch;
    $("#prioBox").hidden = k === "obj" || k === "rem" || arch;
    $("#stfBox").hidden = k === "rem";
    $("#phoneBox").hidden = k === "rem" || arch;
    $("#stats").hidden = k === "rem";
  }

  function renderStats() {
    if (sheet().kind === "rem") return;
    const counts = {};
    STATUSES.forEach((s) => counts[s] = 0);
    sheet().rows.forEach((r) => counts[statusOf(r.id)]++);
    const cur = $("#stf").value;
    $("#stats").innerHTML = STATUSES.map((s) =>
      `<button class="stat" data-status="${esc(s)}" aria-pressed="${cur === s}" style="background: var(${STATUS_BG[s]})">${esc(s)}: <b>${counts[s]}</b></button>`).join("");
  }

  function logText(id) { return entriesFor(id).map((k) => [logs[k].who, logs[k].said, logs[k].next].join(" ")).join(" "); }

  function matches(r) {
    const q = $("#q").value.trim().toLowerCase();
    const prio = $("#prio").value, st = $("#stf").value, city = $("#city").value;
    const obj = r.kind === "obj", arch = r.kind === "arch";
    if (arch) {
      const ct = $("#ctype").value, s = state[r.id] || {};
      if (ct === "phone" && !r.phones.length) return false;
      if (ct === "email" && !r.emails.length) return false;
      if (ct === "both" && !(r.phones.length && r.emails.length)) return false;
      if ($("#withObj").checked && !r.objects.length) return false;
      if ($("#onlyPick").checked && !s.pick) return false;
      if (st && statusOf(r.id) !== st) return false;
      if (!q) return true;
      const hay = [r.names.join(" "), r.phones.join(" "), r.phones.join(" ").replace(/\s/g, ""), r.emails.join(" "), r.person,
                   r.address, r.website, r.objects.map((o) => o.what).join(" "), s.note || "", logText(r.id)].join(" ").toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    }
    const role = $("#role").value;
    if (role && !(obj ? r.firms : [r]).some((f) => f.roles.join(" ").toLowerCase().includes(role.toLowerCase()))) return false;
    if (!obj && prio === "high" && !r.priority.startsWith("Висок")) return false;
    if (!obj && prio === "mid" && r.priority.startsWith("Висок")) return false;
    if (obj && city && r.city !== city) return false;
    if (st && statusOf(r.id) !== st) return false;
    const firms = obj ? r.firms : [r];
    if ($("#onlyPhone").checked && !firms.some((f) => f.phones.length)) return false;
    if (!q) return true;
    const hay = [obj ? r.city + " " + r.where + " " + r.what : r.objects.map((o) => o.where + " " + o.what).join(" "),
                 firms.map((f) => [f.names.join(" "), f.phones.join(" "), f.phones.join(" ").replace(/\s/g, ""), f.emails.join(" "),
                                   f.person, f.roles.join(" ")].join(" ")).join(" "),
                 (state[r.id] && state[r.id].note) || "", logText(r.id)].join(" ").toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  }

  function contactLines(f) {
    const phones = f.phones.map((p) => `<div class="line"><span class="val">${esc(p)}</span>
        <a class="mini" href="tel:${esc(p.replace(/\s/g, ""))}" target="_blank" rel="noopener">Обади се</a>
        <button class="mini copy" data-copy="${esc(p)}">Копирай</button></div>`).join("");
    const emails = f.emails.map((e) => { const addr = e.replace(/\s*\(.*\)$/, "");
      return `<div class="line"><span class="val">${esc(e)}</span>
        <a class="mini" href="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(addr)}" target="_blank" rel="noopener">Gmail</a>
        <button class="mini copy" data-copy="${esc(addr)}">Копирай</button></div>`; }).join("");
    const site = f.website ? `<div class="line"><a href="${esc(f.website)}" target="_blank" rel="noopener">${esc(f.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a></div>` : "";
    const person = f.person ? `<div class="muted">Лице за контакт: ${esc(f.person)}</div>` : "";
    return phones + emails + site + person;
  }

  function entryHtml(k, withTitle) {
    const e = logs[k], over = !e.done && e.due && e.due <= today();
    const card = ALL[e.card];
    const phones = withTitle && card ? (card.kind === "obj" ? card.firms.flatMap((f) => f.phones) : card.phones).slice(0, 3) : [];
    return `<div class="entry${over ? " over" : ""}${e.done ? " done" : ""}">
      ${withTitle ? `<div class="remhead"><h3>${esc(e.title || titleOf(card))}</h3></div>` +
        phones.map((p) => `<div class="line"><span class="val">${esc(p)}</span><a class="mini" href="tel:${esc(p.replace(/\s/g, ""))}" target="_blank" rel="noopener">Обади се</a></div>`).join("") : ""}
      <div class="meta"><b>${esc(fmtAt(e.at))}</b>${e.who ? `<span>говорих с: ${esc(e.who)}</span>` : ""}</div>
      ${e.said ? `<div class="said">${esc(e.said)}</div>` : ""}
      ${e.next || e.due ? `<div class="nx">Следва: ${esc(e.next || "обаждане")}${e.due ? " · до " + fmtDay(e.due) : ""}${e.done ? " · ✓ готово" : ""}</div>` : ""}
      <div class="meta">${(e.next || e.due) && !e.done ? `<button class="mini" data-done="${esc(k)}">Готово</button>` : ""}
        ${readOnly ? "" : `<button class="mini" data-del="${esc(k)}">Изтрий</button>`}</div>
    </div>`;
  }

  function logBlock(r) {
    const who = r.kind === "obj" ? r.firms.map((f) => f.names[0]) : r.person ? r.person.split(/,\s*/) : [];
    return `<div class="log">
      <div id="log-${r.id}">${logList(r.id)}</div>
      ${readOnly ? "" : `<details class="addlog" id="add-${r.id}"><summary>+ Запиши разговор</summary>
        <div class="logform">
          <label>С кого говорих<input data-k="who" list="who-${r.id}" placeholder="име, длъжност или фирма" autocomplete="off"></label>
          <label class="wide">Какво чух<textarea data-k="said" rows="3" placeholder="напр. фасадата още не е решена, архитектът е …, искат мостри и цена"></textarea></label>
          <label>Следваща стъпка<input data-k="next" placeholder="напр. оферта, мостри, звънни пак" autocomplete="off"></label>
          <label class="short">До кога<input type="date" data-k="due"></label>
          <button class="mini primary" data-addlog="${r.id}">Запази разговора</button>
          <span class="saved" id="lg-${r.id}"></span>
        </div>
        <datalist id="who-${r.id}">${who.map((w) => `<option value="${esc(w)}">`).join("")}</datalist>
      </details>`}
    </div>`;
  }
  function logList(id) {
    const list = entriesFor(id);
    return list.length ? `<h4>Дневник (${list.length})</h4>` + list.map((k) => entryHtml(k, false)).join("") : "";
  }

  function track(r) {
    const s = state[r.id] || {}, status = statusOf(r.id);
    return `<div class="track">
        <label for="st-${r.id}">Статус<select id="st-${r.id}" data-id="${r.id}" data-f="status" ${readOnly ? "disabled" : ""}>${STATUSES.map((x) => `<option${x === status ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
        <label for="dt-${r.id}">Последно обаждане<input type="date" id="dt-${r.id}" data-id="${r.id}" data-f="date" value="${esc(s.date || "")}" ${readOnly ? "disabled" : ""}></label>
        <label class="note" for="nt-${r.id}">Кратка бележка<textarea id="nt-${r.id}" data-id="${r.id}" data-f="note" rows="1" ${readOnly ? "disabled" : ""}>${esc(s.note || "")}</textarea></label>
        <span class="saved" id="sv-${r.id}"></span>
      </div>`;
  }

  function card(r) {
    const objs = r.objects.map((o) => `<li><b>${esc(o.where)}</b>: ${esc(o.what)} <span class="stg">– ${esc(o.stage.toLowerCase())}${o.confirmed ? ", " + esc(o.confirmed) : ""}</span>${o.url ? ` <a href="${esc(o.url)}" target="_blank" rel="noopener">регистър</a>` : ""}</li>`);
    const shown = objs.slice(0, 3).join(""), rest = objs.slice(3).join("");
    const objectsHtml = `<ul class="objects">${shown}</ul>` + (rest || r.more ? `<details><summary>Още ${objs.length - 3 + r.more} ${objs.length - 3 + r.more === 1 ? "сграда" : "сгради"}</summary><ul class="objects">${rest}${r.more ? `<li class="muted">… и още ${r.more}</li>` : ""}</ul></details>` : "");
    return `<article class="card p${r.order}" id="card-${r.id}" data-status="${esc(statusOf(r.id))}">
      <div class="head"><h3>${esc(r.names.join(" / "))}</h3><span class="pill">${esc(r.priority)}</span><span class="role">${esc(r.roles.join(", "))}</span></div>
      <p class="now"><b>Сега:</b> ${esc(r.stage)}</p>
      <div class="contacts">${contactLines(r)}</div>
      ${objectsHtml}
      ${track(r)}
      ${logBlock(r)}
    </article>`;
  }

  function objCard(r) {
    const firms = r.firms.map((f) => { const st = statusOf(f.id);
      return `<div class="firm"><div class="head"><span class="fname">${esc(f.names.join(" / "))}</span><span class="role">${esc(f.roles.join(", "))}</span>
        <span class="chip" style="background: var(${STATUS_BG[st]})" title="Статус на фирмата">${esc(st)}</span></div>
        <div class="contacts">${contactLines(f)}</div></div>`; }).join("");
    return `<article class="card p0" id="card-${r.id}" data-status="${esc(statusOf(r.id))}">
      <div class="head"><h3>${esc(r.what)}</h3><span class="pill">${esc(r.city)}</span></div>
      <div class="where">${esc(r.where)} · разрешение от ${esc(fmtDay(r.date))}${r.url ? ` · <a href="${esc(r.url)}" target="_blank" rel="noopener">регистър</a>` : ""}${r.confirmed ? " · " + esc(r.confirmed) : ""}</div>
      <p class="now"><b>Сега:</b> около Акт 14 – фасадата се решава сега</p>
      <div class="firms">${firms}</div>
      ${track(r)}
      ${logBlock(r)}
    </article>`;
  }

  function archCard(r) {
    const s = state[r.id] || {};
    const objs = r.objects.map((o) => `<li>${esc(fmtDay(o.date))} – ${esc(o.what)}${o.where && o.where !== r.city ? ` <span class="stg">(${esc(o.where)})</span>` : ""}</li>`);
    const objectsHtml = !objs.length ? "" : `<div class="muted">${r.confirmed ? "Потвърдени проекти:" : "Договори за проектиране (обществени поръчки):"}</div>
      <ul class="objects">${objs.slice(0, 3).join("")}</ul>` +
      (objs.length > 3 ? `<details><summary>Още ${objs.length - 3}</summary><ul class="objects">${objs.slice(3).join("")}</ul></details>` : "");
    const links = [r.kab ? `<a href="${esc(r.kab)}" target="_blank" rel="noopener">${r.source === "Google Maps" ? "в Google Maps" : "профил в КАБ"}</a>` : "",
                   r.rating ? `<span>Google: ${esc(r.rating)} ★</span>` : ""].filter(Boolean).join(" · ");
    return `<article class="card p${r.confirmed ? 0 : r.objects.length ? 2 : 5}${s.pick ? " picked" : ""}" id="card-${r.id}" data-status="${esc(statusOf(r.id))}">
      <div class="head"><label class="pick" for="pk-${r.id}"><input type="checkbox" id="pk-${r.id}" data-id="${r.id}" data-f="pick"${s.pick ? " checked" : ""} ${readOnly ? "disabled" : ""}> Избран</label>
        <h3>${esc(r.names[0])}</h3><span class="pill">${esc(r.city)}</span><span class="role">${esc(r.roles.join(", "))}</span>
        ${r.confirmed ? `<span class="ok">✓ потвърден архитект</span>` : ""}</div>
      ${r.address ? `<div class="where">${esc(r.address)}</div>` : ""}
      <div class="contacts">${contactLines(r)}</div>
      ${objectsHtml}
      ${links ? `<div class="muted">${links}</div>` : ""}
      ${track(r)}
      ${logBlock(r)}
    </article>`;
  }

  function shownRows() {
    const sh = sheet();
    let rows = sh.rows.filter(matches);
    if (sh.kind === "arch" && $("#sort").value) {
      const by = $("#sort").value;
      rows = rows.slice().sort((a, b) => by === "rating" ? (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0)
        : a.names[0].replace(/^[\s"„“]+/, "").localeCompare(b.names[0].replace(/^[\s"„“]+/, ""), "bg"));
    }
    return rows;
  }

  function renderRem() {
    const q = $("#q").value.trim().toLowerCase();
    const keys = openReminders().filter((k) => { const e = logs[k];
      return !q || q.split(/\s+/).every((w) => [e.title, e.who, e.said, e.next].join(" ").toLowerCase().includes(w)); });
    $("#count").textContent = `${keys.length} отворени следващи стъпки`;
    $("#list").innerHTML = keys.length ? keys.map((k) => `<article class="card p1">${entryHtml(k, true)}</article>`).join("") :
      `<p class="empty">Няма отворени напомняния. Запиши разговор със „Следваща стъпка“ и дата – ще се появи тук.</p>`;
  }

  function renderList() {
    const sh = sheet();
    if (sh.kind === "rem") { renderRem(); return; }
    const open = new Set([...document.querySelectorAll("details.addlog[open]")].map((d) => d.id));
    const rows = shownRows();
    const what = sh.kind === "obj" ? "сгради" : sh.kind === "arch" ? "бюра" : "фирми";
    const picked = sh.kind === "arch" ? sh.rows.filter((r) => (state[r.id] || {}).pick).length : 0;
    $("#count").textContent = `Показани ${rows.length} от ${sh.rows.length} ${what}` + (sh.kind === "arch" ? ` · избрани ${picked}` : "");
    const draw = sh.kind === "obj" ? objCard : sh.kind === "arch" ? archCard : card;
    $("#list").innerHTML = rows.length ? rows.map(draw).join("") : `<p class="empty">Няма ${what} с тези филтри.</p>`;
    open.forEach((id) => { const d = document.getElementById(id); if (d) d.open = true; });
  }

  function render() { renderTabs(); renderStats(); renderList(); }
  function renderCount() {
    const sh = sheet();
    if (sh.kind !== "arch") return;
    const picked = sh.rows.filter((r) => (state[r.id] || {}).pick).length;
    $("#count").textContent = $("#count").textContent.replace(/избрани \d+/, "избрани " + picked);
  }

  function copyAll(kind) {
    const rows = shownRows();
    const vals = [...new Set(rows.flatMap((r) => kind === "mail" ? r.emails.map((e) => e.replace(/\s*\(.*\)$/, "")) : r.phones))];
    const msg = $("#bulkMsg");
    if (!vals.length) { msg.textContent = "Няма какво да се копира."; return; }
    const text = vals.join(kind === "mail" ? ", " : "\n");
    const done = () => { msg.textContent = `Копирани ${vals.length} ${kind === "mail" ? "имейла" : "телефона"} от ${rows.length} бюра.`; };
    try { navigator.clipboard.writeText(text).then(done, () => prompt("Копирай ръчно:", text)); } catch (e) { prompt("Копирай ръчно:", text); }
  }

  // Обновяване на една карта от базата, без да се пипа поле, което се пише в момента
  function refreshCard(id) {
    const el = document.getElementById("card-" + id);
    if (!el) return;
    const s = state[id] || {};
    el.dataset.status = statusOf(id);
    const st = document.getElementById("st-" + id), dt = document.getElementById("dt-" + id), nt = document.getElementById("nt-" + id);
    if (st && document.activeElement !== st) st.value = statusOf(id);
    if (dt && document.activeElement !== dt) dt.value = s.date || "";
    if (nt && document.activeElement !== nt && !timers[id]) nt.value = s.note || "";
    const pk = document.getElementById("pk-" + id);
    if (pk) { pk.checked = !!s.pick; el.classList.toggle("picked", !!s.pick); }
  }
  function refreshLog(id) { const el = document.getElementById("log-" + id); if (el) el.innerHTML = logList(id); }

  function mark(id, text, err, prefix) {
    const el = document.getElementById((prefix || "sv-") + id);
    if (el) { el.textContent = text; el.classList.toggle("err", !!err); }
  }
  function failText(e) {
    if (e && e.code === "invalid_argument") return "Нямате право да записвате тук.";
    if (e && e.code === "quota_exceeded") return "Базата е пълна – не е записано.";
    return "Не е записано – опитайте пак след малко.";
  }

  function save(id) {
    const st = document.getElementById("st-" + id), dt = document.getElementById("dt-" + id), nt = document.getElementById("nt-" + id);
    const prev = state[id] || {};
    const pk = document.getElementById("pk-" + id);
    const body = { status: st ? st.value : statusOf(id), date: dt ? dt.value : (prev.date || ""),
                   note: nt ? nt.value : (prev.note || ""), pick: pk ? pk.checked : !!prev.pick,
                   sheet: tab, updated: new Date().toISOString() };
    if (prev.status === body.status && (prev.date || "") === body.date && (prev.note || "") === body.note &&
        !!prev.pick === body.pick) return;
    state[id] = body;
    refreshCard(id); renderStats();
    if (pk) renderCount();
    if (mode === "local") {
      store.set("phomi-calls", JSON.stringify(state));
      mark(id, "Запазено в този браузър");
      return;
    }
    if (!db || readOnly) return;
    mark(id, "Запазване…");
    // Един запис наведнъж за всяка карта
    pending[id] = (pending[id] || Promise.resolve()).then(() => db.doc("calls/" + id).set(body)).then(() => {
      mark(id, "Запазено " + new Date().toLocaleTimeString("bg-BG", {hour: "2-digit", minute: "2-digit"}));
    }).catch((e) => {
      if (e && e.code === "invalid_argument") {
        readOnly = true;
        $("#saveNote").textContent = "Нямате право да записвате тук – данните се показват само за четене.";
        $("#saveNote").classList.add("warn");
        renderList();
      } else mark(id, failText(e), true);
    });
  }

  function persistLocal() { store.set("phomi-log", JSON.stringify(logs)); }

  function addLog(id, btn) {
    const box = btn.closest(".logform");
    const val = (k) => box.querySelector(`[data-k="${k}"]`).value.trim();
    const body = { card: id, title: titleOf(ALL[id]), sheet: tab, who: val("who"), said: val("said"), next: val("next"),
                   due: val("due"), done: false, at: new Date().toISOString() };
    if (!body.who && !body.said && !body.next && !body.due) { mark(id, "Напиши какво си чул.", true, "lg-"); return; }
    const clear = () => { box.querySelectorAll("[data-k]").forEach((el) => { el.value = ""; }); };
    // Датата на последното обаждане става днешна
    const dt = document.getElementById("dt-" + id);
    if (dt && !readOnly) { dt.value = today(); save(id); }
    if (mode === "local") {
      logs["l" + Date.now()] = body; persistLocal(); clear();
      refreshLog(id); renderTabs(); mark(id, "Запазено в този браузър", false, "lg-");
      return;
    }
    if (!db || readOnly) return;
    btn.disabled = true; mark(id, "Запазване…", false, "lg-");
    db.collection("log").add(body).then(() => { clear(); mark(id, "Запазено", false, "lg-"); })
      .catch((e) => mark(id, failText(e), true, "lg-")).finally(() => { btn.disabled = false; });
  }

  function changeLog(k, del) {
    const e = logs[k];
    if (!e) return;
    if (mode === "local") {
      if (del) delete logs[k]; else e.done = true;
      persistLocal(); refreshLog(e.card); renderTabs(); if (tab === "rem") renderRem();
      return;
    }
    if (!db || readOnly) return;
    (del ? db.doc("log/" + k).delete() : db.doc("log/" + k).update({done: true}))
      .catch((er) => alert(failText(er)));
  }

  // Събития
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("button");
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; store.set("phomi-tab2", tab); $("#stf").value = ""; render(); return; }
    if (t.classList.contains("stat")) { const s = t.dataset.status; $("#stf").value = $("#stf").value === s ? "" : s; renderStats(); renderList(); return; }
    if (t.id === "copyMails") { copyAll("mail"); return; }
    if (t.id === "copyPhones") { copyAll("phone"); return; }
    if (t.dataset.addlog) { addLog(t.dataset.addlog, t); return; }
    if (t.dataset.done) { changeLog(t.dataset.done, false); return; }
    if (t.dataset.del) { if (confirm("Да изтрия ли този запис от дневника?")) changeLog(t.dataset.del, true); return; }
    if (t.classList.contains("copy")) {
      const text = t.dataset.copy;
      const ok = () => { t.textContent = "Копирано"; t.classList.add("done"); setTimeout(() => { t.textContent = "Копирай"; t.classList.remove("done"); }, 1500); };
      const fallback = () => { const v = t.parentElement.querySelector(".val"); if (v) { const r = document.createRange(); r.selectNodeContents(v);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); t.textContent = "Маркирано – Cmd+C"; } };
      try { navigator.clipboard.writeText(text).then(ok, fallback); } catch (e) { fallback(); }
    }
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.id) { clearTimeout(timers[el.dataset.id]); delete timers[el.dataset.id]; save(el.dataset.id); }
  });
  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.tagName === "TEXTAREA" && el.dataset.id) {
      const id = el.dataset.id;
      clearTimeout(timers[id]);
      timers[id] = setTimeout(() => { delete timers[id]; save(id); }, 1200);
    }
  });
  ["#q", "#prio", "#onlyPhone", "#city", "#role", "#ctype", "#sort", "#withObj", "#onlyPick"].forEach((s) => $(s).addEventListener("input", renderList));
  $("#stf").addEventListener("change", () => { renderStats(); renderList(); });

  render();

  // Базата на страницата: статусите и дневникът се пазят за всички устройства; без нея – само в този браузър
  function goLocal() {
    mode = "local";
    try { Object.assign(state, JSON.parse(store.get("phomi-calls") || "{}")); } catch (e) { /* празно */ }
    try { Object.assign(logs, JSON.parse(store.get("phomi-log") || "{}")); } catch (e) { /* празно */ }
    $("#saveNote").textContent = "Статусите и дневникът се пазят само в този браузър.";
    render();
  }
  const use = window.claude && typeof window.claude.use === "function" ? window.claude.use("db") : Promise.resolve(null);
  Promise.resolve(use).then((ns) => {
    if (!ns) { goLocal(); return; }
    db = ns; mode = "db";
    $("#saveNote").textContent = "Статусите и дневникът се записват автоматично и се виждат на всичките ви устройства.";
    const lost = () => { $("#saveNote").textContent = "Връзката с базата прекъсна – презаредете страницата."; $("#saveNote").classList.add("warn"); };
    db.collection("calls").onSnapshot((snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === "removed") delete state[ch.doc.id];
        else state[ch.doc.id] = Object.assign({}, ch.doc.data());
        refreshCard(ch.doc.id);
      });
      renderStats();
    }, lost);
    db.collection("log").onSnapshot((snap) => {
      const cards = new Set();
      snap.docChanges().forEach((ch) => {
        const old = logs[ch.doc.id];
        if (old) cards.add(old.card);
        if (ch.type === "removed") delete logs[ch.doc.id];
        else { logs[ch.doc.id] = Object.assign({}, ch.doc.data()); cards.add(logs[ch.doc.id].card); }
      });
      cards.forEach(refreshLog);
      renderTabs();
      if (tab === "rem") renderRem();
    }, lost);
  }).catch(goLocal);
})();
</script>
"""


def act14(data: dict) -> dict:
    """Сградите около Акт 14 от всички листове – по една карта на сграда с всички фирми по нея
    (инвеститор, строител, надзор). Първо тези с телефон, после по-старите разрешения."""
    objs: dict[str, dict] = {}
    for s in data["sheets"]:
        city = "Пловдив" if s["code"] == "plv" else "София"
        for r in s["rows"]:
            for o in r["objects"]:
                if not o["stage"].startswith("Около Акт 14"):
                    continue
                key = o["url"] or f'{o["where"]}|{o["what"]}'
                e = objs.setdefault(key, {"id": "obj-" + hashlib.sha1(key.encode()).hexdigest()[:10], "kind": "obj",
                                          "city": city, "where": o["where"], "what": o["what"], "date": o["date"],
                                          "url": o["url"], "confirmed": o["confirmed"], "firms": []})
                if not any(f["id"] == r["id"] for f in e["firms"]):
                    e["firms"].append({k: r[k] for k in ("id", "names", "roles", "phones", "emails", "website", "person")})
    rows = sorted(objs.values(), key=lambda e: (not any(f["phones"] for f in e["firms"]), e["date"] or "9999"))
    return {"code": "a14", "kind": "obj", "title": "Акт 14 – първо", "rows": rows,
            "note": "Сгради около Акт 14 (София и Пловдив) – фасадата се решава сега. Под всяка сграда са всички фирми "
                    "с контакт: инвеститор, строител, надзор. Започни от тук."}


# Потвърдени връзки архитект -> обект (data/confirmations.csv и пилотът docs/pilot-sites-2026-10-06.md)
KNOWN_ARCH = {
    "114635815": {"name": "„ИПА“ ЕООД (ИПА Архитекти)", "phones": ["+359 2 868 75 74"], "emails": ["info@ip-arch.com"],
                  "website": "https://www.ip-arch.com",
                  "objects": [{"where": "София, Младост 4", "what": "Vabul ONE – разрешение 63/27.03.2025", "date": "2025-03-27"},
                              {"where": "София, Лозенец (Задгарова)", "what": "Capitol Residence – разрешение 96/19.06.2026",
                               "date": "2026-06-19"}]},
}


def web_domain(url: str) -> str:
    host = re.sub(r"^https?://", "", (url or "").strip().lower()).split("/")[0]
    return host[4:] if host.startswith("www.") else host


def _rows(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _split(v: str) -> list[str]:
    return [x.strip() for x in re.split(r"[,;]", v or "") if x.strip()]


def architects() -> list[dict]:
    """Архитектурните бюра с телефон или имейл: София (КАБ + Google Maps) и Пловдив (КАБ + договори за
    проектиране в ЦАИС ЕОП). Обектите са само доказаните връзки и договорите за проектиране."""
    rows = []
    kg = ROOT / "output" / "plovdiv" / "kab_google_kontakti.json"
    found = json.loads(kg.read_text(encoding="utf-8")) if kg.exists() else {}
    for city, path in (("София", ROOT / "output" / "arhitekti.csv"), ("Пловдив", ROOT / "output" / "plovdiv" / "arhitekti.csv")):
        for x in _rows(path):
            phones = list(dict.fromkeys(fmt_phone(t) for t in _split(x.get("Телефон"))))[:3]
            emails = _split(x.get("Имейл"))[:3]
            reg = x.get("Рег. № КАБ", "").strip()
            g = found.get(reg or x["Бюро"]) if city == "Пловдив" and not phones and not emails else None
            if g and (g["phones"] or g["emails"]):  # от Google/сайта на бюрото (plovdiv_kab_google.py)
                phones = [fmt_phone(t) for t in g["phones"]][:3]
                emails, x = g["emails"][:3], dict(x, Сайт=x.get("Сайт") or g["website"],
                                                  Източник=(x.get("Източник") or "регистър на КАБ") + " + Google")
            if not phones and not emails:
                continue
            key = reg or hashlib.sha1(x["Бюро"].encode()).hexdigest()[:10]
            objects = []
            for item in (x.get("Обекти по договори (ЦАИС ЕОП)") or "").split(" | "):
                m = re.match(r"(\d{4}-\d\d-\d\d)\s+(.*)", item.strip())
                if m:
                    objects.append({"where": city, "what": m.group(2).strip(" „“\"")[:140], "date": m.group(1)})
            src = x.get("Източник") or ("регистър на КАБ" + (" + Google Maps" if x.get("Google Maps") else ""))
            site = x.get("Сайт", "").strip()
            if site and not site.startswith("http"):
                site = "https://" + site
            rows.append({"id": f"arc-{'p' if city == 'Пловдив' else 's'}{key}", "kind": "arch", "city": city,
                         "names": [x["Бюро"].strip()], "roles": ["Архитект" if "КАБ" in src else "Проектант (обществени поръчки)"],
                         "phones": phones, "emails": emails, "website": site,
                         "person": x.get("Лице за контакт") or x.get("Архитекти / управители") or x.get("Архитекти") or "",
                         "address": x.get("Адрес", ""), "rating": x.get("Оценка в Google", ""), "kab": x.get("Профил в КАБ", ""),
                         "objects": objects, "confirmed": False, "source": src})
    # Google Maps (Apify, plovdiv_maps.py) – само бюрата, които ги няма в КАБ по телефон или сайт
    maps = ROOT / "output" / "plovdiv" / "maps_arhitekti_vsichki.json"
    if maps.exists():
        seen_ph = {ph for r in rows for ph in r["phones"]}
        seen_dom = {web_domain(r["website"]) for r in rows if r["website"]}
        for x in json.loads(maps.read_text(encoding="utf-8")):
            title = (x.get("title") or "").strip()
            ph = fmt_phone(x["phone"]) if x.get("phone") else ""
            dom = web_domain(x.get("website") or "")
            if (ph and ph in seen_ph) or (dom and dom in seen_dom) or not (ph or x.get("emails")):
                continue
            seen_ph.add(ph); seen_dom.add(dom)
            rows.append({"id": "arc-m" + hashlib.sha1((x.get("placeId") or title).encode()).hexdigest()[:10], "kind": "arch",
                         "city": "Пловдив", "names": [title], "roles": ["Архитект (Google Maps)"],
                         "phones": [ph] if ph else [], "emails": x.get("emails") or [], "website": x.get("website") or "",
                         "person": "", "address": (x.get("address") or "").replace(", България", ""),
                         "rating": str(x.get("totalScore") or ""), "kab": x.get("url") or "",
                         "objects": [], "confirmed": False, "source": "Google Maps"})
    for eik, k in KNOWN_ARCH.items():
        rows.insert(0, {"id": f"arc-e{eik}", "kind": "arch", "city": "София", "names": [k["name"]], "roles": ["Архитект"],
                        "phones": k["phones"], "emails": k["emails"], "website": k["website"], "person": "",
                        "address": "", "rating": "", "kab": "", "objects": k["objects"], "confirmed": True,
                        "source": "потвърдено от сайта на архитекта и на инвеститора"})
    rows.sort(key=lambda r: (not r["confirmed"], not r["objects"], not r["phones"], r["names"][0].strip('"„“ ').lower()))
    note = ("Архитектурни бюра с телефон или имейл ({}). Филтрирай, отбележи „Избран“ и копирай имейлите или "
            "телефоните на избраните наведнъж.")
    return [{"code": "arc", "kind": "arch", "title": "Архитекти София", "rows": [r for r in rows if r["city"] == "София"],
             "note": note.format("КАБ, Google Maps")},
            {"code": "arp", "kind": "arch", "title": "Архитекти Пловдив", "rows": [r for r in rows if r["city"] == "Пловдив"],
             "note": note.format("Пловдив и областта: КАБ, Google Maps, Google")}]


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    data["sheets"].insert(0, act14(data))
    for sh in data["sheets"]:
        sh["title"] = {"sof": "София – фирми", "plv": "Пловдив – фирми"}.get(sh["code"], sh["title"])
    data["sheets"][1:1] = architects()
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    OUT.write_text(TEMPLATE.replace("__DATA__", blob), encoding="utf-8")
    print(f"{OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
