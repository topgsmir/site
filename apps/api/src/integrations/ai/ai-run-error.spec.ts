import assert from "node:assert/strict";
import test from "node:test";
import { BadGatewayException, RequestTimeoutException } from "@nestjs/common";
import { classifyAiRunError } from "./ai-run-error";

test("classifies SDK-wrapped transport and deadline timeouts", () => {
  for (const cause of [new RequestTimeoutException(), new DOMException("secret", "TimeoutError")]) {
    assert.equal(classifyAiRunError(new Error("secret", { cause })).code, "AI_TIMEOUT");
  }
});

test("classifies provider failures without returning provider-controlled data", () => {
  for (const [statusCode, code] of [[401, "AI_PROVIDER_AUTH"], [403, "AI_PROVIDER_AUTH"], [429, "AI_RATE_LIMITED"], [400, "AI_PROVIDER_REJECTED"], [404, "AI_PROVIDER_REJECTED"], [503, "AI_PROVIDER_UNAVAILABLE"], [504, "AI_TIMEOUT"]] as const) {
    assert.deepEqual(classifyAiRunError({ statusCode, message: "private prompt", responseBody: "api-key", name: "secret" }), { code, statusCode });
  }
  assert.equal(classifyAiRunError(new BadGatewayException()).code, "AI_PROVIDER_UNAVAILABLE");
  const circular: { cause?: unknown } = {}; circular.cause = circular;
  assert.deepEqual(classifyAiRunError(circular), { code: "AI_RUN_FAILED", statusCode: null });
});
