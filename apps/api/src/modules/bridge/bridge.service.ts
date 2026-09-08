import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { BridgeCredentials } from "./bridge.types";
import { BridgeProviderService } from "./bridge-provider.service";
import { CredentialCryptoService } from "./credential-crypto.service";
import { PublicUrlService } from "./public-url.service";
import type { CreateBridgeConnectionDto, RotateBridgeConnectionDto } from "./dto/bridge.dto";

const connectionSelect = Prisma.validator<Prisma.bridge_connectionsSelect>()({
  id: true, name: true, provider: true, base_url: true, status: true,
  encrypted_username: true, last_tested_at: true, last_synced_at: true,
  last_error_code: true, created_at: true, updated_at: true
});

@Injectable()
export class BridgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly publicUrls: PublicUrlService,
    private readonly providers: BridgeProviderService
  ) {}

  async listConnections(sellerId: string) {
    const rows = await this.prisma.bridge_connections.findMany({
      where: { seller_id: sellerId }, orderBy: [{ updated_at: "desc" }, { id: "desc" }], select: connectionSelect
    });
    return rows.map((row) => this.connectionSummary(row));
  }

  async createConnection(sellerId: string, membershipRole: "admin" | "staff", input: CreateBridgeConnectionDto) {
    this.requireSellerAdmin(membershipRole);
    const { url } = await this.publicUrls.validate(input.baseUrl);
    const id = randomUUID();
    const username = this.crypto.encrypt(input.username.trim(), `bridge:${id}:username`);
    const apiKey = this.crypto.encrypt(input.apiKey, `bridge:${id}:api-key`);
    const row = await this.prisma.bridge_connections.create({
      data: {
        id, seller_id: sellerId, name: input.name.trim(), provider: input.provider,
        base_url: url.toString(), encrypted_username: username.ciphertext,
        encrypted_api_key: apiKey.ciphertext, encryption_key_id: username.keyId
      },
      select: connectionSelect
    });
    return this.connectionSummary(row);
  }

  async rotateConnection(sellerId: string, membershipRole: "admin" | "staff", connectionId: string, input: RotateBridgeConnectionDto) {
    this.requireSellerAdmin(membershipRole);
    const current = await this.ownedConnection(sellerId, connectionId);
    const url = input.baseUrl ? (await this.publicUrls.validate(input.baseUrl)).url.toString() : current.base_url;
    const currentCredentials = this.credentials(current);
    const username = this.crypto.encrypt(
      input.username?.trim() ?? currentCredentials.username,
      `bridge:${current.id}:username`
    );
    const apiKey = this.crypto.encrypt(
      input.apiKey ?? currentCredentials.apiKey,
      `bridge:${current.id}:api-key`
    );
    const row = await this.prisma.bridge_connections.update({
      where: { id: current.id },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}), base_url: url,
        encrypted_username: username.ciphertext,
        encrypted_api_key: apiKey.ciphertext,
        encryption_key_id: username.keyId,
        status: "inactive",
        last_error_code: null
      },
      select: connectionSelect
    });
    return this.connectionSummary(row);
  }

  async testConnection(sellerId: string, membershipRole: "admin" | "staff", connectionId: string) {
    this.requireSellerAdmin(membershipRole);
    const connection = await this.ownedConnection(sellerId, connectionId);
    try {
      await this.providers.get(connection.provider).testConnection(this.credentials(connection));
      await this.prisma.bridge_connections.update({
        where: { id: connection.id }, data: { status: "active", last_tested_at: new Date(), last_error_code: null }
      });
      return { ok: true };
    } catch (error) {
      await this.prisma.bridge_connections.update({
        where: { id: connection.id }, data: { status: "error", last_tested_at: new Date(), last_error_code: this.errorCode(error) }
      });
      throw error;
    }
  }

  async synchronize(sellerId: string, membershipRole: "admin" | "staff", connectionId: string) {
    this.requireSellerAdmin(membershipRole);
    const connection = await this.ownedConnection(sellerId, connectionId);
    const services = await this.providers.get(connection.provider).listServices(this.credentials(connection));
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.bridge_services.updateMany({ where: { connection_id: connection.id }, data: { available: false } });
      for (const item of services) {
        const schema = this.canonicalize(item.fields);
        const schemaHash = createHash("sha256").update(schema).digest("hex");
        const existing = await transaction.bridge_services.findUnique({
          where: { connection_id_external_service_id: { connection_id: connection.id, external_service_id: item.externalId } },
          select: { id: true, schema_hash: true }
        });
        const service = existing
          ? await transaction.bridge_services.update({
              where: { id: existing.id },
              data: { name: item.name, group_name: item.groupName, kind: item.kind, field_schema: item.fields as unknown as Prisma.InputJsonValue, schema_hash: schemaHash, available: true, provider_metadata: item.metadata as Prisma.InputJsonValue, last_synced_at: now },
              select: { id: true }
            })
          : await transaction.bridge_services.create({
              data: { connection_id: connection.id, external_service_id: item.externalId, name: item.name, group_name: item.groupName, kind: item.kind, field_schema: item.fields as unknown as Prisma.InputJsonValue, schema_hash: schemaHash, provider_metadata: item.metadata as Prisma.InputJsonValue, last_synced_at: now },
              select: { id: true }
            });
        if (existing && existing.schema_hash !== schemaHash) {
          await transaction.bridge_product_bindings.updateMany({ where: { mode: "automatic", grant: { service_id: service.id } }, data: { schema_review_needed: true } });
        }
      }
      await transaction.bridge_connections.update({ where: { id: connection.id }, data: { status: "active", last_synced_at: now, last_error_code: null } });
    });
    return { synchronized: services.length, synchronizedAt: now.toISOString() };
  }

  async deactivate(sellerId: string, membershipRole: "admin" | "staff", connectionId: string) {
    this.requireSellerAdmin(membershipRole);
    const connection = await this.ownedConnection(sellerId, connectionId);
    await this.prisma.$transaction([
      this.prisma.bridge_connections.update({ where: { id: connection.id }, data: { status: "inactive" } }),
      this.prisma.bridge_services.updateMany({ where: { connection_id: connection.id }, data: { available: false } })
    ]);
    return { deactivated: true };
  }

  async listServices(sellerId: string) {
    const rows = await this.prisma.bridge_services.findMany({
      where: { connection: { seller_id: sellerId } },
      include: { grant: { select: { id: true, status: true } } },
      orderBy: [{ group_name: "asc" }, { name: "asc" }, { id: "asc" }]
    });
    return rows.map((row) => ({
      id: row.id, connectionId: row.connection_id, externalServiceId: row.external_service_id,
      name: row.name, groupName: row.group_name, kind: row.kind, available: row.available,
      fields: row.field_schema, schemaHash: row.schema_hash, grant: row.grant
    }));
  }

  async listGrants(sellerId: string) {
    const rows = await this.prisma.bridge_service_grants.findMany({
      where: { seller_id: sellerId },
      include: { service: true, _count: { select: { bindings: true } } },
      orderBy: [{ granted_at: "desc" }, { id: "desc" }]
    });
    return rows.map((row) => ({
      id: row.id, status: row.status, service: {
        id: row.service.id, connectionId: row.service.connection_id,
        externalServiceId: row.service.external_service_id, name: row.service.name,
        groupName: row.service.group_name, kind: row.service.kind, available: row.service.available,
        fields: row.service.field_schema, schemaHash: row.service.schema_hash
      }, linkedProductCount: row._count.bindings,
      grantedAt: row.granted_at.toISOString(), revokedAt: row.revoked_at?.toISOString() ?? null
    }));
  }

  async listAdmin() {
    const rows = await this.prisma.bridge_connections.findMany({
      include: { seller: { select: { id: true, shop_name: true } }, _count: { select: { services: true } } },
      orderBy: [{ updated_at: "desc" }, { id: "desc" }]
    });
    return rows.map((row) => ({ ...this.connectionSummary(row), seller: { id: row.seller.id, shopName: row.seller.shop_name }, serviceCount: row._count.services }));
  }

  async listAdminServices() {
    const rows = await this.prisma.bridge_services.findMany({
      include: {
        connection: { select: { id: true, name: true, provider: true, status: true, seller: { select: { id: true, shop_name: true } } } },
        grant: { select: { id: true, status: true, revoked_at: true, _count: { select: { bindings: true } } } }
      },
      orderBy: [{ updated_at: "desc" }, { id: "desc" }]
    });
    return rows.map((row) => ({
      id: row.id,
      externalServiceId: row.external_service_id,
      name: row.name,
      groupName: row.group_name,
      kind: row.kind,
      fields: row.field_schema,
      schemaHash: row.schema_hash,
      available: row.available,
      connection: {
        id: row.connection.id,
        name: row.connection.name,
        provider: row.connection.provider,
        status: row.connection.status
      },
      seller: {
        id: row.connection.seller.id,
        shopName: row.connection.seller.shop_name
      },
      grant: row.grant
        ? {
            id: row.grant.id,
            status: row.grant.status,
            linkedProductCount: row.grant._count.bindings,
            revokedAt: row.grant.revoked_at?.toISOString() ?? null
          }
        : null
    }));
  }

  async acceptProductSchema(sellerId: string, productId: string) {
    const binding = await this.prisma.bridge_product_bindings.findFirst({
      where: { product_id: productId, product: { created_by_seller_id: sellerId } },
      select: {
        product_id: true,
        grant: {
          select: {
            status: true,
            service: { select: { available: true, schema_hash: true, connection: { select: { status: true } } } }
          }
        }
      }
    });
    if (!binding) throw new NotFoundException("Bridge product binding was not found");
    if (binding.grant.status !== "active" || !binding.grant.service.available || binding.grant.service.connection.status !== "active") {
      throw new ConflictException("Bridge service is not currently available");
    }
    await this.prisma.bridge_product_bindings.update({
      where: { product_id: binding.product_id },
      data: {
        accepted_schema_hash: binding.grant.service.schema_hash,
        schema_review_needed: false
      }
    });
    return { acceptedSchemaHash: binding.grant.service.schema_hash };
  }

  async activateGrant(serviceId: string, adminUserId: string) {
    const service = await this.prisma.bridge_services.findUnique({
      where: { id: serviceId }, include: { connection: { select: { seller_id: true, status: true } } }
    });
    if (!service) throw new NotFoundException("Bridge service was not found");
    if (!service.available || service.connection.status !== "active") throw new BadRequestException("Bridge service is not available");
    return this.prisma.bridge_service_grants.upsert({
      where: { service_id: service.id },
      create: { seller_id: service.connection.seller_id, service_id: service.id, granted_by_id: adminUserId },
      update: { status: "active", granted_by_id: adminUserId, granted_at: new Date(), revoked_at: null }
    });
  }

  async revokeGrant(grantId: string, productAction: "archive" | "manual") {
    const grant = await this.prisma.bridge_service_grants.findUnique({ where: { id: grantId }, select: { id: true } });
    if (!grant) throw new NotFoundException("Bridge grant was not found");
    await this.prisma.$transaction(async (transaction) => {
      await transaction.bridge_service_grants.update({ where: { id: grant.id }, data: { status: "revoked", revoked_at: new Date() } });
      if (productAction === "manual") {
        await transaction.bridge_product_bindings.updateMany({ where: { grant_id: grant.id }, data: { mode: "manual" } });
      } else {
        const bindings = await transaction.bridge_product_bindings.findMany({ where: { grant_id: grant.id }, select: { product_id: true } });
        const productIds = bindings.map((item) => item.product_id);
        if (productIds.length) {
          await transaction.products.updateMany({ where: { id: { in: productIds } }, data: { status: "archived" } });
          await transaction.seller_listings.updateMany({ where: { product_id: { in: productIds } }, data: { status: "archived" } });
          await transaction.seller_offers.updateMany({ where: { listing: { product_id: { in: productIds } } }, data: { status: "archived" } });
        }
      }
    });
    return { revoked: true, productAction };
  }

  private async ownedConnection(sellerId: string, id: string) {
    const row = await this.prisma.bridge_connections.findFirst({ where: { id, seller_id: sellerId } });
    if (!row) throw new NotFoundException("Bridge connection was not found");
    return row;
  }

  private credentials(connection: { id: string; base_url: string; encrypted_username: string; encrypted_api_key: string; encryption_key_id: string }): BridgeCredentials {
    return {
      baseUrl: connection.base_url,
      username: this.crypto.decrypt(connection.encrypted_username, connection.encryption_key_id, `bridge:${connection.id}:username`),
      apiKey: this.crypto.decrypt(connection.encrypted_api_key, connection.encryption_key_id, `bridge:${connection.id}:api-key`)
    };
  }

  private connectionSummary(row: { id: string; name: string; provider: string; base_url: string; status: string; encrypted_username: string; last_tested_at: Date | null; last_synced_at: Date | null; last_error_code: string | null }) {
    return {
      id: row.id, name: row.name, provider: row.provider, baseUrl: row.base_url,
      status: row.status, usernameHint: "••••", hasApiKey: true,
      lastTestedAt: row.last_tested_at?.toISOString() ?? null,
      lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
      lastErrorCode: row.last_error_code
    };
  }

  private requireSellerAdmin(role: "admin" | "staff") {
    if (role !== "admin") throw new ForbiddenException("Only seller administrators can manage provider credentials");
  }

  private canonicalize(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.canonicalize(item)).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${this.canonicalize(item)}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  private errorCode(error: unknown) {
    const name = error instanceof Error ? error.constructor.name : "Error";
    return name.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 64).toUpperCase();
  }
}
