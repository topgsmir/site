import assert from "node:assert/strict";
import test from "node:test";
import { parseOrderNumber } from "./order-number";

test("public order numbers accept Persian, Arabic and ASCII digits without losing bigint precision", () => {
  for (const value of ["100001", "۱۰۰۰۰۱", "١٠٠٠٠١", "#100001"]) assert.equal(parseOrderNumber(value), 100001n);
  assert.equal(parseOrderNumber("9223372036854775807"), 9223372036854775807n);
  for (const value of ["9223372036854775808", "0", "-1", "1.2", "1e5", "abc", "", "550e8400-e29b-41d4-a716-446655440000"]) assert.equal(parseOrderNumber(value), null);
});
