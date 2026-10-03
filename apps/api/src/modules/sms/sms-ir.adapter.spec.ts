import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { SmsSettingsService } from "./sms-settings.service";
import { SmsIrAdapter } from "./sms-ir.adapter";

describe("SMS.ir delivery", () => {
  it("sends a configured text message with the sender line", async () => {
    const settings = { providerCredentials: async () => ({ apiKey: "secret", lineNumber: "30001234" }) } as unknown as SmsSettingsService;
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return new Response(JSON.stringify({ status: 1 }), { status: 200 });
    };
    try {
      await new SmsIrAdapter(settings).send("+989121234567", "otp", { pendingCount: "4" }, { messageText: "4 pending: {pendingCount}" });
    } finally { globalThis.fetch = originalFetch; }
    assert.deepEqual(requests, [{ url: "https://api.sms.ir/v1/send/bulk", body: { lineNumber: 30001234, messageText: "4 pending: 4", mobiles: ["09121234567"] } }]);
  });

  it("rejects a provider-level failure even when HTTP succeeds", async () => {
    const settings = { credentialsFor: async () => ({ apiKey: "secret", templateId: 123 }) } as unknown as SmsSettingsService;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ status: 0 }), { status: 200 });
    try {
      await assert.rejects(() => new SmsIrAdapter(settings).send("+989121234567", "otp", { code: "123456" }), /rejected the message/);
    } finally { globalThis.fetch = originalFetch; }
  });
});
