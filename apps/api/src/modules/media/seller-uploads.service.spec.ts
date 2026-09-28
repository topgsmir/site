import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { MediaService } from "./media.service";
import { AdminUploadsService } from "./admin-uploads.service";

const assetId = "00000000-0000-4000-8000-000000000011";
const sellerId = "00000000-0000-4000-8000-000000000012";
const actorId = "00000000-0000-4000-8000-000000000013";

describe("seller upload deletion approval", () => {
  it("revokes private blog preview access when the uploader leaves the seller", async () => {
    const prisma = {
      blog_media_assets: { findUnique: async () => ({ id: assetId, owner_user_id: actorId, seller_id: sellerId, published_at: null, trashed_at: null, checksum: "a".repeat(64), variants: [{ path: "blog/test.webp" }] }) },
      seller_memberships: { findFirst: async () => null }
    } as unknown as PrismaService;
    const media = new MediaService(new ConfigService({ MEDIA_ROOT: "var/test-media" }), prisma);
    await assert.rejects(media.get(assetId, "sm", { id: actorId, role: "seller-staff" } as any), { status: 403 });
  });

  it("rejects whitespace-only reasons before touching the database", async () => {
    const service = new AdminUploadsService({} as PrismaService, {} as MediaService);
    await assert.rejects(service.requestDeletion({ source: "blog", id: assetId }, sellerId, actorId, "   "), { status: 400 });
    await assert.rejects(service.rejectDeletion(assetId, actorId, "   "), { status: 400 });
  });

  it("applies seller predicates to both sources before paging", async () => {
    const prisma = {
      $queryRaw: async (sql: { values: unknown[] }) => {
        assert.deepEqual(sql.values.filter((value) => value === sellerId), [sellerId, sellerId]);
        return [];
      }
    } as unknown as PrismaService;
    const service = new AdminUploadsService(prisma, {} as MediaService);
    const page = await service.listSeller({ limit: 25, source: "all", state: "all", linked: "all", sort: "newest" }, sellerId);
    assert.deepEqual(page.items, []);
  });

  it("hides another seller's asset and does not create a request", async () => {
    let created = false;
    const tx = {
      $queryRaw: async () => [],
      blog_media_assets: { findFirst: async () => null },
      media_deletion_requests: { create: async () => { created = true; } }
    };
    const prisma = { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) } as unknown as PrismaService;
    const service = new AdminUploadsService(prisma, {} as MediaService);
    await assert.rejects(service.requestDeletion({ source: "blog", id: assetId }, sellerId, actorId, "No longer used"), { status: 404 });
    assert.equal(created, false);
  });

  it("reuses an existing pending request without another write", async () => {
    let created = false;
    const tx = {
      $queryRaw: async () => [],
      product_media_assets: { findFirst: async () => ({ id: assetId }) },
      media_deletion_requests: {
        findFirst: async () => ({ id: "00000000-0000-4000-8000-000000000099" }),
        create: async () => { created = true; }
      }
    };
    const prisma = { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) } as unknown as PrismaService;
    const service = new AdminUploadsService(prisma, {} as MediaService);
    const result = await service.requestDeletion({ source: "product", id: assetId }, sellerId, actorId, "Remove duplicate image");
    assert.equal(result.status, "pending");
    assert.equal(created, false);
  });

  it("refuses approval when the asset no longer belongs to the requesting seller", async () => {
    let trashed = false; let reviewed = false;
    const tx = {
      $queryRaw: async () => [],
      media_deletion_requests: {
        findUnique: async () => ({ id: assetId, source: "blog", asset_id: assetId, seller_id: sellerId, reason: "Remove", status: "pending" }),
        update: async () => { reviewed = true; }
      },
      blog_media_assets: {
        findUnique: async () => ({ seller_id: "other-seller", trashed_at: null, revision_references: [] }),
        update: async () => { trashed = true; }
      }
    };
    const prisma = { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) } as unknown as PrismaService;
    const service = new AdminUploadsService(prisma, {} as MediaService);
    await assert.rejects(service.approveDeletion(assetId, actorId), { status: 409 });
    assert.equal(trashed, false);
    assert.equal(reviewed, false);
  });

  it("trashes and records approval in one transaction", async () => {
    const steps: string[] = [];
    const tx = {
      $queryRaw: async () => [],
      media_deletion_requests: {
        findUnique: async () => ({ id: assetId, source: "product", asset_id: assetId, seller_id: sellerId, reason: "Old image", status: "pending" }),
        update: async () => { steps.push("review"); }
      },
      product_media_assets: {
        findUnique: async () => ({ trashed_at: null, product_id: assetId, product: { created_by_seller_id: sellerId } }),
        update: async () => { steps.push("trash"); }
      },
      media_admin_events: { create: async () => { steps.push("audit"); } }
    };
    const prisma = { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) } as unknown as PrismaService;
    const service = new AdminUploadsService(prisma, {} as MediaService);
    const result = await service.approveDeletion(assetId, actorId);
    assert.equal(result.status, "approved");
    assert.deepEqual(steps, ["trash", "audit", "review"]);
  });
});
