import { BadRequestException, ConflictException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { randomUUID } from "node:crypto";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { PublicUrlService } from "../../common/http/public-url.service";
import { PublicHttpException } from "../../common/http/public-http.exception";
import { PrismaService } from "../../prisma/prisma.service";
import type { BindAiCapabilityDto, CreateAiProfileDto, UpdateAiProfileDto } from "./dto/ai-profile.dto";
import { AiModelService } from "./ai-model.service";
import { extractAiProviderError } from "./ai-provider-error";

const profileSelect = { id: true, name: true, provider: true, model_id: true, base_url: true, api_key_hint: true, input_price_per_million_usd: true, output_price_per_million_usd: true, status: true, last_tested_at: true, last_error_code: true, created_at: true, updated_at: true } satisfies Prisma.ai_model_profilesSelect;

@Injectable()
export class AiProfileService {
  constructor(private readonly prisma: PrismaService, private readonly crypto: CredentialCryptoService, private readonly urls: PublicUrlService, private readonly models: AiModelService) {}
  list() { return this.prisma.ai_model_profiles.findMany({ select: profileSelect, orderBy: [{ updated_at: "desc" }, { id: "desc" }] }).then((rows) => rows.map(this.summary)); }
  async create(input: CreateAiProfileDto, actorId: string) {
    const id = randomUUID();
    const baseUrl = await this.normalizeUrl(input.provider, input.baseUrl);
    const encrypted = this.crypto.encrypt(input.apiKey, `ai:${id}:api-key`, "AI");
    const pricing = this.pricing(input);
    try {
      const [row] = await this.prisma.$transaction([
        this.prisma.ai_model_profiles.create({ data: { id, name: input.name.trim(), provider: input.provider, model_id: input.modelId.trim(), base_url: baseUrl, encrypted_api_key: encrypted.ciphertext, encryption_key_id: encrypted.keyId, api_key_hint: input.apiKey.slice(-4), ...pricing, created_by_id: actorId }, select: profileSelect }),
        this.audit(actorId, "profile_created", id, { provider: input.provider })
      ]);
      return this.summary(row);
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("An AI profile with this name already exists"); throw error; }
  }
  async update(id: string, input: UpdateAiProfileDto, actorId: string) {
    const current = await this.requireProfile(id);
    const baseUrl = input.baseUrl ? await this.normalizeUrl(current.provider, input.baseUrl) : current.base_url;
    const encrypted = input.apiKey ? this.crypto.encrypt(input.apiKey, `ai:${id}:api-key`, "AI") : null;
    const pricing = this.pricing(input, current);
    const connectionChanged = Boolean(encrypted) || (input.modelId !== undefined && input.modelId.trim() !== current.model_id) || baseUrl !== current.base_url;
    try {
      const [row] = await this.prisma.$transaction([
        this.prisma.ai_model_profiles.update({ where: { id }, data: { ...(input.name ? { name: input.name.trim() } : {}), ...(input.modelId ? { model_id: input.modelId.trim() } : {}), base_url: baseUrl, ...(encrypted ? { encrypted_api_key: encrypted.ciphertext, encryption_key_id: encrypted.keyId, api_key_hint: input.apiKey!.slice(-4) } : {}), ...pricing, ...(connectionChanged ? { status: "inactive" as const, last_error_code: null } : {}) }, select: profileSelect }),
        ...(connectionChanged ? [this.prisma.ai_capability_bindings.deleteMany({ where: { profile_id: id } })] : []),
        this.audit(actorId, "profile_updated", id, { apiKeyRotated: Boolean(input.apiKey), connectionChanged })
      ]);
      return this.summary(row);
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("An AI profile with this name already exists"); throw error; }
  }
  async remove(id: string, actorId: string) {
    const profile = await this.requireProfile(id);
    try {
      await this.prisma.$transaction(async (transaction) => {
        if (await transaction.ai_runs.count({ where: { profile_id: id } })) throw new ConflictException("AI model profile is used by conversation history and cannot be deleted");
        await transaction.ai_capability_bindings.deleteMany({ where: { profile_id: id } });
        await transaction.ai_audit_events.create({ data: { actor_user_id: actorId, profile_id: id, event_type: "profile_deleted", metadata: { profileId: id, name: profile.name, provider: profile.provider }, expires_at: new Date(Date.now() + 365 * 86_400_000) } });
        await transaction.ai_model_profiles.delete({ where: { id } });
      });
      return { deleted: true };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") throw new ConflictException("AI model profile is used by conversation history and cannot be deleted");
      throw error;
    }
  }
  async test(id: string, actorId: string) {
    const profile = await this.requireProfile(id);
    try { await this.models.complete(profile, "Reply with OK only.", "Connection test"); await this.prisma.ai_model_profiles.update({ where: { id }, data: { status: "active", last_tested_at: new Date(), last_error_code: null } }); await this.audit(actorId, "profile_test_succeeded", id, {}); return { ok: true }; }
    catch (error) {
      const providerError = extractAiProviderError(error, profile.provider);
      await this.prisma.ai_model_profiles.update({ where: { id }, data: { status: "error", last_tested_at: new Date(), last_error_code: "PROVIDER_TEST_FAILED" } });
      await this.audit(actorId, "profile_test_failed", id, { provider: providerError.provider, statusCode: providerError.statusCode, code: providerError.code, type: providerError.type });
      throw new PublicHttpException(HttpStatus.BAD_GATEWAY, "AI provider connection test failed", { providerError });
    }
  }
  async deactivate(id: string, actorId: string) { await this.requireProfile(id); await this.prisma.$transaction([this.prisma.ai_capability_bindings.deleteMany({ where: { profile_id: id } }), this.prisma.ai_model_profiles.update({ where: { id }, data: { status: "inactive" } })]); await this.audit(actorId, "profile_deactivated", id, {}); return { deactivated: true }; }
  async binding(key: string) { await this.requireCapability(key); const binding = await this.prisma.ai_capability_bindings.findUnique({ where: { capability_key: key }, include: { profile: { select: profileSelect } } }); return binding ? { capability: key, profile: this.summary(binding.profile) } : { capability: key, profile: null }; }
  async bind(key: string, input: BindAiCapabilityDto, actorId: string) { await this.requireCapability(key); const profile = await this.requireProfile(input.profileId); if (profile.status !== "active") throw new ConflictException("Test and activate the model profile before assigning it"); await this.prisma.ai_capability_bindings.upsert({ where: { capability_key: key }, create: { capability_key: key, profile_id: profile.id, updated_by_id: actorId }, update: { profile_id: profile.id, updated_by_id: actorId } }); await this.audit(actorId, "capability_bound", profile.id, { capability: key }); return this.binding(key); }
  async activeFor(key: string) { const binding = await this.prisma.ai_capability_bindings.findUnique({ where: { capability_key: key }, include: { profile: true } }); if (!binding || binding.profile.status !== "active") throw new ConflictException("No active model is configured for this AI capability"); return binding.profile; }
  async activeById(id: string) { const profile = await this.requireProfile(id); if (profile.status !== "active") throw new ConflictException("Test and activate the selected model profile before using it"); return profile; }
  private async requireProfile(id: string) { const profile = await this.prisma.ai_model_profiles.findUnique({ where: { id } }); if (!profile) throw new NotFoundException("AI model profile was not found"); return profile; }
  private async requireCapability(key: string) { if (!/^[a-z][a-z0-9_]{2,63}$/.test(key)) throw new NotFoundException("AI capability was not found"); const capability = await this.prisma.ai_capabilities.findUnique({ where: { key }, select: { key: true } }); if (!capability) throw new NotFoundException("AI capability was not found"); }
  private async normalizeUrl(provider: "openai" | "anthropic", raw?: string) { const fallback = provider === "openai" ? "https://api.openai.com/v1" : "https://api.anthropic.com"; return (await this.urls.validate(raw ?? fallback)).url.toString(); }
  private pricing(input: Pick<CreateAiProfileDto, "inputPricePerMillionUsd" | "outputPricePerMillionUsd">, current?: { input_price_per_million_usd: Prisma.Decimal | null; output_price_per_million_usd: Prisma.Decimal | null }) {
    const inputRate = input.inputPricePerMillionUsd === undefined ? current?.input_price_per_million_usd ?? null : input.inputPricePerMillionUsd === null ? null : new Prisma.Decimal(input.inputPricePerMillionUsd);
    const outputRate = input.outputPricePerMillionUsd === undefined ? current?.output_price_per_million_usd ?? null : input.outputPricePerMillionUsd === null ? null : new Prisma.Decimal(input.outputPricePerMillionUsd);
    if ((inputRate === null) !== (outputRate === null)) throw new BadRequestException("Input and output token prices must be configured together");
    return { input_price_per_million_usd: inputRate, output_price_per_million_usd: outputRate };
  }
  private summary = (row: { id: string; name: string; provider: string; model_id: string; base_url: string; api_key_hint: string; input_price_per_million_usd: Prisma.Decimal | null; output_price_per_million_usd: Prisma.Decimal | null; status: string; last_tested_at: Date | null; last_error_code: string | null; created_at: Date; updated_at: Date }) => ({ id: row.id, name: row.name, provider: row.provider, modelId: row.model_id, baseUrl: row.base_url, apiKeyConfigured: true, apiKeyHint: row.api_key_hint, inputPricePerMillionUsd: row.input_price_per_million_usd?.toString() ?? null, outputPricePerMillionUsd: row.output_price_per_million_usd?.toString() ?? null, status: row.status, lastTestedAt: row.last_tested_at?.toISOString() ?? null, lastErrorCode: row.last_error_code, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() });
  private audit(actorId: string, eventType: string, profileId: string, metadata: Prisma.InputJsonValue) { return this.prisma.ai_audit_events.create({ data: { actor_user_id: actorId, profile_id: profileId, event_type: eventType, metadata, expires_at: new Date(Date.now() + 365 * 86_400_000) } }); }
}
