/**
 * PHOMI – изпращане на представителния имейл от Gmail на info@phomi.bg (Google Apps Script).
 *
 * Бутонът „✉ Представителен имейл“ в „PHOMI контакти“ отваря този скрипт с данните на клиента.
 * Скриптът праща имейла директно от Gmail – дизайнът, снимката и линковете остават непроменени
 * (Gmail конекторът на Claude трие снимките и пренасочва линковете, затова не минаваме през него).
 *
 * Снимки: качете в Google Drive на info@phomi.bg файловете phomi-email-hero.jpg (снимката горе) и
 * phomi-email-logo.png (логото). Ако снимката липсва в Drive, имейлът тръгва без снимка.
 */
const KEY = "JPyiDWlI4wi4Foj71WRMDxci";              // същият ключ е в страницата – пази от случайни изпращания
const SUBJECT = "PHOMI – материали за вашия проект";
const FROM_NAME = "PHOMI България";
const OPENERS = {
  interest: "Благодаря за интереса към PHOMI. Изпращам ви кратко представяне и полезните материали на едно място.",
  call: "Както се разбрахме по телефона, изпращам ви кратко представяне на PHOMI и полезните материали на едно място.",
};
const LINKS = {
  catalog: "https://www.phomi.bg/nov-katalozi-2026",
  prices: "https://cdn.prod.website-files.com/6971ee37d077eeeff8238dd7/6aba35ed3ddd713780d6df3b_PHOMI-Cenorazpis-EUR-2026.pdf",
  docs: "https://drive.google.com/drive/folders/1oeSXggnm4eGaXYEbMHVYJiINEwak878v",
  projects: "https://www.phomi.bg/nov-proekti",
  showrooms: "https://www.phomi.bg/nov-kontakti",
  site: "https://www.phomi.bg/",
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.key !== KEY) return page_("Невалиден линк", "Отворете изпращането от „PHOMI контакти“.", true);
  const to = String(p.to || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return page_("Липсва имейл", "Няма валиден имейл адрес на получателя.", true);
  const v = {
    greeting: String(p.greeting || "Здравейте,").slice(0, 120),
    opener: OPENERS[p.opener] || OPENERS.interest,
    name: String(p.sname || "").slice(0, 80),
    phone: String(p.sphone || "+359 884 30 30 70").slice(0, 40),
  };
  const images = {};
  const logo = driveImage_("phomi-email-logo.png");
  const hero = driveImage_("phomi-email-hero.jpg");
  if (logo) images.logo = logo;
  if (hero) images.hero = hero;
  try {
    GmailApp.sendEmail(to, SUBJECT, plain_(v), {htmlBody: html_(v, !!logo, !!hero), inlineImages: images, name: FROM_NAME});
  } catch (err) {
    return page_("Имейлът НЕ е изпратен", String(err), true);
  }
  return page_("✓ Имейлът е изпратен", "До: " + to + ". Можете да затворите този раздел.", false);
}

function driveImage_(name) {
  const it = DriveApp.getFilesByName(name);
  return it.hasNext() ? it.next().getBlob() : null;
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
}

function html_(v, hasLogo, hasHero) {
  const teal = "#007F8B";
  const link = (href, text) => `<a href="${href}" style="color:${teal};font-weight:700;text-decoration:underline">${text}</a>`;
  return `<div style="margin:0;padding:0;background-color:#f2f4f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f4f4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1d2526">
<tr><td align="center" style="padding:28px 32px 10px 32px">
${hasLogo ? `<img src="cid:logo" width="180" alt="PHOMI" style="display:block;width:180px;height:auto;border:0">`
          : `<div style="font-size:26px;font-weight:800;letter-spacing:4px;color:#111111">PHOMI</div>`}
</td></tr>
<tr><td align="center" style="padding:6px 32px 18px 32px;font-size:22px;line-height:28px;font-weight:700;color:#111111">PHOMI за вашите проекти</td></tr>
${hasHero ? `<tr><td style="padding:0"><img src="cid:hero" width="600" alt="Фасада с PHOMI" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>` : ""}
<tr><td style="padding:26px 32px 6px 32px;font-size:15px;line-height:23px">
<p style="margin:0 0 14px 0;font-weight:700;color:${teal}">${esc_(v.greeting)}</p>
<p style="margin:0 0 14px 0;font-weight:700">${esc_(v.opener)}</p>
<p style="margin:0 0 14px 0;font-weight:700">Визия на камък, дърво или бетон. Тънка и лека минерална облицовка с дебелина около 3–4 мм и тегло около 4 кг/м².</p>
<p style="margin:0 0 14px 0;font-weight:700">PHOMI е изцяло натурален и екологичен материал, изработен от кварцов пясък и глина. PHOMI eCovering дава свобода при оформянето на фасади и интериори: разнообразни текстури и формати, ниско тегло и решения за прави и извити повърхности.</p>
<p style="margin:0 0 18px 0;font-weight:700">Монтажът е изключително лесен: облицовката се залепва с циментово лепило към подготвената фасада. Материалът е UV защитен, удароустойчив и мразоустойчив, с клас на реакция на огън A1 или A2 според модела. Предлага се с 10-годишна гаранция и експлоатационен живот над 50 години според проведените тестове.</p>
</td></tr>
<tr><td style="padding:4px 27px 4px 27px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>${button_(LINKS.catalog, "Каталог eCovering 2026", true)}${button_(LINKS.prices, "Ценоразпис", true)}</tr>
<tr>${button_(LINKS.docs, "Сертификати и документи", false)}${button_(LINKS.projects, "Реализирани проекти", false)}</tr>
</table>
</td></tr>
<tr><td align="center" style="padding:8px 32px 6px 32px;font-size:12px;line-height:18px;font-weight:700;color:#4b5658">Цените са базови, в EUR/м² без ДДС. Доставка, лепило и монтаж се калкулират отделно.</td></tr>
<tr><td style="padding:18px 32px 6px 32px;font-size:15px;line-height:23px">
<p style="margin:0 0 8px 0;font-weight:700">Имате ли проект, за който търсите подобна визия?</p>
<p style="margin:0 0 18px 0;font-weight:700">Изпратете ми снимка или чертеж, за да обсъдим подходящите модели. Можете да видите текстурите и мострите на живо в ${link(LINKS.showrooms, "шоурумите ни в София и Пловдив")}.</p>
</td></tr>
<tr><td style="padding:8px 32px 28px 32px;font-size:14px;line-height:21px;border-top:1px solid #e3e8e8">
<p style="margin:16px 0 0 0">Поздрави,<br><b>${esc_(v.name || FROM_NAME)}</b><br>PHOMI България<br>
<span style="color:${teal};font-weight:700">info@phomi.bg · ${esc_(v.phone)}</span><br>${link(LINKS.site, "phomi.bg")}</p>
</td></tr>
</table></td></tr></table></div>`;
}

/** Бутон за имейл: клетка с цвят (bgcolor) + линк – работи в Gmail, Outlook и на телефон. */
function button_(href, text, filled) {
  const teal = "#007F8B";
  const bg = filled ? teal : "#ffffff", fg = filled ? "#ffffff" : teal;
  return `<td width="50%" style="padding:0 5px 10px 5px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="${bg}" style="background-color:${bg};border:1px solid ${teal};border-radius:4px">
<a href="${href}" target="_blank" style="display:block;padding:12px 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${fg};text-decoration:none">${text}</a>
</td></tr></table></td>`;
}

function plain_(v) {
  return [v.greeting, "", v.opener, "",
    "Визия на камък, дърво или бетон. Тънка и лека минерална облицовка с дебелина около 3–4 мм и тегло около 4 кг/м².", "",
    "Каталог eCovering 2026: " + LINKS.catalog, "Ценоразпис: " + LINKS.prices,
    "Сертификати и технически документи: " + LINKS.docs, "Реализирани проекти: " + LINKS.projects, "",
    "Цените са базови, в EUR/м² без ДДС. Доставка, лепило и монтаж се калкулират отделно.", "",
    "Поздрави,", v.name || FROM_NAME, "PHOMI България", "info@phomi.bg · " + v.phone, LINKS.site].join("\n");
}

function page_(title, text, isError) {
  const color = isError ? "#c2410c" : "#007F8B";
  return HtmlService.createHtmlOutput(
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:40px auto;padding:0 16px">
     <h2 style="color:${color}">${esc_(title)}</h2><p style="font-size:16px">${esc_(text)}</p></div>`)
    .setTitle("PHOMI имейл");
}

/** Ръчна проба от редактора: изпраща имейла до вас самите. */
function testSendToMe() {
  const me = Session.getActiveUser().getEmail();
  doGet({parameter: {key: KEY, to: me, greeting: "Здравейте, тест,", opener: "interest", sname: "Тест"}});
}
