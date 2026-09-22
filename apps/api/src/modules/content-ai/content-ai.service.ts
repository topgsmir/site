import { BadGatewayException, BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { AppUser, ContentAiResult } from "@topgsm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { AiModelService } from "../../integrations/ai/ai-model.service";
import { AiProfileService } from "../../integrations/ai/ai-profile.service";
import { calculateEstimatedCostUsd } from "../../integrations/ai/ai-usage-cost";
import { parseAiJson } from "../../integrations/ai/ai.types";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { ContentAiDraftDto } from "./content-ai.dto";
import { contentAiPrompt, parseContentAiDraft } from "./content-ai-output";

export type ContentAiKind = "blog" | "product";

@Injectable()
export class ContentAiService {
  constructor(private readonly prisma: PrismaService, private readonly profiles: AiProfileService,
    private readonly models: AiModelService, private readonly limits: AuthRateLimitService) {}

  async canUse(user: AppUser, kind: ContentAiKind): Promise<boolean> {
    if (user.role === "platform-admin") return true;
    if (user.role === "platform-staff") return kind === "blog" && Boolean(user.platformPermissions?.includes("blog_manage"));
    if (user.role !== "seller-admin" && user.role !== "seller-staff") return false;
    return Boolean(await this.prisma.seller_memberships.findFirst({
      where: { user_id: user.id, active: true, seller: {
        invited: false, approved: true, suspended_at: null,
        AND: [
          { permissions: { some: { permission: kind === "blog" ? "blog_manage" : "products_manage" } } },
          { permissions: { some: { permission: kind === "blog" ? "blog_ai" : "products_ai" } } }
        ]
      } }, select: { seller_id: true }
    }));
  }

  async availability(user: AppUser, kind: ContentAiKind) {
    const allowed = await this.canUse(user, kind);
    if (!allowed) return { allowed: false, configured: false };
    const binding = await this.prisma.ai_capability_bindings.findUnique({ where: { capability_key: `${kind}_authoring` }, select: { profile: { select: { status: true } } } });
    return { allowed, configured: binding?.profile.status === "active" };
  }

  async generate(user: AppUser, kind: ContentAiKind, input: ContentAiDraftDto, ip: string) {
    if (!await this.canUse(user, kind)) throw new ForbiddenException("AI authoring access is required");
    if (input.source.trim().length < 20) throw new BadRequestException("Provide at least 20 characters of source notes");
    const profile = await this.profiles.activeFor(`${kind}_authoring`);
    await this.limits.consumeAiRun(user.id, ip);
    const audit = await this.prisma.ai_audit_events.create({ data: {
      actor_user_id: user.id, capability_key: `${kind}_authoring`, profile_id: profile.id,
      event_type: "authoring_started", metadata: { kind, locale: input.locale },
      expires_at: new Date(Date.now() + 90 * 86_400_000)
    }, select: { id: true } });
    let completion;
    try {
      completion = await this.models.complete(profile, contentAiPrompt(kind, input.locale), JSON.stringify(input));
    } catch {
      await this.prisma.ai_audit_events.update({ where: { id: audit.id }, data: { event_type: "authoring_failed" } });
      throw new BadGatewayException("The writing assistant could not produce a draft. Please try again.");
    }
    // Account for provider usage even if its output is malformed. Never retain source text.
    await this.prisma.ai_audit_events.update({ where: { id: audit.id }, data: {
      event_type: "authoring_generated", metadata: { kind, locale: input.locale,
        inputTokens: completion.inputTokens, outputTokens: completion.outputTokens,
        estimatedCostUsd: calculateEstimatedCostUsd(profile.input_price_per_million_usd, profile.output_price_per_million_usd, completion)?.toString() ?? null }
    } });
    if (!await this.canUse(user, kind)) throw new ForbiddenException("AI authoring access was revoked");
    try {
      const draft = parseContentAiDraft(parseAiJson(completion.text));
      if (!input.coverDescription?.trim()) draft.coverAltText = "";
      if (input.categories) draft.category = input.categories.includes(draft.category) ? draft.category : "";
      if (input.tags) draft.tags = draft.tags.filter((tag) => input.tags!.includes(tag));
      return { locale: input.locale, status: "ready", draft } satisfies ContentAiResult;
    } catch {
      await this.prisma.ai_audit_events.update({ where: { id: audit.id }, data: { event_type: "authoring_invalid_output" } });
      throw new BadGatewayException("The writing assistant returned an incomplete draft. Please try again.");
    }
  }
}
