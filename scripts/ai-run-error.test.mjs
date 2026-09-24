import assert from "node:assert/strict";
import test from "node:test";
import { AiRunError, aiRunErrorMessage } from "../apps/web/src/components/admin/ai-run-error.ts";

test("assistant failures show localized guidance and never raw server messages", () => {
  for (const locale of ["fa", "en", "ar"]) {
    for (const code of ["AI_TIMEOUT", "AI_PROVIDER_AUTH", "AI_RATE_LIMITED", "AI_PROVIDER_UNAVAILABLE", "AI_PROVIDER_REJECTED"]) {
      assert.notEqual(aiRunErrorMessage(new AiRunError(code), locale, "fallback"), "fallback");
    }
    for (const error of [new Error("secret"), new AiRunError("secret"), new AiRunError("__proto__"), new AiRunError("AI_RUN_FAILED")]) {
      assert.equal(aiRunErrorMessage(error, locale, "fallback"), "fallback");
    }
  }
});
