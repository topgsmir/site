import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import type { AdminShippingPolicy, ShippingPolicyRule } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateShippingPolicyDto } from "./dto/shipping-policy.dto";
import { normalizeShippingPlace } from "./shipping-place-name";

const SETTINGS_ID = 1;
const defaultRule: ShippingPolicyRule = {
  payer: "site", flatRateToman: "0", freeAboveToman: null, allowedProvinces: [],
  maxWeightGrams: null, maxLengthCm: null, maxWidthCm: null, maxHeightCm: null
};

type PolicyData = Pick<AdminShippingPolicy, "defaultRule" | "sellerRules">;

@Injectable()
export class ShippingPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AdminShippingPolicy> {
    const settings = await this.prisma.shipping_settings.findUnique({
      where: { id: SETTINGS_ID }, select: { policy: true, updated_at: true }
    });
    return { ...this.parse(settings?.policy), updatedAt: settings?.updated_at.toISOString() ?? null };
  }

  async update(input: UpdateShippingPolicyDto, actorUserId: string): Promise<AdminShippingPolicy> {
    const sellerIds = input.sellerRules.map((item) => item.sellerId);
    if (new Set(sellerIds).size !== sellerIds.length) throw new BadRequestException("Seller rules must be unique");
    const sellers = await this.prisma.sellers.findMany({ where: { id: { in: sellerIds } }, select: { id: true } });
    if (sellers.length !== sellerIds.length) throw new BadRequestException("A seller rule refers to an unknown seller");
    const policy: PolicyData = {
      defaultRule: this.normalize(input.defaultRule),
      sellerRules: input.sellerRules.map(({ sellerId, rule }) => ({ sellerId, rule: this.normalize(rule) }))
    };
    let settings: { updated_at: Date };
    try { settings = await this.prisma.$transaction(async (tx) => {
      const current = await tx.shipping_settings.findUnique({ where: { id: SETTINGS_ID }, select: { updated_at: true } });
      if ((current?.updated_at.toISOString() ?? null) !== input.updatedAt) throw new ConflictException("Shipping settings changed; reload before saving");
      const updated = await tx.shipping_settings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, policy: policy as unknown as Prisma.InputJsonValue },
        update: { policy: policy as unknown as Prisma.InputJsonValue },
        select: {
          id: true, provider: true, enabled: true, api_key_hint: true, user_id: true, store_id: true,
          product_type: true, package_type: true, policy: true, updated_at: true
        }
      });
      await tx.shipping_setting_events.create({ data: {
        settings_id: SETTINGS_ID, actor_user_id: actorUserId, provider: updated.provider,
        enabled: updated.enabled, credentials_changed: false, api_key_hint: updated.api_key_hint,
        user_id: updated.user_id, store_id: updated.store_id, sender_name: null, sender_mobile: null,
        product_type: updated.product_type, package_type: updated.package_type,
        policy: policy as unknown as Prisma.InputJsonValue
      } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002")) throw new ConflictException("Shipping settings changed; reload before saving");
      throw error;
    }
    return { ...policy, updatedAt: settings.updated_at.toISOString() };
  }

  async effective(db: Prisma.TransactionClient | PrismaService): Promise<PolicyData> {
    const settings = await db.shipping_settings.findUnique({ where: { id: SETTINGS_ID }, select: { policy: true } });
    return this.parse(settings?.policy);
  }

  rule(policy: PolicyData, sellerId: string): ShippingPolicyRule {
    return policy.sellerRules.find((item) => item.sellerId === sellerId)?.rule ?? policy.defaultRule;
  }

  private normalize(rule: ShippingPolicyRule): ShippingPolicyRule {
    const provinces = rule.allowedProvinces.map((item) => item.normalize("NFKC").trim()).filter(Boolean);
    if (provinces.length !== rule.allowedProvinces.length || new Set(provinces.map(normalizeShippingPlace)).size !== provinces.length) {
      throw new BadRequestException("Shipping provinces must be nonempty and unique");
    }
    return { ...rule, maxWeightGrams: rule.maxWeightGrams ?? null, maxLengthCm: rule.maxLengthCm ?? null,
      maxWidthCm: rule.maxWidthCm ?? null, maxHeightCm: rule.maxHeightCm ?? null,
      flatRateToman: new Prisma.Decimal(rule.flatRateToman).toString(),
      freeAboveToman: rule.freeAboveToman == null ? null : new Prisma.Decimal(rule.freeAboveToman).toString(),
      allowedProvinces: provinces };
  }

  private parse(value: Prisma.JsonValue | undefined): PolicyData {
    if (!value || typeof value !== "object" || Array.isArray(value) || !("defaultRule" in value)) return { defaultRule, sellerRules: [] };
    return value as unknown as PolicyData;
  }
}
