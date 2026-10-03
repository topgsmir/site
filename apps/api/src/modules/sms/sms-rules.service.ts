import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { SaveSmsRuleDto, SmsDeliveryQueryDto } from "./dto/sms-rule.dto";
import { legacyTemplateForRule, type SmsEvent, type SmsProductType, type SmsRecipientKind } from "./sms-events";
import { normalizeIranianPhone } from "./phone-number";
import { SmsService } from "./sms.service";

type EventContext = {
  id: string;
  productType?: SmsProductType;
  requesterPhone?: string | null;
  buyerPhone?: string | null;
  sellerPhone?: string | null;
  parameters: Record<string, string>;
};

const CODE_EVENTS = new Set<SmsEvent>(["login_otp", "guest_comment_verification"]);
const PRODUCT_EVENTS = new Set<SmsEvent>(["product_sold", "physical_order_shipped", "bridge_success", "bridge_failure"]);

@Injectable()
export class SmsRulesService {
  constructor(private readonly prisma: PrismaService, private readonly sms: SmsService) {}

  async list() {
    const rows = await this.prisma.sms_event_rules.findMany({ orderBy: [{ event_key: "asc" }, { product_type: "asc" }, { created_at: "asc" }] });
    return rows.map((row) => this.map(row));
  }

  async save(input: SaveSmsRuleDto, actorUserId: string, id?: string) {
    this.validate(input);
    const existing = id ? await this.prisma.sms_event_rules.findUnique({ where: { id }, select: { id: true, event_key: true, enabled: true } }) : null;
    if (id && !existing) throw new NotFoundException("SMS rule not found");
    if ((existing?.event_key === "login_otp" && existing.enabled && (input.eventKey !== "login_otp" || !input.enabled)) || (input.eventKey === "login_otp" && !input.enabled)) await this.assertAlternativeLoginRule(id);
    const phone = input.recipientKind === "phone" ? normalizeIranianPhone(input.phoneNumber!) : null;
    const data = {
      event_key: input.eventKey,
      product_type: input.productType,
      recipient_kind: input.recipientKind,
      recipient_role: input.recipientKind === "role" ? input.recipientRole! : null,
      phone_number: phone,
      enabled: input.enabled,
      template_id: input.templateId ?? null,
      message_text: input.messageText?.trim() || null
    };
    const row = await this.prisma.$transaction(async (tx) => {
      const saved = id
        ? await tx.sms_event_rules.update({ where: { id }, data })
        : await tx.sms_event_rules.create({ data });
      await tx.sms_rule_events.create({ data: { rule_id: saved.id, actor_user_id: actorUserId, action: id ? "update" : "create", event_key: saved.event_key, enabled: saved.enabled } });
      return saved;
    });
    return this.map(row);
  }

  async remove(id: string, actorUserId: string) {
    const rule = await this.prisma.sms_event_rules.findUnique({ where: { id }, select: { id: true, event_key: true, enabled: true } });
    if (!rule) throw new NotFoundException("SMS rule not found");
    if (rule.event_key === "login_otp" && rule.enabled) await this.assertAlternativeLoginRule(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.sms_rule_events.create({ data: { rule_id: id, actor_user_id: actorUserId, action: "delete", event_key: rule.event_key, enabled: rule.enabled } });
      await tx.sms_event_rules.delete({ where: { id } });
    });
    return { deleted: true };
  }

  async deliveries(query: SmsDeliveryQueryDto) {
    const rows = await this.prisma.sms_deliveries.findMany({
      where: { ...(query.eventKey ? { event_key: query.eventKey } : {}), ...(query.status ? { status: query.status } : {}) },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: 51,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: { id: true, event_key: true, recipient: true, status: true, test_mode: true, attempts: true, last_error: true, created_at: true, sent_at: true }
    });
    return { items: rows.slice(0, 50).map((row) => ({ id: row.id, eventKey: row.event_key, recipient: row.recipient.replace(/.(?=.{4})/g, "•"), status: row.status, testMode: row.test_mode, attempts: row.attempts, error: row.last_error, createdAt: row.created_at.toISOString(), sentAt: row.sent_at?.toISOString() ?? null })), nextCursor: rows.length > 50 ? rows[49]?.id ?? null : null };
  }

  async enabled(eventKey: SmsEvent) {
    return Boolean(await this.prisma.sms_event_rules.findFirst({ where: { event_key: eventKey, enabled: true }, select: { id: true } }));
  }

  async dispatch(eventKey: SmsEvent, context: EventContext) {
    const rules = await this.prisma.sms_event_rules.findMany({ where: { event_key: eventKey, enabled: true, product_type: { in: ["any", context.productType ?? "any"] } } });
    const priority: Record<string, number> = { phone: 0, requester: 1, buyer: 1, seller: 1, role: 2, all: 3 };
    rules.sort((a, b) => Number(b.product_type === context.productType) - Number(a.product_type === context.productType) || (priority[a.recipient_kind] ?? 4) - (priority[b.recipient_kind] ?? 4));
    const seen = new Set<string>();
    let queued = 0;
    for (const rule of rules) {
      const template = legacyTemplateForRule(eventKey, rule.recipient_kind as SmsRecipientKind);
      const templateId = rule.template_id;
      const messageText = rule.message_text;
      if (!templateId && !messageText && !template) continue;
      const enqueue = async (phone: string) => {
        const normalized = normalizeIranianPhone(phone);
        if (seen.has(normalized)) return;
        await this.sms.enqueue(normalized, template ?? eventKey, context.parameters, `sms-rule:${context.id}:${rule.id}:${normalized}`, { eventKey, templateId, messageText });
        seen.add(normalized);
        queued++;
      };
      const direct = rule.recipient_kind === "requester" ? context.requesterPhone : rule.recipient_kind === "buyer" ? context.buyerPhone : rule.recipient_kind === "seller" ? context.sellerPhone : rule.recipient_kind === "phone" ? rule.phone_number : null;
      if (direct) { await enqueue(direct); continue; }
      if (rule.recipient_kind !== "role" && rule.recipient_kind !== "all") continue;
      let cursor: string | undefined;
      do {
        const users = await this.prisma.users.findMany({
          where: { account_status: "active", phone_number: { not: null }, ...(rule.recipient_kind === "role" ? { role: rule.recipient_role as "buyer" | "platform_admin" | "platform_staff" | "seller_admin" | "seller_staff" } : {}) },
          orderBy: { id: "asc" }, take: 100,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, phone_number: true }
        });
        for (const user of users) if (user.phone_number) await enqueue(user.phone_number);
        cursor = users.length === 100 ? users.at(-1)?.id : undefined;
      } while (cursor);
    }
    return queued;
  }

  private validate(input: SaveSmsRuleDto) {
    if (CODE_EVENTS.has(input.eventKey)) {
      if (input.recipientKind !== "requester" || input.productType !== "any" || input.messageText) throw new BadRequestException("Verification codes must go only to the requester using a provider template");
      if (input.eventKey === "guest_comment_verification" && input.enabled && !input.templateId) throw new BadRequestException("Guest comment verification requires an SMS.ir template ID");
    } else if (input.recipientKind === "requester") throw new BadRequestException("Requester is only valid for verification codes");
    if (!PRODUCT_EVENTS.has(input.eventKey) && input.productType !== "any") throw new BadRequestException("Product type does not apply to this event");
    if (input.recipientKind === "phone" && !input.phoneNumber) throw new BadRequestException("A phone number is required");
    if (input.recipientKind === "role" && !input.recipientRole) throw new BadRequestException("A user role is required");
    if (input.enabled && !input.templateId && !input.messageText && !legacyTemplateForRule(input.eventKey, input.recipientKind)) throw new BadRequestException("An enabled rule requires a template ID or message text");
    if (input.templateId && input.messageText) throw new BadRequestException("Choose either a provider template or message text");
    if (input.messageText) {
      const allowed = input.eventKey === "search_empty" ? ["query"] : input.eventKey === "pending_product" ? ["pendingCount"] : ["orderId", "productType"];
      const placeholders = [...input.messageText.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((match) => match[1]);
      if (placeholders.some((placeholder) => !allowed.includes(placeholder))) throw new BadRequestException("Message contains an unsupported placeholder");
    }
    if (input.eventKey === "physical_order_shipped" && input.productType !== "any" && input.productType !== "physical") throw new BadRequestException("Shipping messages only apply to physical products");
  }

  private async assertAlternativeLoginRule(excludedId?: string) {
    const methods = await this.prisma.auth_login_settings.findUnique({ where: { id: 1 }, select: { email_password_enabled: true } });
    if (methods?.email_password_enabled ?? true) return;
    const alternative = await this.prisma.sms_event_rules.findFirst({ where: { event_key: "login_otp", recipient_kind: "requester", enabled: true, ...(excludedId ? { id: { not: excludedId } } : {}) }, select: { id: true } });
    if (!alternative) throw new BadRequestException("Keep at least one usable login method enabled");
  }

  private map(row: { id: string; event_key: string; product_type: string; recipient_kind: string; recipient_role: string | null; phone_number: string | null; enabled: boolean; template_id: number | null; message_text: string | null; updated_at: Date }) {
    return { id: row.id, eventKey: row.event_key, productType: row.product_type, recipientKind: row.recipient_kind, recipientRole: row.recipient_role, phoneNumber: row.phone_number, enabled: row.enabled, templateId: row.template_id, messageText: row.message_text, updatedAt: row.updated_at.toISOString() };
  }
}
