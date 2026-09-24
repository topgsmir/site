import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadGatewayException } from "@nestjs/common";
import { readBoundedJsonResponse } from "./bounded-json-response";

describe("readBoundedJsonResponse", () => {
  it("parses a bounded JSON response", async () => {
    assert.deepEqual(await readBoundedJsonResponse(new Response('{"ok":true}')), { ok: true });
  });

  it("rejects malformed and oversized provider bodies", async () => {
    await assert.rejects(readBoundedJsonResponse(new Response("{")), BadGatewayException);
    await assert.rejects(readBoundedJsonResponse(new Response(JSON.stringify({ value: "x".repeat(100) })), 20), BadGatewayException);
    await assert.rejects(readBoundedJsonResponse(new Response("{}", { headers: { "content-length": "999" } }), 20), BadGatewayException);
  });
});
