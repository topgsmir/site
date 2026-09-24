import { BadGatewayException, ConflictException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SellerShippingProfileService } from "./seller-shipping-profile.service";
import type { ShippingOrigin, ShippingProviderState } from "./shipping-provider";
import { ShippingProviderRegistry } from "./shipping-provider.registry";

const PROVISIONING_LEASE_MS = 5 * 60_000;

@Injectable()
export class ShippingTenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: SellerShippingProfileService,
    private readonly providers: ShippingProviderRegistry
  ) {}

  async listPlacesForConfiguredSeller(input: { sellerId: string; provinceId?: number }) {
    const origin = await this.profiles.effectiveSender(input.sellerId);
    return this.listPlacesForSeller({
      sellerId: input.sellerId,
      senderName: origin.senderName,
      senderMobile: origin.senderMobile,
      provinceId: input.provinceId
    });
  }

  async listPlacesForSeller(input: {
    sellerId: string;
    senderName: string;
    senderMobile: string;
    provinceId?: number;
  }) {
    const provider = this.providers.active();
    const credentialHash = await provider.credentialFingerprint();
    const claim = await this.claimAccount(input.sellerId, provider.code, credentialHash, provider);
    let state = this.state(claim.tenant.state);

    if (!provider.isTenantAccountReady(state)) {
      try {
        const account = await provider.ensureTenantAccount({
          sellerId: input.sellerId,
          senderName: input.senderName,
          senderMobile: input.senderMobile,
          state,
          checkpoint: async (nextState, accountReference) => {
            const changed = await this.prisma.shipping_provider_tenants.updateMany({
              where: { seller_id: input.sellerId, provider: provider.code, status: "provisioning", claim_token: claim.tenant.claim_token },
              data: {
                state: nextState as Prisma.InputJsonObject,
                account_reference: accountReference,
                last_error_code: null
              }
            });
            if (changed.count !== 1) throw new ConflictException("Shipping tenant provisioning lease was lost");
          }
        });
        state = account.state;
        const completed = await this.prisma.shipping_provider_tenants.updateMany({
          where: { seller_id: input.sellerId, provider: provider.code, status: "provisioning", claim_token: claim.tenant.claim_token },
          data: {
            status: "pending",
            claim_token: null,
            account_reference: account.accountReference,
            state: account.state as Prisma.InputJsonObject,
            last_error_code: null
          }
        });
        if (completed.count !== 1) throw new ConflictException("Shipping tenant provisioning lease was lost");
      } catch (error) {
        await this.prisma.shipping_provider_tenants.updateMany({
          where: { seller_id: input.sellerId, provider: provider.code, status: "provisioning", claim_token: claim.tenant.claim_token },
          data: { status: "failed", claim_token: null, last_error_code: this.errorCode(error) }
        });
        throw error;
      }
    }

    return provider.listPlaces({ tenantState: state, provinceId: input.provinceId });
  }

  async effectiveForSeller(sellerId: string, providerCode?: string) {
    const provider = providerCode ? this.providers.get(providerCode) : this.providers.active();
    const [credentialHash, origin] = await Promise.all([
      provider.credentialFingerprint(),
      this.profiles.effectiveSender(sellerId)
    ]);
    const profileHash = this.hash(origin);
    const claim = await this.claim(sellerId, provider.code, credentialHash, profileHash);
    const currentState = this.state(claim.tenant.state);

    if (claim.tenant.status === "ready" && provider.isTenantReady(currentState)) {
      return { provider, tenantState: currentState, origin };
    }

    try {
      const provisioned = await provider.provisionTenant({
        sellerId,
        origin,
        state: currentState,
        profileChanged: claim.profileChanged,
        checkpoint: async (state, accountReference) => {
          const changed = await this.prisma.shipping_provider_tenants.updateMany({
            where: { seller_id: sellerId, provider: provider.code, status: "provisioning", claim_token: claim.tenant.claim_token },
            data: { state: state as Prisma.InputJsonObject, account_reference: accountReference, last_error_code: null }
          });
          if (changed.count !== 1) throw new ConflictException("Shipping tenant provisioning lease was lost");
        }
      });
      if (!provider.isTenantReady(provisioned.state)) throw new BadGatewayException("The shipping provider returned incomplete tenant state");
      const completed = await this.prisma.shipping_provider_tenants.updateMany({
        where: { seller_id: sellerId, provider: provider.code, status: "provisioning", claim_token: claim.tenant.claim_token },
        data: {
          status: "ready",
          profile_hash: profileHash,
          account_reference: provisioned.accountReference,
          state: provisioned.state as Prisma.InputJsonObject,
          provisioned_at: new Date(),
          claim_token: null,
          last_error_code: null
        }
      });
      if (completed.count !== 1) throw new ConflictException("Shipping tenant provisioning lease was lost");
      return { provider, tenantState: provisioned.state, origin };
    } catch (error) {
      await this.prisma.shipping_provider_tenants.updateMany({
        where: { seller_id: sellerId, provider: provider.code, status: "provisioning", claim_token: claim.tenant.claim_token },
        data: { status: "failed", claim_token: null, last_error_code: this.errorCode(error) }
      });
      throw error;
    }
  }

  private async claim(sellerId: string, provider: string, credentialHash: string, profileHash: string) {
    return this.prisma.$transaction(async (tx) => {
      const key = { seller_id_provider: { seller_id: sellerId, provider } };
      const existing = await tx.shipping_provider_tenants.findUnique({ where: key });
      if (existing?.status === "ready" && existing.credential_hash === credentialHash && existing.profile_hash === profileHash) {
        return { tenant: existing, profileChanged: false };
      }
      if (existing?.status === "provisioning" && existing.last_attempted_at.getTime() > Date.now() - PROVISIONING_LEASE_MS) {
        throw new ConflictException(`${provider} tenant provisioning is already in progress`);
      }
      const sameCredential = existing?.credential_hash === credentialHash;
      const profileChanged = Boolean(sameCredential && existing?.profile_hash && existing.profile_hash !== profileHash);
      const claimToken = randomUUID();
      const tenant = await tx.shipping_provider_tenants.upsert({
        where: key,
        create: {
          seller_id: sellerId,
          provider,
          status: "provisioning",
          credential_hash: credentialHash,
          claim_token: claimToken,
          attempt_count: 1,
          last_attempted_at: new Date()
        },
        update: {
          status: "provisioning",
          credential_hash: credentialHash,
          claim_token: claimToken,
          profile_hash: null,
          account_reference: sameCredential ? existing?.account_reference ?? null : null,
          state: sameCredential ? existing?.state ?? {} : {},
          attempt_count: { increment: 1 },
          last_attempted_at: new Date(),
          provisioned_at: null,
          last_error_code: null
        }
      });
      return { tenant, profileChanged };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async claimAccount(
    sellerId: string,
    providerCode: string,
    credentialHash: string,
    provider: ReturnType<ShippingProviderRegistry["active"]>
  ) {
    return this.prisma.$transaction(async (tx) => {
      const key = { seller_id_provider: { seller_id: sellerId, provider: providerCode } };
      const existing = await tx.shipping_provider_tenants.findUnique({ where: key });
      const sameCredential = existing?.credential_hash === credentialHash;
      if (existing && sameCredential && provider.isTenantAccountReady(this.state(existing.state))) {
        return { tenant: existing };
      }
      if (existing?.status === "provisioning" && existing.last_attempted_at.getTime() > Date.now() - PROVISIONING_LEASE_MS) {
        throw new ConflictException(`${providerCode} tenant provisioning is already in progress`);
      }
      const claimToken = randomUUID();
      const tenant = await tx.shipping_provider_tenants.upsert({
        where: key,
        create: {
          seller_id: sellerId,
          provider: providerCode,
          status: "provisioning",
          credential_hash: credentialHash,
          claim_token: claimToken,
          attempt_count: 1,
          last_attempted_at: new Date()
        },
        update: {
          status: "provisioning",
          credential_hash: credentialHash,
          claim_token: claimToken,
          profile_hash: sameCredential ? existing?.profile_hash ?? null : null,
          account_reference: sameCredential ? existing?.account_reference ?? null : null,
          state: sameCredential ? existing?.state ?? {} : {},
          attempt_count: { increment: 1 },
          last_attempted_at: new Date(),
          provisioned_at: sameCredential ? existing?.provisioned_at ?? null : null,
          last_error_code: null
        }
      });
      return { tenant };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private state(value: Prisma.JsonValue): ShippingProviderState {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as ShippingProviderState;
  }

  private hash(value: ShippingOrigin) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private errorCode(error: unknown) {
    if (error instanceof UnprocessableEntityException) return "ADDRESS_UNSUPPORTED";
    if (error instanceof BadGatewayException) return "PROVIDER_PROVISIONING_FAILED";
    return "TENANT_PROVISIONING_FAILED";
  }
}
