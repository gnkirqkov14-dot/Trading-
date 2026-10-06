"""Самостоятелен HTML отчет (един файл, данните са вградени като JSON)."""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

TEMPLATE = r"""<meta charset="utf-8">
<title>Строителни обекти София</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
/* Layout: работен регистър – лента с обобщение, табове по етап, плътна таблица с филтри */
:root {
  --bg: #f3f4f2; --surface: #ffffff; --fg: #1d2326; --muted: #5f6a6f; --line: #d9dddb;
  --accent: #b5651d; --accent-soft: #f6e7d8; --hi: #2f7d4f; --hi-soft: #e1f0e6;
  --mid: #8a6d12; --mid-soft: #f4ecd2; --lo: #6b7378; --lo-soft: #eceeed;
  --display: "IBM Plex Sans Condensed", "Arial Narrow", sans-serif;
  --body: "IBM Plex Sans", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #151a1c; --surface: #1d2427; --fg: #e6eae8; --muted: #9aa5a9; --line: #2f383b;
  --accent: #e09a5a; --accent-soft: #3a2a1c; --hi: #6fc896; --hi-soft: #1d3326;
  --mid: #d9b85a; --mid-soft: #352d16; --lo: #a3acb0; --lo-soft: #283033; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #151a1c; --surface: #1d2427; --fg: #e6eae8; --muted: #9aa5a9; --line: #2f383b;
  --accent: #e09a5a; --accent-soft: #3a2a1c; --hi: #6fc896; --hi-soft: #1d3326;
  --mid: #d9b85a; --mid-soft: #352d16; --lo: #a3acb0; --lo-soft: #283033; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 14px/1.5 var(--body); margin: 0; }
.wrap { max-width: 1280px; margin: 0 auto; padding-inline: 16px; padding-block: 24px 48px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
.wrap > * { min-width: 0; }
header { display: grid; gap: 6px; }
.eyebrow { font: 600 12px var(--display); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
h1 { font: 700 clamp(26px, 4vw, 36px)/1.1 var(--display); margin: 0; text-wrap: balance; }
.sub { color: var(--muted); max-width: 70ch; margin: 0; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.stat { background: var(--surface); padding: 12px 14px; display: grid; gap: 2px; }
.stat b { font: 600 24px var(--display); font-variant-numeric: tabular-nums; }
.stat span { color: var(--muted); font-size: 12px; }
.tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid var(--line); }
.tabs button { font: 600 14px var(--display); letter-spacing: .02em; background: none; border: 0; border-bottom: 3px solid transparent; color: var(--muted); padding: 8px 12px; cursor: pointer; }
.tabs button[aria-selected="true"] { color: var(--fg); border-color: var(--accent); }
.tabs button:focus-visible, .filters :focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
.filters label { display: grid; gap: 2px; font-size: 12px; color: var(--muted); }
.filters input, .filters select { font: 14px var(--body); padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--fg); min-width: 0; }
.filters input[type=search] { width: min(280px, 100%); }
.count { margin-left: auto; color: var(--muted); font-size: 13px; }
.tablebox { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; min-width: 900px; }
th { font: 600 12px var(--display); letter-spacing: .05em; text-transform: uppercase; color: var(--muted); text-align: left; padding: 10px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--surface); }
td { padding: 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
.score { display: inline-block; min-width: 36px; text-align: center; font: 500 13px var(--mono); padding: 2px 6px; border-radius: 4px; }
.s-hi { background: var(--hi-soft); color: var(--hi); } .s-mid { background: var(--mid-soft); color: var(--mid); } .s-lo { background: var(--lo-soft); color: var(--lo); }
.chip { display: inline-block; font-size: 12px; padding: 1px 7px; border-radius: 10px; background: var(--accent-soft); color: var(--accent); white-space: nowrap; }
.chip.plain { background: var(--lo-soft); color: var(--muted); }
.stage { display: block; margin-top: 6px; font-size: 11px; line-height: 1.3; color: var(--muted); max-width: 12ch; }
.stage.on { color: var(--hi); font-weight: 600; }
.selstats { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 13px; color: var(--muted); padding: 8px 2px; }
.selstats b { color: var(--fg); font-variant-numeric: tabular-nums; }
.badge { display: inline-block; font-size: 11px; padding: 1px 6px; border-radius: 9px; margin-top: 6px; }
.badge.ok { background: var(--hi-soft); color: var(--hi); }
.badge.est { background: var(--lo-soft); color: var(--muted); }
.badge.warn { background: var(--mid-soft); color: var(--mid); }
.obj { max-width: 46ch; }
.obj p { margin: 0; }
.visual { display: block; margin-bottom: 6px; max-width: 220px; }
.visual img { display: block; width: 100%; max-width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); background: var(--lo-soft); }
.visual span { display: block; font-size: 11px; color: var(--muted); margin-top: 2px; }
.small { color: var(--muted); font-size: 12px; }
.contact { display: grid; gap: 1px; font-size: 12px; }
.contact .sel { user-select: all; font-family: var(--mono); }
a { color: var(--accent); }
.links { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; }
.note { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; max-width: 80ch; }
.note h2 { font: 600 18px var(--display); margin: 0 0 6px; }
.note ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
.empty { padding: 24px; color: var(--muted); text-align: center; }
.people { display: grid; gap: 8px; min-width: 260px; }
.person { display: grid; gap: 1px; font-size: 12px; padding-left: 8px; border-left: 2px solid var(--line); }
.person.inv { border-color: var(--accent); }
.person .role { font: 600 11px var(--display); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.person .nm { font-size: 13px; color: var(--fg); }
.person .sel { user-select: all; font-family: var(--mono); }
.person .src { color: var(--muted); }
.more { padding: 10px; color: var(--muted); font-size: 13px; }
</style>

<div class="wrap">
  <header>
    <div class="eyebrow">Публични регистри · Столична община · КСБ</div>
    <h1>Строителни обекти София</h1>
    <p class="sub" id="sub"></p>
  </header>
  <section class="stats" id="stats"></section>

  <nav class="tabs" role="tablist">
    <button role="tab" id="tab-permits" aria-selected="true" data-tab="permits">Разрешения за строеж</button>
    <button role="tab" id="tab-builders" aria-selected="false" data-tab="builders">Строители и подизпълнители</button>
    <button role="tab" id="tab-arch" aria-selected="false" data-tab="arch">Архитектурни бюра</button>
    <button role="tab" id="tab-visas" aria-selected="false" data-tab="visas">Визи за проектиране</button>
    <button role="tab" id="tab-oesut" aria-selected="false" data-tab="oesut">Протоколи ОЕСУТ</button>
    <button role="tab" id="tab-howto" aria-selected="false" data-tab="howto">Как да работите</button>
    <button role="tab" id="tab-about" aria-selected="false" data-tab="about">Как се събира</button>
  </nav>

  <section id="pane-permits">
    <div class="filters">
      <label>Търсене<input type="search" id="q" placeholder="адрес, фирма, обект…"></label>
      <label>Вид<select id="kind"><option value="">Всички</option></select></label>
      <label>Район<select id="region"><option value="">Всички</option></select></label>
      <label>Етап<select id="stage"><option value="facade" selected>Подходящи за фасада – преди Акт 14</option><option value="">Всички етапи</option><option value="hole">Изкоп („на дупка“)</option><option value="rough">Груб строеж – преди Акт 14</option><option value="late">Около Акт 14</option><option value="finish">След Акт 14</option><option value="done">Въведени (Акт 16)</option><option value="confirmed">Само с потвърден етап</option></select></label>
      <label>Мин. оценка<select id="minscore"><option value="0">0</option><option value="40" selected>40</option><option value="60">60</option><option value="75">75</option></select></label>
      <label>Възложител<select id="who"><option value="">Всички</option><option value="co">Само фирми</option><option value="contact">С телефон/имейл на инвеститора</option><option value="arch">С архитект (потвърден или кандидат)</option><option value="archok">С потвърден архитект</option><option value="eikrev">ЕИК за проверка</option><option value="visual">С визуализация</option></select></label>
      <span class="count" id="count"></span>
    </div>
    <div class="selstats" id="selstats" aria-live="polite"></div>
    <div class="tablebox"><table>
      <thead><tr><th>Оценка</th><th>Обект</th><th>Кат. / РЗП</th><th>Район / адрес</th><th>Контакти: инвеститор, надзор, архитект</th><th>Влязло в сила</th></tr></thead>
      <tbody id="rows"></tbody>
    </table><div class="more" id="pmore" hidden></div></div>
  </section>

  <section id="pane-builders" hidden>
    <p class="sub">Всички фирми от София, вписани в Централния професионален регистър на строителя (КСБ) за сгради (групи 1.1–1.4) или за отделни видове работи (група 5, подизпълнители). Контактите са от публичните им профили.</p>
    <div class="filters">
      <label>Търсене<input type="search" id="bq" placeholder="фирма, управител, ЕИК…"></label>
      <label>Група<select id="bgroup"><option value="">Всички</option></select></label>
      <label>Вид работа<select id="bwork"><option value="">Всички</option></select></label>
      <label>Контакт<select id="bcontact"><option value="">Всички</option><option value="phone">С телефон</option><option value="email">С имейл</option></select></label>
      <span class="count" id="bcount"></span>
    </div>
    <div class="tablebox"><table>
      <thead><tr><th>Фирма</th><th>Групи в КСБ</th><th>Видове работи</th><th>Контакти</th><th>Управители</th></tr></thead>
      <tbody id="brows"></tbody>
    </table><div class="more" id="bmore" hidden></div></div>
  </section>

  <section id="pane-arch" hidden>
    <p class="sub">Архитектурните бюра в София от регистъра на Камарата на архитектите (КАБ) и от Google Maps, обединени по сайт, телефон и име. Контактите са от КАБ, Търговския регистър, Google Maps и сайтовете на бюрата.</p>
    <div class="filters">
      <label>Търсене<input type="search" id="aq" placeholder="бюро, архитект, адрес…"></label>
      <label>Колегия<select id="acol"><option value="">Всички</option></select></label>
      <label>Източник<select id="asrc"><option value="">КАБ и Google Maps</option><option value="kab">Регистър на КАБ</option><option value="maps">Google Maps</option><option value="both">И в двата</option></select></label>
      <label>Контакт<select id="acontact"><option value="">Всички</option><option value="phone">С телефон</option><option value="email">С имейл</option></select></label>
      <span class="count" id="acount"></span>
    </div>
    <div class="tablebox"><table>
      <thead><tr><th>Бюро</th><th>Архитекти</th><th>Контакти</th><th>Адрес</th></tr></thead>
      <tbody id="arows"></tbody>
    </table><div class="more" id="amore" hidden></div></div>
  </section>

  <section id="pane-visas" hidden>
    <p class="sub">Визата за проектиране е най-ранният етап: собственикът още няма проект и тепърва търси архитект. Името на заявителя е заличено, но имотът (УПИ, КККР) се вижда и може да се проследи.</p>
    <div class="tablebox"><table>
      <thead><tr><th>Дата</th><th>Номер</th><th>Район</th><th>Имот</th><th>Основание</th><th>Документ</th></tr></thead>
      <tbody id="visas"></tbody>
    </table></div>
  </section>

  <section id="pane-oesut" hidden>
    <p class="sub">Протоколите са сканирани PDF файлове. В тях са инвеститорите и проектантите на големите проекти още преди разрешението. Следващата стъпка е автоматичното им разчитане (OCR).</p>
    <div class="tablebox"><table>
      <thead><tr><th>Дата</th><th>Номер</th><th>Вид</th><th>Файл</th></tr></thead>
      <tbody id="oesut"></tbody>
    </table></div>
  </section>

  <section id="pane-howto" hidden class="note">
    <h2>Кои обекти да изберете</h2>
    <ul>
      <li>Раздел „Разрешения за строеж“ → <b>Етап: Подходящи за фасада – преди Акт 14</b> (по подразбиране е избрано).</li>
      <li><b>Мин. оценка 60</b> оставя големите многофамилни и офис сгради. За повече обекти сложете 40.</li>
      <li><b>Възложител: С телефон/имейл на инвеститора</b> – за обектите, на които може да се обадите веднага.</li>
      <li>Етапът е изчислен по датата на разрешението. Зелен текст в кавички („Акт 14 – март 2027“) означава, че инвеститорът сам е публикувал етапа – това е най-сигурното.</li>
    </ul>
    <h2 style="margin-top:14px">Кога е най-добрият момент за фасадни панели</h2>
    <ul>
      <li><b>Изкоп („на дупка“)</b> – фасадата още може да се смени в проекта. Търсете архитекта и инвеститора.</li>
      <li><b>Груб строеж, преди Акт 14</b> – инвеститорът и строителят избират доставчици за фасадата. Най-добрият момент за оферта и мостри.</li>
      <li><b>Около Акт 14</b> – фасадата започва. Говорете със строителя и фасадната фирма за доставка.</li>
    </ul>
    <h2 style="margin-top:14px">На кого да се обадите</h2>
    <ul>
      <li><b>Инвеститорът</b> решава за материала и цената. Питайте и кой е архитектът и кой е строителят.</li>
      <li><b>Строителният надзор</b> знае строителя и проектантите на обекта – полезно, когато инвеститорът няма контакт.</li>
      <li><b>Архитектът</b> вписва материала в проекта. Раздел „Архитектурни бюра“ – за този и следващите им проекти.</li>
      <li><b>Строители и фасадни фирми</b> – раздел „Строители и подизпълнители“ → вид работа <b>43.33 Полагане на облицовки</b> или <b>43.31 Полагане на мазилки</b>: това са фирмите, които монтират фасади.</li>
    </ul>
    <h2 style="margin-top:14px">Повтаряйте всеки месец</h2>
    <ul>
      <li>Всеки месец в София влизат в сила около 50–60 нови разрешения за ново строителство. Новите обекти и обявите им (с визуализации и етап) се появяват постепенно.</li>
    </ul>
  </section>

  <section id="pane-about" hidden class="note">
    <h2>Откъде са данните</h2>
    <ul>
      <li><b>Разрешения за строеж</b> – публичният регистър на НАГ София (nag.sofia.bg). За всяко разрешение: възложител, обект, категория, РЗП, адрес, строителен надзор и сканираното разрешение.</li>
      <li><b>Визи за проектиране</b> – регистър на НАГ. Най-ранен сигнал за бъдещ обект.</li>
      <li><b>Протоколи ОЕСУТ</b> – експертният съвет на общината, където се разглеждат големите проекти.</li>
      <li><b>Контакти на инвеститори и надзор</b> – Търговски регистър (телефон, имейл, управители, адрес), регистърът на КСБ и сайтът на фирмата, намерен чрез Google.</li>
      <li><b>Вероятен архитект</b> – архитектурно студио, което се появява в Google заедно с името на инвеститора. Проверете връзката преди да се обадите.</li>
      <li><b>Строители и подизпълнители</b> – Централен професионален регистър на строителя (КСБ).</li>
      <li><b>Визуализации</b> – картинката от страницата на проекта, архитекта или обявата (намерена чрез Google). Авторските права са на архитекта или инвеститора; линкът води към източника.</li>
      <li><b>Архитектурни бюра</b> – регистър „Проектантски бюра“ на Камарата на архитектите (kab.bg).</li>
    </ul>
    <h2 style="margin-top:14px">Оценка 0–100</h2>
    <ul>
      <li>Ново строителство носи най-много точки, ремонт и преустройство най-малко.</li>
      <li>По-висока категория строеж (1–3) и по-голяма РЗП дават повече точки.</li>
      <li>Възложител фирма носи още 10 точки.</li>
    </ul>
  </section>
</div>

<script>
const DATA = __DATA__;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtDate = (s) => s ? s.split("-").reverse().join(".") : "–";
const fmtNum = (n) => n ? Math.round(n).toLocaleString("bg-BG") + " м²" : "–";
const P = DATA.permits;

$("#sub").textContent = `Разрешения за строеж, влезли в сила от ${fmtDate(DATA.since)} до ${fmtDate(DATA.generated.slice(0,10))}. Етапът е „потвърден“ само при официален документ (Акт 16) или ръчно потвърждение; иначе е „приблизителен“ – изчислен по датата на разрешението и РЗП.`;
const newBuild = P.filter(p => p.kind === "Ново строителство");
const withContact = P.filter(p => p.investor_phone || p.investor_email);
const bigRzp = P.reduce((a, p) => a + (p.kind === "Ново строителство" ? (p.rzp_with_basement || p.rzp || 0) : 0), 0);
$("#stats").innerHTML = [
  [P.length, "обекта общо"],
  [P.filter(p => p.facade_window).length, "подходящи за фасада (преди Акт 14)"],
  [newBuild.length, "от тях ново строителство"],
  [Math.round(bigRzp).toLocaleString("bg-BG"), "м² РЗП ново строителство"],
  [withContact.length, "с телефон/имейл на инвеститора (всички обекти)"],
  [P.filter(p => (p.links || []).some(l => l.role === "архитект" && l.status === "потвърдена")).length + " / " + P.filter(p => (p.links || []).some(l => l.role === "архитект")).length, "с архитект: потвърден / всички (всички обекти)"],
  [P.filter(p => p.stage_status === "потвърден").length, "с потвърден етап (всички обекти)"],
  [P.filter(p => p.visual).length, "с визуализация"],
  [DATA.builders.length.toLocaleString("bg-BG"), "строители и подизпълнители"],
  [DATA.architects.length.toLocaleString("bg-BG"), "архитектурни бюра"],
  [DATA.architects.filter(a => a.phones.length).length.toLocaleString("bg-BG"), "архитектурни бюра с телефон"],
  [DATA.visas.length, "визи за проектиране"],
  [DATA.oesut.length, "протокола ОЕСУТ"],
].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");

const fill = (sel, values) => [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,"bg"))
  .forEach(v => sel.insertAdjacentHTML("beforeend", `<option>${esc(v)}</option>`));
fill($("#kind"), P.map(p => p.kind));
fill($("#region"), P.map(p => p.region));

function scoreCls(s) { return s >= 60 ? "s-hi" : s >= 40 ? "s-mid" : "s-lo"; }
const href = (u) => /^https?:\/\//.test(u) ? u : "https://" + u;
const fmtPhone = (p) => {
  let m = /^\+3592(\d{3})(\d{4})$/.exec(p || "");            // София: +359 2 915 1858
  if (m) return `+359 2 ${m[1]} ${m[2]}`;
  m = /^\+359(8[789]|9[89])(\d{3})(\d{4})$/.exec(p || "");     // мобилен: +359 88 812 3456
  if (m) return `+359 ${m[1]} ${m[2]} ${m[3]}`;
  m = /^\+359(\d{2,3})(\d{2,3})(\d{3})$/.exec(p || "");        // други градове
  return m ? `+359 ${m[1]} ${m[2]} ${m[3]}` : p;
};
function person(c, cls) {
  const lines = [`<span class="role">${esc(c.role)}</span>`, `<span class="nm">${esc(c.name)}${c.eik ? ` <span class="src">ЕИК ${esc(c.eik)}</span>` : ""}</span>`];
  (c.phones || []).slice(0, 3).forEach(ph => lines.push(`<span class="sel">${esc(fmtPhone(ph))}</span>`));
  (c.emails || []).slice(0, 3).forEach(em => lines.push(`<span class="sel">${esc(em)}</span>`));
  if (c.website) lines.push(`<a href="${esc(href(c.website))}" target="_blank" rel="noopener">${esc(c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>`);
  if ((c.managers || []).length) lines.push(`<span>Упр.: ${esc(c.managers.slice(0, 2).join(", "))}</span>`);
  if (c.eik_status === "потвърден") lines.push(`<span class="src" title="${esc((c.eik_evidence || {}).snippet || "")}">ЕИК потвърден от PDF на разрешението${c.eik_reason ? " · " + esc(c.eik_reason) : ""}</span>`);
  else if (c.eik_status === "за проверка") lines.push(`<span class="badge warn" title="${esc((c.eik_evidence || {}).snippet || "")}">ЕИК за проверка: ${esc(c.eik_reason || "")}</span>`);
  else if (c.eik_status === "не е разчетен") lines.push(`<span class="src">ЕИК не е разчетен от PDF: ${esc(c.eik_reason || "")}</span>`);
  if (c.link_basis) lines.push(`<span class="src">Основание: ${esc(c.link_basis)}${c.link_date ? " · " + esc(fmtDate(c.link_date.slice(0, 10))) : ""}</span>`);
  if ((c.group || []).length > 1) lines.push(`<span class="src" title="${esc(c.group.join(", "))}">Група: ${c.group.length} фирми с общ телефон/имейл${c.group_objects > 1 ? ` · ${c.group_objects} обекта` : ""}</span>`);
  else if (c.group_objects > 1) lines.push(`<span class="src">${c.group_objects} обекта в списъка</span>`);
  if (c.evidence) lines.push(`<a class="src" href="${esc(c.evidence.url)}" target="_blank" rel="noopener">откъде: ${esc(c.evidence.title.slice(0, 60))}</a>`);
  const src = Object.entries(c.links || {}).map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(k)}</a>`);
  if (src.length) lines.push(`<span class="src">${src.join(" · ")}</span>`);
  if (!(c.phones || []).length && !(c.emails || []).length) lines.push(`<span class="src">няма публикуван контакт</span>`);
  return `<div class="person ${cls}">${lines.join("")}</div>`;
}
function contact(p) {
  const people = (p.contacts || []).map(c => person(c, c.role.startsWith("Инвеститор") ? "inv" : ""));
  const named = new Set((p.contacts || []).filter(c => c.role.startsWith("Инвеститор")).map(c => c.name));
  const persons = (p.investor || "").split(",").map(x => x.trim()).filter(x => x && !named.has(x) && !/ООД|ЕАД|\bАД\b|ЕТ\b/.test(x));
  if (persons.length) people.unshift(`<div class="person inv"><span class="role">Инвеститор</span><span class="nm">${esc(persons.slice(0, 4).join(", "))}${persons.length > 4 ? ` и още ${persons.length - 4}` : ""}</span></div>`);
  if (!(p.contacts || []).some(c => c.role === "Строителен надзор") && p.supervision && p.supervision !== "-")
    people.push(`<div class="person"><span class="role">Строителен надзор</span><span class="nm">${esc(p.supervision)}</span></div>`);
  return `<div class="people">${people.join("")}</div>`;
}
function stageBadge(p) {
  const ev = p.stage_evidence || {};
  const tip = [ev.source, ev.detail, ev.date ? "дата: " + fmtDate(ev.date) : "", ev.retrieved ? "извлечено: " + fmtDate(ev.retrieved) : ""].filter(Boolean).join(" · ");
  if (p.stage_status === "потвърден") return `<span class="badge ok" title="${esc(tip)}">потвърден</span><span class="stage">${esc(ev.detail || "")}${ev.date ? " · " + esc(fmtDate(ev.date)) : ""}</span>`;
  const ms = (p.milestones || []).map(m => `<a class="stage on" href="${esc(m.url)}" target="_blank" rel="noopener" title="${esc([m.source, m.retrieved ? "проверено: " + fmtDate(m.retrieved) : ""].filter(Boolean).join(" · "))}">${esc(m.label || "Потвърдено")}: ${esc(m.what)}${m.date ? " · " + esc(fmtDate(m.date)) : " · дата не е разчетена"}${m.historical ? " (историческо, не текущ етап)" : ""}</a>`).join("");
  if (p.stage_status === "приблизителен") return `<span class="badge est" title="${esc(tip)}">приблизителен</span>${ms}`;
  return `<span class="badge warn" title="${esc(tip)}">неизвестен</span>`;
}
function render() {
  const q = $("#q").value.trim().toLowerCase(), kind = $("#kind").value, region = $("#region").value;
  const min = +$("#minscore").value, who = $("#who").value, st = $("#stage").value;
  const rows = P.filter(p => p.score >= min && (!kind || p.kind === kind) && (!region || p.region === region)
    && (!st || (st === "facade" ? p.facade_window : st === "confirmed" ? p.stage_status === "потвърден" : p.stage_code === st))
    && (!who || (who === "co" ? p.investor_is_company : who === "arch" ? (p.links || []).some(l => l.role === "архитект") : who === "archok" ? (p.links || []).some(l => l.role === "архитект" && l.status === "потвърдена") : who === "eikrev" ? (p.contacts || []).some(c => c.eik_status === "за проверка") : who === "visual" ? !!p.visual : (p.investor_phone || p.investor_email)))
    && (!q || [p.object, p.investor, p.address, p.supervision, p.region, p.architect, p.project_name ? p.project_name.name : ""].join(" ").toLowerCase().includes(q)));
  $("#count").textContent = `${rows.length} от ${P.length}`;
  const n = (f) => rows.filter(f).length;
  $("#selstats").innerHTML = [
    ["В селекцията", rows.length + " обекта"],
    ["с контакт на инвеститора", n(p => p.investor_phone || p.investor_email)],
    ["с контакт на надзора", n(p => (p.contacts || []).some(c => c.role === "Строителен надзор" && ((c.phones || []).length || (c.emails || []).length)))],
    ["ЕИК потвърден от PDF", n(p => (p.contacts || []).some(c => c.eik_status === "потвърден"))],
    ["ЕИК за проверка", n(p => (p.contacts || []).some(c => c.eik_status === "за проверка"))],
    ["архитект потвърден / кандидат", n(p => (p.links || []).some(l => l.role === "архитект" && l.status === "потвърдена")) + " / " + n(p => (p.links || []).some(l => l.role === "архитект" && l.status !== "потвърдена"))],
    ["етап потвърден / приблизителен", n(p => p.stage_status === "потвърден") + " / " + n(p => p.stage_status === "приблизителен")],
    ["потвърдено започнал (протокол обр. 2)", n(p => (p.milestones || []).length)],
    ["строител потвърден / кандидат", n(p => (p.links || []).some(l => l.role === "строител" && l.status === "потвърдена")) + " / " + n(p => (p.links || []).some(l => l.role === "строител" && l.status !== "потвърдена"))],
  ].map(([l, v]) => `<span>${l}: <b>${v}</b></span>`).join("");
  const shownP = rows.slice(0, 300);
  $("#pmore").hidden = rows.length <= shownP.length;
  $("#pmore").textContent = `Показани са първите ${shownP.length} (подредени по оценка). Стеснете филтрите или търсенето, за да видите останалите.`;
  $("#rows").innerHTML = rows.length ? shownP.map(p => `<tr>
    <td><span class="score ${scoreCls(p.score)}">${p.score}</span>${p.stage ? `<span class="stage ${p.facade_window ? "on" : ""}">${esc(p.stage)}</span>` : ""}${stageBadge(p)}${(p.stage_hints || []).map(h => `<a class="stage on" href="${esc(h.url)}" target="_blank" rel="noopener">„${esc(h.text)}“</a>`).join("")}</td>
    <td class="obj">${p.visual ? `<a class="visual" href="${esc(p.visual.page)}" target="_blank" rel="noopener"><img src="${p.visual.thumb}" alt="Визуализация: ${esc(p.visual.title)}" loading="lazy"><span>Източник: ${esc(p.visual.page.replace(/^https?:\/\/(www\.)?/, "").split("/")[0])}</span></a>` : ""}${p.project_name ? `<p><b>${esc(p.project_name.name)}</b> <a class="small" href="${esc(p.project_name.url)}" target="_blank" rel="noopener">${esc(p.project_name.source)}</a></p>` : ""}<p>${esc(p.object)}</p>${(p.identification || []).map(d => `<div class="small">Идентификация: ${esc(d.what)} – <a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.source)}</a>${d.published ? " · публикувано " + esc(fmtDate(d.published)) : ""}${d.checked ? " · проверено " + esc(fmtDate(d.checked)) : ""}</div>`).join("")}${(p.rejected_sources || []).map(d => `<div class="small">Не се отнася за обекта: <a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.source)}</a> – ${esc(d.reason)}</div>`).join("")}
      <div class="links" style="margin-top:4px"><span class="chip">${esc(p.kind)}</span>${p.building_type ? `<span class="chip plain">${esc(p.building_type)}</span>` : ""}
      <a href="${esc(p.url)}" target="_blank" rel="noopener">№ ${esc(p.number)}</a>${p.pdf_url ? `<a href="${esc(p.pdf_url)}" target="_blank" rel="noopener">PDF</a>` : ""}<a href="${esc(p.map_url)}" target="_blank" rel="noopener">карта</a></div>${(p.other_permits || []).length ? `<div class="small" style="margin-top:4px">Още ${p.other_permits.length} ${p.other_permits.length === 1 ? "разрешение" : "разрешения"} за същия имот: ${p.other_permits.slice(0, 4).map(o => `<a href="${esc(o.url)}" target="_blank" rel="noopener" title="${esc(o.object)}">№ ${esc(o.number)}</a>`).join(", ")}</div>` : ""}</td>
    <td class="num">${p.category ? "кат. " + p.category : "–"}<br>${fmtNum(p.rzp_with_basement || p.rzp)}</td>
    <td>${esc(p.region)}<div class="small">${esc(p.address || p.locality)}</div></td>
    <td>${contact(p)}</td>
    <td class="num">${fmtDate(p.in_force)}</td></tr>`).join("")
    : `<tr><td colspan="6" class="empty">Няма обекти с тези филтри. Намалете минималната оценка или изчистете търсенето.</td></tr>`;
}
["#q","#kind","#region","#minscore","#who","#stage"].forEach(s => $(s).addEventListener("input", render));
render();

const B = DATA.builders;
const groupsAll = [...new Set(B.flatMap(b => b.list_groups || []))].sort();
groupsAll.forEach(g => $("#bgroup").insertAdjacentHTML("beforeend", `<option>${esc(g)}</option>`));
const workCount = {};
B.forEach(b => (b.works || []).forEach(w => workCount[w] = (workCount[w] || 0) + 1));
Object.keys(workCount).sort().forEach(w => $("#bwork").insertAdjacentHTML("beforeend", `<option value="${esc(w)}">${esc(w)} (${workCount[w]})</option>`));
function renderBuilders() {
  const q = $("#bq").value.trim().toLowerCase(), g = $("#bgroup").value, w = $("#bwork").value, c = $("#bcontact").value;
  const rows = B.filter(b => (!g || (b.list_groups || []).includes(g)) && (!w || (b.works || []).includes(w))
    && (!c || (c === "phone" ? b.phones.length : b.emails.length))
    && (!q || [b.name, b.eik, (b.representatives || []).join(" ")].join(" ").toLowerCase().includes(q)));
  $("#bcount").textContent = `${rows.length.toLocaleString("bg-BG")} от ${B.length.toLocaleString("bg-BG")}`;
  const shown = rows.slice(0, 300);
  $("#brows").innerHTML = shown.map(b => `<tr>
    <td><b>${esc(b.name)}</b><div class="small">ЕИК ${esc(b.eik)} · <a href="${esc(b.ksb_url)}" target="_blank" rel="noopener">профил в КСБ</a></div></td>
    <td class="small">${(b.list_groups || []).map(esc).join("<br>")}</td>
    <td class="small">${(b.works || []).slice(0, 4).map(esc).join("<br>")}${(b.works || []).length > 4 ? `<br>и още ${b.works.length - 4}` : ""}</td>
    <td><div class="contact">${b.phones.map(p => `<span class="sel">${esc(fmtPhone(p))}</span>`).join("")}${b.emails.map(e => `<span class="sel">${esc(e)}</span>`).join("")}${b.website ? `<a href="${esc(href(b.website))}" target="_blank" rel="noopener">${esc(b.website)}</a>` : ""}</div></td>
    <td class="small">${(b.representatives || []).slice(0, 3).map(esc).join("<br>")}</td></tr>`).join("")
    || `<tr><td colspan="5" class="empty">Няма фирми с тези филтри.</td></tr>`;
  $("#bmore").hidden = rows.length <= shown.length;
  $("#bmore").textContent = `Показани са първите ${shown.length}. Стеснете търсенето, за да видите останалите.`;
}
["#bq","#bgroup","#bwork","#bcontact"].forEach(s => $(s).addEventListener("input", renderBuilders));
renderBuilders();

const A = DATA.architects;
[...new Set(A.map(a => a.college).filter(Boolean))].sort().forEach(c => $("#acol").insertAdjacentHTML("beforeend", `<option>${esc(c)}</option>`));
function renderArch() {
  const q = $("#aq").value.trim().toLowerCase(), col = $("#acol").value, c = $("#acontact").value, src = $("#asrc").value;
  const rows = A.filter(a => (!col || a.college === col) && (!c || (c === "phone" ? a.phones.length : a.emails.length))
    && (!src || (src === "kab" ? !!a.kab_url : src === "maps" ? !!a.maps_url : !!(a.kab_url && a.maps_url)))
    && (!q || [a.name, a.address, a.contact_person, ...(a.owners || []), ...(a.staff || [])].join(" ").toLowerCase().includes(q)));
  $("#acount").textContent = `${rows.length} от ${A.length}`;
  const shown = rows.slice(0, 300);
  $("#arows").innerHTML = shown.map(a => `<tr>
    <td><b>${esc(a.name)}</b><div class="small">${[a.reg_no ? `Рег. № ${esc(a.reg_no)}` : "", a.college ? esc(a.college) : "", a.kab_url ? `<a href="${esc(a.kab_url)}" target="_blank" rel="noopener">профил в КАБ</a>` : "", a.maps_url ? `<a href="${esc(a.maps_url)}" target="_blank" rel="noopener">Google Maps${a.rating ? ` ★ ${a.rating}` : ""}</a>` : "", a.category && !a.kab_url ? esc(a.category) : ""].filter(Boolean).join(" · ")}</div></td>
    <td class="small">${[...(a.owners || []), ...(a.staff || []).slice(0, 4)].map(esc).join("<br>")}</td>
    <td><div class="contact">${a.contact_person ? `<span>${esc(a.contact_person)}</span>` : ""}${a.phones.map(p => `<span class="sel">${esc(p)}</span>`).join("")}${a.emails.map(e => `<span class="sel">${esc(e)}</span>`).join("")}${a.website ? `<a href="${esc(href(a.website))}" target="_blank" rel="noopener">${esc(a.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>` : ""}${!a.phones.length && !a.emails.length ? `<span class="src">няма публикуван контакт</span>` : ""}</div></td>
    <td class="small">${esc(a.address)}</td></tr>`).join("")
    || `<tr><td colspan="4" class="empty">Няма бюра с тези филтри.</td></tr>`;
  $("#amore").hidden = rows.length <= shown.length;
  $("#amore").textContent = `Показани са първите ${shown.length}. Стеснете търсенето, за да видите останалите.`;
}
["#aq","#acol","#acontact","#asrc"].forEach(s => $(s).addEventListener("input", renderArch));
renderArch();

$("#visas").innerHTML = DATA.visas.map(v => `<tr><td class="num">${fmtDate(v.issued)}</td><td class="num">${esc(v.number)}</td>
  <td>${esc(v.region)}</td><td class="small">${esc(v.scope)}</td><td class="small">${esc(v.basis)}</td>
  <td>${(v.files||[]).map((f,i) => `<a href="${esc(f)}" target="_blank" rel="noopener">виза${v.files.length>1?" "+(i+1):""}</a>`).join(" ")}</td></tr>`).join("")
  || `<tr><td colspan="6" class="empty">Няма визи за периода.</td></tr>`;
$("#oesut").innerHTML = DATA.oesut.map(o => `<tr><td class="num">${fmtDate(o.date)}</td><td class="num">${esc(o.number)}</td>
  <td>${esc(o.type)}</td><td>${(o.files||[]).map(f => `<a href="${esc(f)}" target="_blank" rel="noopener">PDF</a>`).join(" ")}</td></tr>`).join("")
  || `<tr><td colspan="4" class="empty">Няма протоколи за периода.</td></tr>`;

document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs button").forEach(x => x.setAttribute("aria-selected", x === b));
  ["permits","builders","arch","visas","oesut","howto","about"].forEach(t => $("#pane-" + t).hidden = t !== b.dataset.tab);
}));
</script>
"""


def write_html(path: Path, permits: list, visas: list, protocols: list, since: date,
               builders: list | None = None, architects: list | None = None) -> None:
    data = {
        "since": since.isoformat(),
        "generated": datetime.now().isoformat(timespec="minutes"),
        "permits": permits,
        "visas": visas,
        "oesut": protocols,
        "builders": builders or [],
        "architects": architects or [],
    }
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    path.write_text(TEMPLATE.replace("__DATA__", blob), encoding="utf-8")
