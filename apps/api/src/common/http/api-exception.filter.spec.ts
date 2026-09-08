import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForbiddenException, type ArgumentsHost } from "@nestjs/common";
import { ApiExceptionFilter } from "./api-exception.filter";

describe("API exception responses", () => {
  it("returns a safe category and request reference without dropping the HTTP status", () => {
    let status = 0;
    let body: Record<string, unknown> = {};
    const headers = new Map<string, string>();
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: "GET", originalUrl: "/api/bridge/admin/services", requestId: "request-test-1234" }),
        getResponse: () => ({
          setHeader: (name: string, value: string) => headers.set(name, value),
          status: (value: number) => {
            status = value;
            return { json: (valueBody: Record<string, unknown>) => { body = valueBody; } };
          }
        })
      })
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(new ForbiddenException("Forbidden resource"), host);

    assert.equal(status, 403);
    assert.equal(body.code, "FORBIDDEN");
    assert.equal(body.requestId, "request-test-1234");
    assert.equal(headers.get("X-Request-Id"), "request-test-1234");
  });
});
