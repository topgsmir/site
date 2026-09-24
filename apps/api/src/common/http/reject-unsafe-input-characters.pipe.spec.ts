import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { RejectUnsafeInputCharactersPipe } from "./reject-unsafe-input-characters.pipe";

describe("RejectUnsafeInputCharactersPipe", () => {
  const pipe = new RejectUnsafeInputCharactersPipe();

  it("preserves ordinary text, line breaks, and Persian ZWNJ", () => {
    const value = { title: "می\u200cخواهم", body: "line one\nline two" };
    assert.equal(pipe.transform(value), value);
  });

  it("rejects NUL, bidi overrides, and unpaired surrogates at any depth", () => {
    for (const value of [{ value: "a\0b" }, { nested: ["a\u202eb"] }, "\ud800"]) {
      assert.throws(() => pipe.transform(value), BadRequestException);
    }
  });
});
