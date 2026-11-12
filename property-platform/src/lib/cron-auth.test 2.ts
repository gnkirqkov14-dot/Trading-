import { test } from "node:test";
import assert from "node:assert/strict";
import { otkazZaCron } from "./cron-auth";

const zayavka = (auth?: string) =>
  new Request("https://x.test/api/cron/a", {
    headers: auth ? { authorization: auth } : {},
  });

test("без ключ в настройките отказва на всички", () => {
  assert.equal(otkazZaCron(zayavka(), undefined)?.status, 500);
  assert.equal(otkazZaCron(zayavka("Bearer "), "")?.status, 500);
  assert.equal(otkazZaCron(zayavka("Bearer undefined"), undefined)?.status, 500);
});

test("грешен или липсващ ключ в заявката е отказ", () => {
  assert.equal(otkazZaCron(zayavka(), "taen")?.status, 401);
  assert.equal(otkazZaCron(zayavka("Bearer drug"), "taen")?.status, 401);
  assert.equal(otkazZaCron(zayavka("taen"), "taen")?.status, 401);
});

test("верният ключ минава", () => {
  assert.equal(otkazZaCron(zayavka("Bearer taen"), "taen"), null);
});
