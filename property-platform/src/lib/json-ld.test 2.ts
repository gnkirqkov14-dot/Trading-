import { test } from "node:test";
import assert from "node:assert/strict";
import { jsonLdZaScript } from "./json-ld";

test("заглавие не може да затвори script тага", () => {
  const zlo = "</script><script>alert(1)</script>";
  const out = jsonLdZaScript({ name: zlo });
  assert.ok(!out.includes("<"));
  assert.ok(!out.includes(">"));
  assert.equal(JSON.parse(out).name, zlo);
});
