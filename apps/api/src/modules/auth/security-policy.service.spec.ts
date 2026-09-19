import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAPTCHA_ACTIONS, SECURITY_DEFAULTS, SecurityPolicyService } from "./security-policy.service";
import type { PrismaService } from "../../prisma/prisma.service";

describe("security policy", () => {
  it("keeps existing limits and CAPTCHA off until configured", async () => {
    const prisma = { security_policies: { findUnique: async () => null, findMany: async () => [] } } as unknown as PrismaService;
    const policies = new SecurityPolicyService(prisma);
    assert.deepEqual((await policies.list()).slice(0, 2), [
      { action: "login", ipLimit: 40, subjectLimit: 8, ipWindowSeconds: 900, subjectWindowSeconds: 900, captchaEnabled: false },
      { action: "register", ipLimit: 10, subjectLimit: 3, ipWindowSeconds: 3600, subjectWindowSeconds: 86400, captchaEnabled: false }
    ]);
    assert.equal((await policies.list()).length, Object.keys(SECURITY_DEFAULTS).length);
    assert.deepEqual(CAPTCHA_ACTIONS, ["login", "register", "otp", "comment_submit_guest"]);
  });

  it("persists a policy and returns the database value", async () => {
    let stored: Record<string, number | boolean> | null = null;
    const events: unknown[] = [];
    const transactionClient = { security_policies: {
      findUnique: async () => stored,
      upsert: async ({ create }: { create: Record<string, number | boolean> }) => { stored = create; return create; }
    }, security_policy_events: { create: async ({ data }: { data: unknown }) => { events.push(data); } } };
    const prisma = { ...transactionClient, $transaction: async (callback: (tx: typeof transactionClient) => Promise<void>) => callback(transactionClient) } as unknown as PrismaService;
    const policies = new SecurityPolicyService(prisma);
    const result = await policies.update("login", { ipLimit: 20, subjectLimit: 4, ipWindowSeconds: 600, subjectWindowSeconds: 1200, captchaEnabled: true }, "admin-id");
    assert.equal(result.captchaEnabled, true);
    assert.equal(result.subjectLimit, 4);
    assert.equal(events.length, 1);
  });

  it("does not enable a browser challenge on server-to-server callbacks", async () => {
    const policies = new SecurityPolicyService({} as PrismaService);
    await assert.rejects(() => policies.update("payment_callback", { ipLimit: 20, subjectLimit: 5, ipWindowSeconds: 900, subjectWindowSeconds: 900, captchaEnabled: true }, "admin-id"), { status: 400 });
  });
});
