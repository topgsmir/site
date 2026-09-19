import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import { AuthLoginSettingsService } from "./auth-login-settings.service";
import { AuthService } from "./auth.service";

describe("AuthLoginSettingsService", () => {
  it("keeps both methods available before an administrator saves settings", async () => {
    const prisma = { auth_login_settings: { findUnique: async () => null } } as unknown as PrismaService;
    const settings = new AuthLoginSettingsService(prisma);
    assert.deepEqual(await settings.getPublic(), { emailPasswordEnabled: true, phoneOtpEnabled: true });
  });

  it("blocks a disabled method and prevents disabling both methods", async () => {
    const prisma = { auth_login_settings: { findUnique: async () => ({ email_password_enabled: false, phone_otp_enabled: true, updated_at: new Date() }) } } as unknown as PrismaService;
    const settings = new AuthLoginSettingsService(prisma);
    await assert.rejects(() => settings.assertEmailPasswordEnabled(), { status: 503 });
    await settings.assertPhoneOtpEnabled();
    await assert.rejects(() => settings.update({ emailPasswordEnabled: false, phoneOtpEnabled: false }, "admin-id"), { status: 400 });
  });

  it("rejects password sign-in and registration before accessing user records when disabled", async () => {
    let usersAccessed = false;
    const prisma = {
      auth_login_settings: { findUnique: async () => ({ email_password_enabled: false, phone_otp_enabled: true, updated_at: new Date() }) },
      users: { findUnique: async () => { usersAccessed = true; } }
    } as unknown as PrismaService;
    const auth = new AuthService(prisma, new AuthLoginSettingsService(prisma));
    await assert.rejects(() => auth.login({ identifier: "buyer@example.com", password: "password" }), { status: 503 });
    await assert.rejects(() => auth.register({ fullName: "Buyer", email: "buyer@example.com", password: "password" }), { status: 503 });
    assert.equal(usersAccessed, false);
  });

  it("saves both flags and an audit event in one transaction", async () => {
    const events: unknown[] = [];
    const updatedAt = new Date("2026-09-19T00:00:00.000Z");
    const prisma = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
        auth_login_settings: { upsert: async ({ create }: { create: { email_password_enabled: boolean; phone_otp_enabled: boolean } }) => ({ ...create, updated_at: updatedAt }) },
        auth_login_setting_events: { create: async ({ data }: { data: unknown }) => { events.push(data); } }
      })
    } as unknown as PrismaService;
    const settings = new AuthLoginSettingsService(prisma);
    assert.deepEqual(await settings.update({ emailPasswordEnabled: true, phoneOtpEnabled: false }, "admin-id"), {
      emailPasswordEnabled: true, phoneOtpEnabled: false, updatedAt: updatedAt.toISOString()
    });
    assert.deepEqual(events, [{ actor_user_id: "admin-id", email_password_enabled: true, phone_otp_enabled: false }]);
  });
});
