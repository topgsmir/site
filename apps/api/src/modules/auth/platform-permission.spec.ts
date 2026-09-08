import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { AppUser } from "@topgsm/shared-types";
import type { RequestAuthenticationService } from "./request-authentication.service";
import { PlatformPermissionGuard } from "./platform-permission.guard";

function context() {
  const request = { headers: {} };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined
    } as unknown as ExecutionContext
  };
}

function guardFor(user: AppUser) {
  const authentication = { authenticate: async () => user } as unknown as RequestAuthenticationService;
  const reflector = { getAllAndOverride: () => "blog_manage" } as unknown as Reflector;
  return new PlatformPermissionGuard(authentication, reflector);
}

describe("platform permission matrix", () => {
  it("gives the protected owner automatic access", async () => {
    const target = context();
    assert.equal(await guardFor({ id: "owner", fullName: "Owner", email: "owner@example.com", role: "platform-admin" }).canActivate(target.context), true);
  });

  it("allows only staff carrying the declared permission", async () => {
    const allowed = context();
    assert.equal(await guardFor({ id: "staff", fullName: "Editor", email: "editor@example.com", role: "platform-staff", platformPermissions: ["blog_manage"] }).canActivate(allowed.context), true);
    const denied = context();
    await assert.rejects(
      guardFor({ id: "staff", fullName: "Orders", email: "orders@example.com", role: "platform-staff", platformPermissions: ["orders_manage"] }).canActivate(denied.context),
      ForbiddenException
    );
  });
});
