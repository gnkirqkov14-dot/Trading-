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
.wrap { max-width: 1280px; margin: 0 auto; padding-inline: 16px; padding-block: 24px 48px; display: grid; gap: 20px; }
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
.obj { max-width: 46ch; }
.obj p { margin: 0; }
.small { color: var(--muted); font-size: 12px; }
.contact { display: grid; gap: 1px; font-size: 12px; }
.contact .sel { user-select: all; font-family: var(--mono); }
a { color: var(--accent); }
.links { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; }
.note { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; max-width: 80ch; }
.note h2 { font: 600 18px var(--display); margin: 0 0 6px; }
.note ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
.empty { padding: 24px; color: var(--muted); text-align: center; }
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
    <button role="tab" id="tab-visas" aria-selected="false" data-tab="visas">Визи за проектиране</button>
    <button role="tab" id="tab-oesut" aria-selected="false" data-tab="oesut">Протоколи ОЕСУТ</button>
    <button role="tab" id="tab-about" aria-selected="false" data-tab="about">Как се събира</button>
  </nav>

  <section id="pane-permits">
    <div class="filters">
      <label>Търсене<input type="search" id="q" placeholder="адрес, фирма, обект…"></label>
      <label>Вид<select id="kind"><option value="">Всички</option></select></label>
      <label>Район<select id="region"><option value="">Всички</option></select></label>
      <label>Мин. оценка<select id="minscore"><option value="0">0</option><option value="40" selected>40</option><option value="60">60</option><option value="75">75</option></select></label>
      <label>Възложител<select id="who"><option value="">Всички</option><option value="co">Само фирми</option><option value="contact">С контакт</option></select></label>
      <span class="count" id="count"></span>
    </div>
    <div class="tablebox"><table>
      <thead><tr><th>Оценка</th><th>Обект</th><th>Кат. / РЗП</th><th>Район / адрес</th><th>Възложител</th><th>Надзор</th><th>Влязло в сила</th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div>
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

  <section id="pane-about" hidden class="note">
    <h2>Откъде са данните</h2>
    <ul>
      <li><b>Разрешения за строеж</b> – публичният регистър на НАГ София (nag.sofia.bg). За всяко разрешение: възложител, обект, категория, РЗП, адрес, строителен надзор и сканираното разрешение.</li>
      <li><b>Визи за проектиране</b> – регистър на НАГ. Най-ранен сигнал за бъдещ обект.</li>
      <li><b>Протоколи ОЕСУТ</b> – експертният съвет на общината, където се разглеждат големите проекти.</li>
      <li><b>Контакти на фирми</b> – Централен професионален регистър на строителя (КСБ): телефон, имейл, сайт, управители.</li>
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

$("#sub").textContent = `Обекти от ${fmtDate(DATA.since)} до ${fmtDate(DATA.generated.slice(0,10))}. Събрани автоматично от публичните регистри на Столична община и КСБ.`;
const newBuild = P.filter(p => p.kind === "Ново строителство");
const withContact = P.filter(p => p.investor_phone || p.investor_email);
const bigRzp = P.reduce((a, p) => a + (p.kind === "Ново строителство" ? (p.rzp_with_basement || p.rzp || 0) : 0), 0);
$("#stats").innerHTML = [
  [P.length, "разрешения за строеж"],
  [newBuild.length, "от тях ново строителство"],
  [Math.round(bigRzp).toLocaleString("bg-BG"), "м² РЗП ново строителство"],
  [withContact.length, "с контакт на възложителя"],
  [DATA.visas.length, "визи за проектиране"],
  [DATA.oesut.length, "протокола ОЕСУТ"],
].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");

const fill = (sel, values) => [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,"bg"))
  .forEach(v => sel.insertAdjacentHTML("beforeend", `<option>${esc(v)}</option>`));
fill($("#kind"), P.map(p => p.kind));
fill($("#region"), P.map(p => p.region));

function scoreCls(s) { return s >= 60 ? "s-hi" : s >= 40 ? "s-mid" : "s-lo"; }
function contact(p) {
  const bits = [];
  if (p.investor_phone) bits.push(`<span class="sel">${esc(p.investor_phone)}</span>`);
  if (p.investor_email) bits.push(`<span class="sel">${esc(p.investor_email)}</span>`);
  if (p.investor_website) bits.push(`<a href="https://${esc(p.investor_website.replace(/^https?:\/\//,""))}" target="_blank" rel="noopener">${esc(p.investor_website)}</a>`);
  if (p.investor_ksb_url) bits.push(`<a href="${esc(p.investor_ksb_url)}" target="_blank" rel="noopener">профил в КСБ</a>`);
  return bits.length ? `<div class="contact">${bits.join("")}</div>` : "";
}
function render() {
  const q = $("#q").value.trim().toLowerCase(), kind = $("#kind").value, region = $("#region").value;
  const min = +$("#minscore").value, who = $("#who").value;
  const rows = P.filter(p => p.score >= min && (!kind || p.kind === kind) && (!region || p.region === region)
    && (!who || (who === "co" ? p.investor_is_company : (p.investor_phone || p.investor_email)))
    && (!q || [p.object, p.investor, p.address, p.supervision, p.region].join(" ").toLowerCase().includes(q)));
  $("#count").textContent = `${rows.length} от ${P.length}`;
  $("#rows").innerHTML = rows.length ? rows.map(p => `<tr>
    <td><span class="score ${scoreCls(p.score)}">${p.score}</span></td>
    <td class="obj"><p>${esc(p.object)}</p>
      <div class="links" style="margin-top:4px"><span class="chip">${esc(p.kind)}</span>${p.building_type ? `<span class="chip plain">${esc(p.building_type)}</span>` : ""}
      <a href="${esc(p.url)}" target="_blank" rel="noopener">№ ${esc(p.number)}</a>${p.pdf_url ? `<a href="${esc(p.pdf_url)}" target="_blank" rel="noopener">PDF</a>` : ""}<a href="${esc(p.map_url)}" target="_blank" rel="noopener">карта</a></div></td>
    <td class="num">${p.category ? "кат. " + p.category : "–"}<br>${fmtNum(p.rzp_with_basement || p.rzp)}</td>
    <td>${esc(p.region)}<div class="small">${esc(p.address || p.locality)}</div></td>
    <td>${esc(p.investor)}${contact(p)}</td>
    <td class="small">${esc(p.supervision || "–")}</td>
    <td class="num">${fmtDate(p.in_force)}</td></tr>`).join("")
    : `<tr><td colspan="7" class="empty">Няма обекти с тези филтри. Намалете минималната оценка или изчистете търсенето.</td></tr>`;
}
["#q","#kind","#region","#minscore","#who"].forEach(s => $(s).addEventListener("input", render));
render();

$("#visas").innerHTML = DATA.visas.map(v => `<tr><td class="num">${fmtDate(v.issued)}</td><td class="num">${esc(v.number)}</td>
  <td>${esc(v.region)}</td><td class="small">${esc(v.scope)}</td><td class="small">${esc(v.basis)}</td>
  <td>${(v.files||[]).map((f,i) => `<a href="${esc(f)}" target="_blank" rel="noopener">виза${v.files.length>1?" "+(i+1):""}</a>`).join(" ")}</td></tr>`).join("")
  || `<tr><td colspan="6" class="empty">Няма визи за периода.</td></tr>`;
$("#oesut").innerHTML = DATA.oesut.map(o => `<tr><td class="num">${fmtDate(o.date)}</td><td class="num">${esc(o.number)}</td>
  <td>${esc(o.type)}</td><td>${(o.files||[]).map(f => `<a href="${esc(f)}" target="_blank" rel="noopener">PDF</a>`).join(" ")}</td></tr>`).join("")
  || `<tr><td colspan="4" class="empty">Няма протоколи за периода.</td></tr>`;

document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs button").forEach(x => x.setAttribute("aria-selected", x === b));
  ["permits","visas","oesut","about"].forEach(t => $("#pane-" + t).hidden = t !== b.dataset.tab);
}));
</script>
"""


def write_html(path: Path, permits: list, visas: list, protocols: list, since: date) -> None:
    data = {
        "since": since.isoformat(),
        "generated": datetime.now().isoformat(timespec="minutes"),
        "permits": permits,
        "visas": visas,
        "oesut": protocols,
    }
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    path.write_text(TEMPLATE.replace("__DATA__", blob), encoding="utf-8")
