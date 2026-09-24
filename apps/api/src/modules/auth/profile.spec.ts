import assert from "node:assert/strict";
import { it } from "node:test";
import { validate } from "class-validator";
import { Prisma } from "../../prisma/client";
import { createHash } from "node:crypto";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "./auth.service";
import type { AuthLoginSettingsService } from "./auth-login-settings.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import type { SecurityPolicyService } from "./security-policy.service";

const actor: AppUser = { id: "account-id", fullName: "Old Name", email: "old@example.com", username: null, role: "buyer" };

it("updates only the authenticated account and returns safe profile fields", async () => {
  let request: unknown;
  const prisma = { users: { update: async (input: unknown) => {
    request = input;
    return { full_name: "New Name", email: "new@example.com", username: "new_user" };
  } } } as unknown as PrismaService;
  const service = new AuthService(prisma, {} as AuthLoginSettingsService);
  const result = await service.updateProfile(actor, { fullName: " New Name ", email: " NEW@Example.com ", username: "new_user" });
  assert.deepEqual(request, {
    where: { id: actor.id },
    data: { full_name: "New Name", email: "new@example.com", username: "new_user" },
    select: { full_name: true, email: true, username: true }
  });
  assert.deepEqual(result, { ...actor, fullName: "New Name", email: "new@example.com", username: "new_user" });
});

it("rejects blank names and empty changes before writing", async () => {
  const prisma = { users: { update: async () => { throw new Error("unexpected write"); } } } as unknown as PrismaService;
  const service = new AuthService(prisma, {} as AuthLoginSettingsService);
  await assert.rejects(() => service.updateProfile(actor, { fullName: "  " }), { status: 400 });
  await assert.rejects(() => service.updateProfile(actor, {}), { status: 400 });
});

it("returns a conflict when email or username is already taken", async () => {
  const prisma = { users: { update: async () => {
    throw new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "7.10.0" });
  } } } as unknown as PrismaService;
  const service = new AuthService(prisma, {} as AuthLoginSettingsService);
  await assert.rejects(() => service.updateProfile(actor, { email: "taken@example.com" }), { status: 409 });
});

it("validates profile fields and rejects unrelated input", async () => {
  const dto = Object.assign(new UpdateProfileDto(), { fullName: "A", email: "invalid", username: "Bad Name", role: "platform_admin" });
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  assert.deepEqual(errors.map((error) => error.property).sort(), ["email", "fullName", "role", "username"]);
  const nullName = Object.assign(new UpdateProfileDto(), { fullName: null });
  assert.deepEqual((await validate(nullName)).map((error) => error.property), ["fullName"]);
});

it("limits profile writes by both account and IP before the eleventh edit", async () => {
  const counts = new Map<string, number>();
  const expectedAccountKey = createHash("sha256").update("profile:account:account-id").digest("hex");
  const expectedIpKey = createHash("sha256").update("profile:ip:127.0.0.1").digest("hex");
  const prisma = {
    $queryRaw: async (statement: Prisma.Sql) => {
      const [key, action, windowSeconds, , , limit] = statement.values;
      assert.equal(action, "profile");
      assert.equal(windowSeconds, 900);
      assert.equal(limit, key === expectedAccountKey ? 10 : 30);
      const count = (counts.get(String(key)) ?? 0) + 1;
      counts.set(String(key), count);
      return [{ attempt_count: count, blocked_until: count > Number(limit) ? new Date(Date.now() + 900_000) : null }];
    },
    auth_rate_limits: { deleteMany: async () => ({ count: 0 }) }
  } as unknown as PrismaService;
  const policies = {
    get: async () => ({ ipLimit: 30, subjectLimit: 10, ipWindowSeconds: 900, subjectWindowSeconds: 900 })
  } as unknown as SecurityPolicyService;
  const limits = new AuthRateLimitService(prisma, policies);
  for (let attempt = 0; attempt < 10; attempt++) await limits.consumeProfileMutation(actor.id, "127.0.0.1");
  await assert.rejects(() => limits.consumeProfileMutation(actor.id, "127.0.0.1"), { status: 429 });
  assert.equal(counts.get(expectedAccountKey), 11);
  assert.equal(counts.get(expectedIpKey), 11);
});
