import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { MediaService } from "./media.service";
import { AdminUploadsService, decodeUploadCursor, encodeUploadCursor } from "./admin-uploads.service";

describe("admin uploads cursors", () => {
  const cursor = {
    v: 1 as const,
    sort: "newest" as const,
    value: "2026-09-22T08:00:00.000Z",
    id: "00000000-0000-4000-8000-000000000001",
    source: "blog" as const
  };

  it("round-trips a deterministic cross-source cursor", () => {
    assert.deepEqual(decodeUploadCursor(encodeUploadCursor(cursor), "newest"), cursor);
  });

  it("rejects malformed and sort-mismatched cursors", () => {
    assert.throws(() => decodeUploadCursor("not-a-cursor", "newest"), BadRequestException);
    assert.throws(() => decodeUploadCursor(encodeUploadCursor(cursor), "size"), BadRequestException);
  });
});

describe("admin uploads lifecycle", () => {
  it("protects blog media referenced by any revision", async () => {
    const tx = {
      $queryRaw: async () => [],
      blog_media_assets: { findUnique: async () => ({ trashed_at: null, revision_references: [{ revision_id: "revision-1" }] }) }
    };
    const prisma = { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) } as unknown as PrismaService;
    const service = new AdminUploadsService(prisma, {} as MediaService);
    const result = await service.trash([{ source: "blog", id: "00000000-0000-4000-8000-000000000011" }], "No longer needed", "00000000-0000-4000-8000-000000000012");
    assert.equal(result.results[0]?.status, 409);
    assert.match(result.results[0]?.message ?? "", /referenced/i);
  });

  it("detaches a product image into recoverable trash and audits the reason", async () => {
    const updates: unknown[] = []; const events: unknown[] = [];
    const tx = {
      $queryRaw: async () => [],
      product_media_assets: {
        findUnique: async () => ({ trashed_at: null, product_id: "00000000-0000-4000-8000-000000000010" }),
        update: async (args: unknown) => { updates.push(args); }
      },
      media_admin_events: { create: async (args: unknown) => { events.push(args); } }
    };
    const prisma = { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) } as unknown as PrismaService;
    const service = new AdminUploadsService(prisma, {} as MediaService);
    const result = await service.trash([{ source: "product", id: "00000000-0000-4000-8000-000000000011" }], "Duplicate image", "00000000-0000-4000-8000-000000000012");
    assert.equal(result.results[0]?.ok, true);
    assert.equal((updates[0] as any).data.product_id, null);
    assert.equal((updates[0] as any).data.restore_product_id, "00000000-0000-4000-8000-000000000010");
    assert.equal((events[0] as any).data.reason, "Duplicate image");
  });

  it("returns a per-item conflict when the original product has a replacement", async () => {
    const tx = {
      $queryRaw: async () => [],
      product_media_assets: { findUnique: async () => ({ trashed_at: new Date(), purging_at: null, restore_product_id: "00000000-0000-4000-8000-000000000010" }) },
      products: { findUnique: async () => ({ id: "00000000-0000-4000-8000-000000000010", media: { id: "00000000-0000-4000-8000-000000000099" } }) }
    };
    const prisma = { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) } as unknown as PrismaService;
    const service = new AdminUploadsService(prisma, {} as MediaService);
    const result = await service.restore([{ source: "product", id: "00000000-0000-4000-8000-000000000011" }], "00000000-0000-4000-8000-000000000012");
    assert.equal(result.results[0]?.status, 409);
    assert.match(result.results[0]?.message ?? "", /replacement/i);
  });

  it("reports bulk successes and failures independently", async () => {
    const foundId = "00000000-0000-4000-8000-000000000011";
    const tx = {
      $queryRaw: async () => [],
      blog_media_assets: {
        findUnique: async ({ where }: { where: { id: string } }) => where.id === foundId ? { trashed_at: null, revision_references: [] } : null,
        update: async () => undefined
      },
      media_admin_events: { create: async () => undefined }
    };
    const prisma = { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) } as unknown as PrismaService;
    const service = new AdminUploadsService(prisma, {} as MediaService);
    const result = await service.trash([
      { source: "blog", id: foundId },
      { source: "blog", id: "00000000-0000-4000-8000-000000000099" }
    ], "Clean up duplicate", "00000000-0000-4000-8000-000000000012");
    assert.deepEqual(result.results.map(({ ok, status }) => ({ ok, status })), [{ ok: true, status: 200 }, { ok: false, status: 404 }]);
  });

  it("releases a purge claim and records a safe failure for retry", async () => {
    const updates: unknown[] = []; const events: unknown[] = []; let removalAttempted = false; let assetRead = false;
    const productModel = {
      findMany: async () => [{ id: "00000000-0000-4000-8000-000000000011" }],
      updateMany: async (args: unknown) => { updates.push(args); return { count: 1 }; },
      findUnique: async () => { assetRead = true; return { variants: [{ path: "products/00/file.webp" }] }; }
    };
    const prisma = {
      blog_media_assets: { findMany: async () => [] },
      product_media_assets: productModel,
      media_admin_events: { create: async (args: unknown) => { events.push(args); } },
      $transaction: async (work: (client: { $queryRaw: () => Promise<unknown[]> }) => unknown) => work({ $queryRaw: async () => [] })
    } as unknown as PrismaService;
    const media = { removeStoredFiles: async () => { removalAttempted = true; const error = new Error("private absolute path"); (error as NodeJS.ErrnoException).code = "EACCES"; throw error; } } as unknown as MediaService;
    const service = new AdminUploadsService(prisma, media);
    assert.equal(await service.purgeExpired(), 1);
    assert.equal((updates[1] as any).data.purging_at, null);
    assert.equal(assetRead, true);
    assert.equal(removalAttempted, true);
    assert.equal((events[0] as any).data.reason, "Filesystem removal failed");
    assert.equal(typeof (events[0] as any).data.metadata.errorCode, "string");
    assert.doesNotMatch(JSON.stringify((events[0] as any).data), /private absolute path/);
  });
});
