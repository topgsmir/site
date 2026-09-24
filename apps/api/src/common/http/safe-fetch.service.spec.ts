import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { getEventListeners } from "node:events";
import https from "node:https";
import test from "node:test";
import { RequestTimeoutException } from "@nestjs/common";
import { AI_REQUEST_TIMEOUT_MS } from "../../integrations/ai/ai-request-policy";
import { SafeFetchService } from "./safe-fetch.service";

test("AI transport uses the full budget and preserves timeout failures", async (t) => {
  const timeouts: number[] = [];
  t.mock.method(https, "request", (_url: URL, options: { timeout: number }) => {
    timeouts.push(options.timeout);
    const request = Object.assign(new EventEmitter(), {
      write() {},
      end() { queueMicrotask(() => request.emit("timeout")); },
      destroy(error: Error) { request.emit("error", error); request.emit("close"); return request; },
    });
    return request;
  });
  const service = new SafeFetchService({
    validate: async () => ({ url: new URL("https://example.com"), addresses: new Set(["93.184.216.34"]) }),
    assertStillPublic: async () => {},
  } as never);
  await assert.rejects(service.fetch("https://example.com"), RequestTimeoutException);
  await assert.rejects(service.withTimeout(AI_REQUEST_TIMEOUT_MS)("https://example.com"), RequestTimeoutException);
  assert.deepEqual(timeouts, [30_000, 180_000]);
  const controller = new AbortController();
  controller.abort(new DOMException("deadline", "TimeoutError"));
  await assert.rejects(service.withTimeout(AI_REQUEST_TIMEOUT_MS)("https://example.com", { signal: controller.signal }), { name: "TimeoutError" });
  assert.equal(timeouts.length, 2, "an expired request must not contact the provider");
});

test("an in-flight AI deadline stays a timeout and removes its abort listener", async (t) => {
  const controller = new AbortController();
  t.mock.method(https, "request", () => {
    const request = Object.assign(new EventEmitter(), {
      write() {},
      end() { queueMicrotask(() => controller.abort(new DOMException("deadline", "TimeoutError"))); },
      destroy(error: Error) { request.emit("error", error); request.emit("close"); return request; },
    });
    return request;
  });
  const service = new SafeFetchService({
    validate: async () => ({ url: new URL("https://example.com"), addresses: new Set(["93.184.216.34"]) }),
    assertStillPublic: async () => {},
  } as never);
  await assert.rejects(service.withTimeout(AI_REQUEST_TIMEOUT_MS)("https://example.com", { signal: controller.signal }), RequestTimeoutException);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});
