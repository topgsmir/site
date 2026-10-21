import assert from "node:assert/strict";
import test from "node:test";
import { OrderIdPipe } from "./order-id.pipe";

test("order routes accept the same numeric identifier as database records and reject UUIDs", () => {
  const pipe = new OrderIdPipe();
  for (const id of ["100001", "9223372036854775807"]) assert.equal(pipe.transform(id), id);
  for (const id of ["0", "01", "1.1", "-3", "1e5", "9223372036854775808", "550e8400-e29b-41d4-a716-446655440000"]) assert.throws(() => pipe.transform(id), /only digits/);
});
