import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import {
  ParseConstrainedStringPipe,
  ROUTE_SLUG_PATTERN,
  UUID_V4_PATTERN
} from "./parse-constrained-string.pipe";

describe("ParseConstrainedStringPipe", () => {
  it("accepts exact bounded values without rewriting them", () => {
    const pipe = new ParseConstrainedStringPipe({ label: "Slug", maxLength: 120, pattern: ROUTE_SLUG_PATTERN });
    assert.equal(pipe.transform("گوشی-سامسونگ"), "گوشی-سامسونگ");
  });

  it("rejects overlong, control-character, and malformed values", () => {
    const pipe = new ParseConstrainedStringPipe({ label: "Identifier", maxLength: 36, pattern: UUID_V4_PATTERN });
    for (const value of ["x".repeat(37), "00000000-0000-4000-8000-000000000001\n", "not-a-uuid", 123]) {
      assert.throws(() => pipe.transform(value), BadRequestException);
    }
  });
});
