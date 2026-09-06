import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import { BrowserMutationGuard } from "./browser-mutation.guard";
import { getAllowedWebOrigins, validateSecurityConfig } from "./security-config";

function contextFor(
  request: Record<string, unknown>,
  createsBrowserSession = false
) {
  const reflector = {
    getAllAndOverride: () => createsBrowserSession
  } as unknown as Reflector;
  const guard = new BrowserMutationGuard(
    reflector,
    new ConfigService({ WEB_ORIGIN: "https://app.example.com" })
  );
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {}
  } as unknown as ExecutionContext;
  return { guard, context };
}

describe("browser mutation security", () => {
  it("accepts an exact configured origin for cookie-authenticated mutations", () => {
    const { guard, context } = contextFor({
      method: "POST",
      headers: {
        cookie: "topgsm_session=opaque",
        origin: "https://app.example.com"
      }
    });
    assert.equal(guard.canActivate(context), true);
  });

  it("rejects missing or sibling origins for cookie-authenticated mutations", () => {
    for (const origin of [undefined, "https://evil.example.com"]) {
      const { guard, context } = contextFor({
        method: "POST",
        headers: { cookie: "topgsm_session=opaque", origin }
      });
      assert.throws(() => guard.canActivate(context), /origin is not allowed/i);
    }
  });

  it("permits bearer mutations without ambient cookie authority", () => {
    const { guard, context } = contextFor({
      method: "PATCH",
      headers: { authorization: "Bearer opaque" }
    });
    assert.equal(guard.canActivate(context), true);
  });

  it("requires an allowed origin for routes that create browser sessions", () => {
    const { guard, context } = contextFor(
      { method: "POST", headers: {} },
      true
    );
    assert.throws(() => guard.canActivate(context), /origin is not allowed/i);
  });
});

describe("security configuration", () => {
  it("normalizes and deduplicates exact origins", () => {
    const config = new ConfigService({
      WEB_ORIGIN: "https://app.example.com, https://app.example.com"
    });
    assert.deepEqual(getAllowedWebOrigins(config), ["https://app.example.com"]);
  });

  it("rejects non-HTTPS production origins", () => {
    const config = new ConfigService({
      NODE_ENV: "production",
      WEB_ORIGIN: "http://app.example.com"
    });
    assert.throws(() => validateSecurityConfig(config), /must use HTTPS/i);
  });

  it("rejects origins containing a path", () => {
    const config = new ConfigService({
      WEB_ORIGIN: "https://app.example.com/path"
    });
    assert.throws(() => getAllowedWebOrigins(config), /exact HTTP\(S\) origin/i);
  });
});
