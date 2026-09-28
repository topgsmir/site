import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { UnauthorizedException, ValidationPipe, type INestApplication } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { SeoSettingsService } from "./seo-settings.service";
import { AdminSeoSettingsController, PublicSeoSettingsController } from "./seo-settings.controller";
import { defaultSeoConfiguration } from "./seo-settings.policy";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { SecurityPolicyService } from "../auth/security-policy.service";
import { RequestAuthenticationService } from "../auth/request-authentication.service";
import { BrowserMutationGuard } from "../auth/browser-mutation.guard";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const settings = new SeoSettingsService(prisma);
const limits = new AuthRateLimitService(prisma, new SecurityPolicyService(prisma));
const actor = randomUUID();
let app: INestApplication;
let base: string;
before(async () => {
  await prisma.$connect();
  const module = await Test.createTestingModule({ controllers: [AdminSeoSettingsController, PublicSeoSettingsController], providers: [
    { provide: SeoSettingsService, useValue: settings }, { provide: AuthRateLimitService, useValue: limits },
    { provide: RequestAuthenticationService, useValue: { authenticate: async (request: AuthenticatedRequest) => {
      const identity = request.headers.authorization;
      if (!identity) throw new UnauthorizedException();
      const user = { id: actor, fullName: "SEO administrator", role: identity === "admin" ? "platform-admin" : identity === "staff" ? "platform-staff" : "seller-admin" };
      request.authenticatedUser = user as AuthenticatedRequest["authenticatedUser"];
      return user;
    } } }
  ] }).compile();
  app = module.createNestApplication({ logger: false });
  app.useGlobalGuards(new BrowserMutationGuard(new Reflector(), new ConfigService({ WEB_ORIGIN: "http://localhost:3000" })));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, "127.0.0.1"); base = await app.getUrl();
});
after(async () => {
  if (app) await app.close();
  await prisma.seo_setting_events.deleteMany(); await prisma.seo_settings.deleteMany();
  await prisma.auth_rate_limits.deleteMany({ where: { action: "seo_configuration" } });
  await prisma.security_policies.deleteMany({ where: { action: "seo_configuration" } });
  await prisma.$disconnect();
});
const payload = () => ({ version: 0, configuration: defaultSeoConfiguration() });

it("protects configuration and history, rejects CSRF and validates nested input", async () => {
  for (const path of ["/admin/seo", "/admin/seo/history"]) {
    assert.equal((await fetch(base + path)).status, 401);
    for (const authorization of ["seller", "staff"]) assert.equal((await fetch(base + path, { headers: { authorization } })).status, 403);
  }
  const send = (body: unknown, headers: Record<string, string> = {}) => fetch(base + "/admin/seo", { method: "PATCH", headers: { authorization: "admin", "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  assert.equal((await send(payload(), { cookie: "topgsm_session=" + "x".repeat(43), origin: "https://evil.example" })).status, 403);
  const invalid = payload(); invalid.configuration.redirects.push({ source: "/en/admin", destination: "/en", status: 301, enabled: true });
  assert.equal((await send(invalid)).status, 400);
  const invalidNested = { ...payload(), configuration: { ...payload().configuration, injected: true } };
  assert.equal((await send(invalidNested)).status, 400);
  assert.equal(await prisma.seo_setting_events.count(), 0);
  const response = await send(payload());
  assert.equal(response.status, 200);
  const saved = await response.json(); assert.equal(saved.version, 1);
  const publicResponse = await fetch(base + "/seo/configuration");
  assert.equal(publicResponse.status, 200);
  const publicBody = await publicResponse.json();
  assert.equal(publicBody.organizationName, "Top GSM");
  assert.equal(publicBody.actorUserId, undefined); assert.equal(publicBody.version, undefined);
  const history = await settings.history(); assert.equal(history.length, 1); assert.equal(history[0]!.actorUserId, actor);
});

it("atomically saves only one concurrent revision and keeps audit history consistent", async () => {
  const current = await settings.get();
  const outcomes = await Promise.allSettled([settings.update({ version: current.version, configuration: { ...current.configuration, organizationName: "One" } }, actor), settings.update({ version: current.version, configuration: { ...current.configuration, organizationName: "Two" } }, actor)]);
  assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((item) => item.status === "rejected").length, 1);
  const latest = await settings.get(); const history = await settings.history();
  assert.equal(latest.version, current.version + 1);
  assert.equal(history[0]!.version, latest.version);
  assert.deepEqual(history[0]!.configuration, latest.configuration);
  await assert.rejects(prisma.$executeRaw`INSERT INTO seo_settings (id, version, configuration, updated_at) VALUES (2, 1, '{}'::jsonb, NOW())`);
  await assert.rejects(prisma.$executeRaw`INSERT INTO seo_setting_events (version, actor_user_id, configuration) VALUES (-1, ${actor}::uuid, '{}'::jsonb)`);
});

it("enforces shared atomic SEO limits, hashes identities, isolates buckets and resets expiry", async () => {
  await prisma.auth_rate_limits.deleteMany({ where: { action: "seo_configuration" } });
  await prisma.security_policies.upsert({ where: { action: "seo_configuration" }, create: { action: "seo_configuration", ip_limit: 30, subject_limit: 10, ip_window_seconds: 60, subject_window_seconds: 60, captcha_enabled: false }, update: {} });
  const results = await Promise.allSettled(Array.from({ length: 11 }, () => limits.consumeSeoConfiguration(actor, "192.0.2.17")));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 10);
  const rejection = results.find((result) => result.status === "rejected"); assert.equal(rejection?.status === "rejected" && rejection.reason.getStatus(), 429);
  const rows = await prisma.auth_rate_limits.findMany({ where: { action: "seo_configuration" } });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => !JSON.stringify(row).includes(actor) && !JSON.stringify(row).includes("192.0.2.17")));
  await limits.consumeSeoConfiguration(randomUUID(), "192.0.2.18");
  await prisma.$executeRaw`UPDATE auth_rate_limits SET window_started_at = NOW() - INTERVAL '2 hours', blocked_until = NOW() - INTERVAL '1 hour' WHERE action = 'seo_configuration'`;
  await limits.consumeSeoConfiguration(actor, "192.0.2.17");
});
