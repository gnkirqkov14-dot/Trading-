import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "./phone";

test("вътрешните адреси минават", () => {
  assert.equal(safeNext("/listings/abc?x=1#y"), "/listings/abc?x=1#y");
  assert.equal(safeNext("/dashboard/profile"), "/dashboard/profile");
});

test("чуждите адреси отиват в таблото", () => {
  for (const zle of [
    "https://fake.com",
    "//fake.com",
    "/\\fake.com",
    "/\\/fake.com",
    "/\t/fake.com",
    "/\n/fake.com",
    "javascript:alert(1)",
    "",
    null,
    undefined,
  ]) {
    assert.equal(safeNext(zle), "/dashboard", String(zle));
  }
});
