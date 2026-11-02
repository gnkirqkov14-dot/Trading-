import assert from "node:assert/strict";
import test from "node:test";
import { cleanListingDescription } from "./listing-description";

test("removes Bulgarian mobile and landline formats and contact-only lines", () => {
  const input = "Апартамент в центъра.\nМоля, звънете и на телефон 0888 123 456, .\n+359 (88) 812-34-56\n032/955001\n0888123456 собственик";
  assert.equal(cleanListingDescription(input), "Апартамент в центъра.");
});

test("removes full URLs, bare domains, email and Markdown links", () => {
  const input = "Светъл офис.\nСайт: https://example.bg/imoti?id=12\nwww.example.com\nВижте нашия сайт: example.bg/oferta\n[Оферта](https://example.net/123)\nИмейл: info@example.bg";
  assert.equal(cleanListingDescription(input), "Светъл офис.");
});

test("preserves prices, area, years, dates and Bulgarian address abbreviations", () => {
  const input = "Площ 180 кв.м, наем 1 620 евро без ДДС.\nгр. Пловдив, п.к. 4000, ул. Малгара 4, ет. 3, ап. 5.\nСграда от 2026 г. Огледи на 02.11.2026, между 10-12 ч. Паркомясто +50 евро.";
  assert.equal(cleanListingDescription(input), input);
});

test("keeps property text when contact data shares a line", () => {
  assert.equal(cleanListingDescription("Просторен апартамент, 95 кв.м. Тел: 0888123456"), "Просторен апартамент, 95 кв.м.");
});

test("cleaning is idempotent and handles empty descriptions", () => {
  const input = "Офис 60 кв.м.\nТел: 0888123456\nСайт: www.example.bg";
  const clean = cleanListingDescription(input);
  assert.equal(cleanListingDescription(clean), clean);
  assert.equal(cleanListingDescription(null), "");
});
