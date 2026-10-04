import { formatDateTime } from "@/lib/format";
import type { CompanyData, GrantFit, GrantGuide, GrantItem, GuideBlock } from "./types";

/**
 * Помощта за европейска програма като блокове — от тях се рисуват и
 * страницата, и Word файлът (както lib/apply/espd.ts за поръчките).
 *
 * Общият текст за подаването в ИСУН е написан на ръка по „Указания за
 * попълване на е-формуляр“ на BG16RFPR001-2.003 (Приложение 7, т. 12) и
 * ръководството на ИСУН (модул „Е-кандидатстване“). Сверено на 04.10.2026.
 * Конкретните условия идват от документите на всяка процедура, с цитат.
 */

const DOC_NAMES: Record<string, string> = {
  УК: "Условията за кандидатстване",
  ЕФ: "Указанията за попълване на е-формуляра",
  КР: "Критериите за оценка",
};

const FIT_LABEL: Record<string, string> = {
  покривате: "Изглежда, че го покривате.",
  проверете: "Проверете.",
  "не покривате": "Изглежда, че НЕ го покривате.",
};

function val(v: string | undefined, missing = "попълнете — не е въведено в помощника") {
  return v && v.trim() ? v.trim() : missing;
}

export function buildGrantBlocks(guide: GrantGuide, fit: GrantFit | null, company: Partial<CompanyData>, hasProfile: boolean) {
  const b: GuideBlock[] = [];
  const warnNumbers = (bad?: string[]) => {
    if (!bad?.length) return;
    const many = bad.length > 1;
    b.push({
      kind: "warn",
      text: `${many ? "Числата" : "Числото"} ${bad.map((n) => `„${n}“`).join(", ")} от текста по-горе не ${many ? "са намерени" : "е намерено"} в документите. Проверете ${many ? "ги" : "го"}.`,
    });
  };
  const quote = (x: GrantItem) => {
    if (x.quote?.text) b.push({ kind: "quote", quote: { ...x.quote, text: x.quote.text }, source: DOC_NAMES[x.quote.doc] ?? x.quote.doc });
  };
  const items = (list: GrantItem[], label?: (x: GrantItem) => string | null) => {
    for (const x of list) {
      const l = label?.(x);
      b.push(l ? { kind: "field", label: l, value: x.text } : { kind: "p", text: x.text });
      warnNumbers(x.badNumbers);
      quote(x);
    }
  };

  // — Накратко —
  b.push({ kind: "h2", text: "Накратко", id: "nakratko" });
  b.push({ kind: "p", text: guide.summary });
  b.push({ kind: "field", label: "Процедура", value: `${guide.code ?? ""} „${guide.title}“`.trim() });
  if (guide.programme) b.push({ kind: "field", label: "Програма", value: guide.programme });
  b.push({
    kind: "field",
    label: "Краен срок за подаване",
    value: guide.deadline ? `${formatDateTime(guide.deadline)} (по страницата на процедурата в ИСУН)` : "вижте условията",
  });
  if (guide.procedureKind === "директно предоставяне") {
    b.push({
      kind: "warn",
      text: "Това е процедура чрез директно предоставяне: помощта е само за конкретни, посочени в условията бенефициенти. Ако фирмата ви не е сред тях, не може да кандидатства сама. Вижте „Кой може да кандидатства“.",
    });
  }
  if (guide.amendments.length) {
    b.push({
      kind: "warn",
      text: `Условията са изменяни: ${guide.amendments.join("; ")}. Помощникът е чел най-новите условия, които успя да намери. Проверете в ИСУН дали няма и по-нови промени.`,
    });
  }
  if (guide.unverified > 0) {
    b.push({
      kind: "warn",
      text: `На ${guide.unverified} ${guide.unverified === 1 ? "място" : "места"} по-долу цитат или число не беше намерено дословно в документите. Те са отбелязани с „Внимание“ — проверете ги сами.`,
    });
  }
  const truncated = guide.docs.filter((d) => d.truncated);
  if (truncated.length) {
    b.push({
      kind: "warn",
      text: `Документът ${truncated.map((d) => `„${d.name}“`).join(", ")} е много дълъг и прочетохме само началото му. Проверете последните раздели сами.`,
    });
  }
  b.push({
    kind: "warn",
    text: "Това е помощ при подготовката, не правен съвет и не гаранция за одобрение. Всичко е взето от официалните документи на процедурата в ИСУН и под всяко твърдение е точният текст. Окончателно важат самите документи.",
  });

  // — За вашата фирма —
  b.push({ kind: "h2", text: "За вашата фирма", id: "za-vas" });
  if (fit) {
    b.push({ kind: "field", label: "Оценка", value: `${fit.verdict[0].toUpperCase()}${fit.verdict.slice(1)}. ${fit.why}` });
    b.push({ kind: "p", text: "Това е предварителна оценка по отговорите ви в съветника, не решение на програмата." });
    for (const c of fit.checks) b.push({ kind: "field", label: c.requirement, value: `${FIT_LABEL[c.fit] ?? ""} ${c.why}`.trim() });
    if (fit.prepare.length) {
      b.push({ kind: "h3", text: "Какво да подготвите отсега" });
      b.push({ kind: "list", items: fit.prepare });
    }
    if (fit.clarify.length) {
      b.push({ kind: "h3", text: "Какво да изясните" });
      b.push({ kind: "list", items: fit.clarify });
    }
  } else {
    b.push({
      kind: "p",
      text: hasProfile
        ? "Още не сме сравнили условията с вашата фирма. Използвайте бутона „Провери дали е за моята фирма“ на страницата."
        : "За да сравним условията с вашата фирма, първо я опишете в съветника на сайта.",
    });
  }

  // — Кой може —
  b.push({ kind: "h2", text: "Кой може да кандидатства", id: "kandidati" });
  items(guide.whoCanApply);
  if (guide.cannotApply.length) {
    b.push({ kind: "h3", text: "Кой не може да кандидатства" });
    items(guide.cannotApply);
  }

  // — Пари —
  b.push({ kind: "h2", text: "Колко пари и при какви условия", id: "pari" });
  for (const m of guide.money) {
    b.push({ kind: "field", label: m.what, value: m.text });
    warnNumbers(m.badNumbers);
    quote(m);
  }
  if (guide.aidRegime) items([guide.aidRegime], () => "Режим на помощта");

  // — За какво —
  b.push({ kind: "h2", text: "За какво дават пари", id: "deinosti" });
  if (guide.activities.length) {
    b.push({ kind: "h3", text: "Допустими дейности" });
    items(guide.activities);
  }
  if (guide.costsOk.length) {
    b.push({ kind: "h3", text: "Допустими разходи" });
    items(guide.costsOk);
  }
  if (guide.costsNot.length) {
    b.push({ kind: "h3", text: "Недопустими разходи" });
    items(guide.costsNot);
  }
  if (guide.duration) items([guide.duration], () => "Срок за изпълнение на проекта");

  // — Срокове —
  if (guide.deadlines.length) {
    b.push({ kind: "h2", text: "Срокове", id: "srokove" });
    for (const d of guide.deadlines) {
      b.push({ kind: "field", label: d.what, value: d.text });
      warnNumbers(d.badNumbers);
      quote(d);
    }
  }

  // — Оценка —
  if (guide.criteria.length) {
    b.push({ kind: "h2", text: "Как се оценява проектът", id: "ocenka" });
    for (const c of guide.criteria) {
      b.push({ kind: "h4", text: c.points ? `${c.text} (${c.points})` : c.text });
      if (c.tip) b.push({ kind: "field", label: "Как да вземете повече точки", value: c.tip });
      warnNumbers(c.badNumbers);
      quote(c);
    }
  }

  // — Формулярът —
  b.push({ kind: "h2", text: "Формулярът в ИСУН раздел по раздел", id: "formulyar" });
  b.push({
    kind: "p",
    text: "Формулярът за кандидатстване се попълва онлайн в ИСУН, модул „Е-кандидатстване“. Разделите и указанията по-долу са от документите на тази процедура.",
  });
  for (const s of guide.formSections) {
    b.push({ kind: "h3", text: s.section });
    b.push({ kind: "p", text: s.text });
    if (/кандидат/i.test(s.section)) {
      b.push({ kind: "p", text: "Данните на фирмата, които сте въвели в помощника:" });
      b.push({ kind: "field", label: "Наименование", value: val(company.name) });
      b.push({ kind: "field", label: "ЕИК", value: val(company.eik) });
      b.push({ kind: "field", label: "Седалище и адрес", value: val(company.address) });
      b.push({ kind: "field", label: "Представляващ", value: val(company.repName) });
      b.push({ kind: "field", label: "Длъжност", value: val(company.repRole) });
      b.push({ kind: "field", label: "Имейл", value: val(company.email) });
      b.push({ kind: "field", label: "Телефон", value: val(company.phone) });
      b.push({ kind: "field", label: "Размер на предприятието", value: val(company.size) });
    }
    if (s.tips.length) b.push({ kind: "list", items: s.tips });
    warnNumbers(s.badNumbers);
    quote(s);
  }

  // — Документи —
  b.push({ kind: "h2", text: "Документи за кандидатстване", id: "dokumenti" });
  for (const d of guide.documents) {
    b.push({ kind: "h4", text: d.name });
    b.push({ kind: "p", text: d.text });
    if (d.signs) b.push({ kind: "field", label: "Кой подписва", value: d.signs });
    warnNumbers(d.badNumbers);
    quote(d);
  }
  const fill = guide.files.filter((f) => /\.(docx?|xlsx?|pdf)$/i.test(f) && !/thumbs\.db/i.test(f));
  if (fill.length) {
    b.push({ kind: "h3", text: "Файловете в пакета документи на процедурата" });
    b.push({
      kind: "p",
      text: "Образците за попълване са в архива „Условия за кандидатстване“ на страницата на процедурата в ИСУН. Ето всички файлове в него:",
    });
    b.push({ kind: "list", items: fill });
  }

  // — Подаване —
  b.push({ kind: "h2", text: "Как се подава в ИСУН", id: "podavane" });
  b.push({ kind: "h3", text: "Регистрация" });
  b.push({
    kind: "steps",
    items: [
      "Отворете eumis2020.government.bg и изберете „Нов потребител“.",
      "Попълнете име, фамилия, имейл (той става потребителското ви име) и телефон.",
      "Отворете писмото за активиране, което ИСУН ви праща, и задайте парола от поне 8 знака.",
    ],
  });
  b.push({
    kind: "warn",
    text: "При вход ИСУН може да поиска код за сигурност от картинка. Ако екранният четец не го прочете, помолете някого само за тази стъпка.",
  });
  b.push({ kind: "h3", text: "Подаване и подпис" });
  b.push({
    kind: "steps",
    items: [
      "Попълнете формуляра в модул „Е-кандидатстване“, прикачете документите и натиснете „Подай предложение“.",
      "ИСУН сваля файл с разширение .isun. Запазете го в папка, в която няма други такива файлове.",
      "Подпишете този файл с квалифициран електронен подпис (КЕП) като „отделен подпис“ — получава се файл с разширение .p7s, обикновено от 3 до 9 KB. Използвайте софтуера на издателя на вашия подпис.",
      "На Mac, ако софтуерът на издателя не работи, указанията на ИСУН (към процедура 2.003) препоръчват програмата Infonotary e-DocSigner със схема „Комуникация с НАП“ — тя прави .p7s файл.",
      "Заредете .p7s файла в ИСУН. Ако системата каже „Невалиден подпис“, изтрийте заредения файл, рестартирайте компютъра и повторете стъпките.",
      "Ако фирмата се представлява само заедно от няколко души, всеки от тях подписва.",
    ],
  });
  if (guide.submission.length) {
    b.push({ kind: "h3", text: "Какво казват документите на тази процедура" });
    items(guide.submission);
  }

  // — Внимание —
  if (guide.watchOut.length) {
    b.push({ kind: "h2", text: "На какво да внимавате", id: "vnimanie" });
    items(guide.watchOut);
  }

  // — Източници —
  b.push({ kind: "h2", text: "Източници", id: "iztochnici" });
  b.push({
    kind: "list",
    items: [
      `Страницата на процедурата в ИСУН: ${guide.url} (разборът е от ${formatDateTime(guide.createdAt)}).`,
      ...guide.docs.map((d) => `${DOC_NAMES[d.label] ?? d.label}: файл „${d.name}“.`),
      "Указания за попълване на е-формуляр към процедура BG16RFPR001-2.003 и ръководството на ИСУН — за общите стъпки при регистрация и подписване.",
    ],
  });
  return b;
}
