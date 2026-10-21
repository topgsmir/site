import assert from "node:assert/strict";
import test from "node:test";
import { remainingAccessDays } from "./digital-access-days";

test("digital access preserves unlimited legacy purchases and rounds partial days up", () => {
  const activated = new Date("2026-10-20T00:00:00Z");
  assert.equal(remainingAccessDays(0, activated, activated.getTime()), null);
  assert.equal(remainingAccessDays(undefined, activated, activated.getTime()), null);
  assert.equal(remainingAccessDays(3, activated, activated.getTime()), 3);
  assert.equal(remainingAccessDays(3, activated, activated.getTime() + 1), 3);
  assert.equal(remainingAccessDays(3, activated, activated.getTime() + 86400000), 2);
  assert.equal(remainingAccessDays(3, activated, activated.getTime() + 3 * 86400000), 0);
  assert.equal(remainingAccessDays(3, activated, activated.getTime() + 5 * 86400000), 0);
});
