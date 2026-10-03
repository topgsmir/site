import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import type { SmsService } from "./sms.service";
import { SmsRulesService } from "./sms-rules.service";
import type { SaveSmsRuleDto } from "./dto/sms-rule.dto";

const base: SaveSmsRuleDto = { eventKey: "product_sold", productType: "any", recipientKind: "seller", enabled: true };

describe("SMS recipient rules", () => {
  it("refuses to route security codes to anyone other than the requester", async () => {
    const rules = new SmsRulesService({} as PrismaService, {} as SmsService);
    await assert.rejects(() => rules.save({ ...base, eventKey: "guest_comment_verification", recipientKind: "all", templateId: 42 }, "owner"), /only to the requester/);
    await assert.rejects(() => rules.save({ ...base, eventKey: "login_otp", recipientKind: "requester", messageText: "{code}" }, "owner"), /only to the requester/);
  });

  it("requires explicit content when sending a seller event to a buyer", async () => {
    const rules = new SmsRulesService({} as PrismaService, {} as SmsService);
    await assert.rejects(() => rules.save({ ...base, recipientKind: "buyer" }, "owner"), /requires a template ID or message text/);
    await assert.rejects(() => rules.save({ ...base, messageText: "Order {query}" }, "owner"), /unsupported placeholder/);
  });

  it("dispatches rules by product type and preserves recipient-specific dedupe keys", async () => {
    const sent: Array<{ phone: string; key: string; template: string }> = [];
    const prisma = { sms_event_rules: { findMany: async () => [
      { id: "seller", recipient_kind: "seller", template_id: null, message_text: null },
      { id: "physical-buyer", recipient_kind: "buyer", template_id: 51, message_text: null }
    ] } } as unknown as PrismaService;
    const sms = { enqueue: async (phone: string, template: string, _params: unknown, key: string) => { sent.push({ phone, template, key }); } } as unknown as SmsService;
    const rules = new SmsRulesService(prisma, sms);
    assert.equal(await rules.dispatch("product_sold", { id: "event-1", productType: "physical", sellerPhone: "09121111111", buyerPhone: "09122222222", parameters: { orderId: "order-1" } }), 2);
    assert.deepEqual(sent, [
      { phone: "+989121111111", template: "seller_new_order", key: "sms-rule:event-1:seller:+989121111111" },
      { phone: "+989122222222", template: "product_sold", key: "sms-rule:event-1:physical-buyer:+989122222222" }
    ]);
  });

  it("masks recipient numbers while preserving failure information", async () => {
    const prisma = { sms_deliveries: { findMany: async () => [{ id: "one", event_key: "search_empty", recipient: "+989121234567", status: "failed", test_mode: false, attempts: 2, last_error: "SMS.ir rejected the message", created_at: new Date("2026-09-29T00:00:00Z"), sent_at: null }] } } as unknown as PrismaService;
    const page = await new SmsRulesService(prisma, {} as SmsService).deliveries({});
    assert.equal(page.items[0]?.recipient.endsWith("4567"), true);
    assert.equal(page.items[0]?.recipient.includes("912123"), false);
    assert.equal(page.items[0]?.error, "SMS.ir rejected the message");
  });

  it("keeps an enabled login path when password login is off", async () => {
    const prisma = {
      sms_event_rules: { findUnique: async () => ({ id: "rule", event_key: "login_otp", enabled: true }), findFirst: async () => null },
      auth_login_settings: { findUnique: async () => ({ email_password_enabled: false }) }
    } as unknown as PrismaService;
    await assert.rejects(() => new SmsRulesService(prisma, {} as SmsService).remove("rule", "owner"), /usable login method/);
  });
});
