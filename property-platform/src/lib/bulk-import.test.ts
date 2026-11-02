import assert from "node:assert/strict";
import test from "node:test";
import { bulkIdentity, parseBulkDescription, sourceIdFromUrl, validateBulkDraft } from "./bulk-import";

const description = `Описание на имота:
Дава под наем обзаведен апартамент, без асансьор. Паркомясто + 50 евро.

Вид имот: 2-СТАЕН
Етаж: 2-ри от 4
Площ: 80,5 кв.м
Квартал: Център
Град: Пловдив
Цена: 1 250,50 € на месец
Телефон: 0878000000`;

test("uses labeled price and area, preserves the phone's leading zero", () => {
  const d = parseBulkDescription("001_2c175795614807453", "\uFEFF" + description.replaceAll("\n", "\r\n"));
  assert.equal(d.price, 1250.5); assert.equal(d.area, 80.5);
  assert.equal(d.phone, "0878000000"); assert.equal(d.floor, 2);
  assert.equal(d.type, "rent"); assert.equal(d.elevator, false);
  assert.equal(d.sourceId, "2c175795614807453");
});

test("does not fabricate a price or coerce an unsupported category", () => {
  assert.throws(() => parseBulkDescription("test", description.replace("1 250,50 € на месец", "Цена при запитване")), /цена/);
  assert.throws(() => parseBulkDescription("test", description.replace("2-СТАЕН", "ЗАВЕДЕНИЕ")), /Неподдържан/);
});

test("keeps ground floor zero and VAT wording", () => {
  const d = parseBulkDescription("test", description.replace("2-ри от 4", "Партер от 4") + "\nЦената е без ДДС");
  assert.equal(d.floor, 0); assert.match(d.description, /Цената е без ДДС/);
});

test("normalizes international Bulgarian numbers and recognizes minimal source URLs", () => {
  assert.equal(parseBulkDescription("test", description.replace("0878000000", "+359 878 000 000")).phone, "0878000000");
  assert.equal(sourceIdFromUrl("https://www.imot.bg/obiava-2c175795614807453"), "2c175795614807453");
  assert.equal(sourceIdFromUrl("https://www.imot.bg/obiava-2c175795614807453-slug"), "2c175795614807453");
});

test("repeated data retain identity across renamed folders", () => {
  const a = parseBulkDescription("first", description);
  const b = parseBulkDescription("second", description);
  assert.equal(bulkIdentity(a), bulkIdentity(b));
  assert.notEqual(bulkIdentity(a), bulkIdentity({ ...b, area: 81 }));
});

test("keeps the dedicated contact phone while removing contact data from the body", () => {
  const input = description.replace("Дава под наем обзаведен апартамент, без асансьор. Паркомясто + 50 евро.", "Дава под наем обзаведен апартамент.\nТел: 0888123456\nСайт: www.example.bg");
  const d = parseBulkDescription("test", input);
  assert.equal(d.phone, "0878000000");
  assert.equal(d.description, "Дава под наем обзаведен апартамент.");
});

test("rejects invalid client values and empty city rather than reading the next field", () => {
  const d = parseBulkDescription("test", description);
  assert.throws(() => validateBulkDraft({ ...d, price: Infinity }), /цена/);
  assert.throws(() => validateBulkDraft({ ...d, rooms: -2 }), /стаи/);
  assert.throws(() => validateBulkDraft({ ...d, phone: "not-a-phone" }), /телефон/);
  assert.throws(() => parseBulkDescription("test", description.replace("Град: Пловдив", "Град:")), /city/);
});
