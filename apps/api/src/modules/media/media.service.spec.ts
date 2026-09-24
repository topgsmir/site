import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { PrismaService } from "../../prisma/prisma.service";
import type { BlogActor } from "../blog/blog-manage.guard";
import { MediaService, normalizeOriginalFilename } from "./media.service";

const actor: BlogActor = {
  type: "seller",
  sellerId: "00000000-0000-4000-8000-000000000001",
  reviewRequired: true,
  user: {
    id: "00000000-0000-4000-8000-000000000002",
    fullName: "Seller",
    email: "seller@example.com",
    role: "seller-admin"
  }
};

describe("media boundary", () => {
  it("normalizes original filenames to a safe bounded basename", () => {
    assert.equal(normalizeOriginalFilename("..\\folder\\\u0000 photo.webp"), "photo.webp");
    assert.equal(normalizeOriginalFilename("safe\u202Egnp.exe.webp"), "safegnp.exe.webp");
    assert.equal(Array.from(normalizeOriginalFilename(`${"a".repeat(300)}.webp`) ?? "").length, 255);
    assert.equal(normalizeOriginalFilename("\u0000\u001f"), null);
  });

  it("rejects files that claim to be WebP but cannot be decoded", async () => {
    const service = new MediaService(
      new ConfigService({ MEDIA_ROOT: "var/test-media" }),
      {} as PrismaService
    );
    await assert.rejects(
      service.upload(actor, {
        buffer: Buffer.from("RIFF-not-a-webp"),
        mimetype: "image/webp",
        originalname: "spoof.webp"
      } as Express.Multer.File, { kind: "cover", focalX: 0.5, focalY: 0.5 }),
      BadRequestException
    );
  });

  it("rejects uploads over eight MiB before attempting a decode", async () => {
    const service = new MediaService(new ConfigService({ MEDIA_ROOT: "var/test-media" }), {} as PrismaService);
    await assert.rejects(
      service.upload(actor, {
        buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
        mimetype: "image/webp",
        originalname: "too-large.webp"
      } as Express.Multer.File, { kind: "cover", focalX: 0.5, focalY: 0.5 }),
      BadRequestException
    );
  });

  it("rejects decoded WebP dimensions beyond the bounded limit", async () => {
    const image = await sharp({ create: { width: 8193, height: 1, channels: 4, background: "#000" } })
      .webp()
      .toBuffer();
    const service = new MediaService(new ConfigService({ MEDIA_ROOT: "var/test-media" }), {} as PrismaService);
    await assert.rejects(
      service.upload(actor, {
        buffer: image,
        mimetype: "image/webp",
        originalname: "too-wide.webp"
      } as Express.Multer.File, { kind: "cover", focalX: 0.5, focalY: 0.5 }),
      BadRequestException
    );
  });

  it("removes generated files when the database write fails", async () => {
    const base = join(process.cwd(), "var");
    await mkdir(base, { recursive: true });
    const root = await mkdtemp(join(base, "media-failure-"));
    const image = await sharp({ create: { width: 32, height: 24, channels: 4, background: "#2457ff" } })
      .webp()
      .toBuffer();
    const prisma = {
      blog_media_assets: { create: async () => { throw new Error("database unavailable"); } }
    } as unknown as PrismaService;
    const service = new MediaService(new ConfigService({ MEDIA_ROOT: root }), prisma);
    try {
      await assert.rejects(
        service.upload(actor, {
          buffer: image,
          mimetype: "image/webp",
          originalname: "valid.webp"
        } as Express.Multer.File, { kind: "inline", focalX: 0.5, focalY: 0.5 }),
        /database unavailable/
      );
      const remaining = await readdir(root, { recursive: true });
      assert.equal(remaining.some((name) => name.endsWith(".webp") || name.endsWith(".tmp")), false);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rejects traversal paths even when a database row is compromised", async () => {
    const prisma = {
      blog_media_assets: {
        findUnique: async () => ({
          id: "00000000-0000-4000-8000-000000000003",
          owner_user_id: actor.user.id,
          published_at: new Date(),
          checksum: "a".repeat(64),
          variants: [{ path: "../../outside.webp" }]
        })
      }
    } as unknown as PrismaService;
    const service = new MediaService(new ConfigService({ MEDIA_ROOT: "var/test-media" }), prisma);
    await assert.rejects(service.get("asset", "wide", actor.user), BadRequestException);
  });

  it("does not expose unpublished assets to unauthenticated readers", async () => {
    const prisma = {
      blog_media_assets: {
        findUnique: async () => ({
          id: "00000000-0000-4000-8000-000000000003",
          owner_user_id: actor.user.id,
          published_at: null,
          checksum: "a".repeat(64),
          variants: [{ path: "safe/wide.webp" }]
        })
      }
    } as unknown as PrismaService;
    const service = new MediaService(new ConfigService({ MEDIA_ROOT: "var/test-media" }), prisma);
    await assert.rejects(service.get("asset", "wide"), ForbiddenException);
  });

  it("rejects SVG uploads before passing XML to the image decoder", async () => {
    const service = new MediaService(new ConfigService({ MEDIA_ROOT: "var/test-media" }), {} as PrismaService);
    await assert.rejects(
      service.upload(actor, {
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><image href="file:///etc/passwd" /></svg>'),
        mimetype: "image/svg+xml",
        originalname: "unsafe.svg"
      } as Express.Multer.File, { kind: "inline", focalX: 0.5, focalY: 0.5 }),
      BadRequestException
    );
  });

  it("rejects invalid product image bytes before writing files", async () => {
    const prisma = {
      products: { findFirst: async () => ({ id: "product" }) }
    } as unknown as PrismaService;
    const service = new MediaService(new ConfigService({ MEDIA_ROOT: "var/test-media" }), prisma);
    await assert.rejects(
      service.uploadProductImage("product", actor.user.id, actor.sellerId, {
        buffer: Buffer.from("not-an-image"),
        mimetype: "image/png",
        originalname: "spoof.png"
      } as Express.Multer.File),
      BadRequestException
    );
  });

  it("hides another seller's product during image replacement", async () => {
    const prisma = {
      products: { findFirst: async () => null }
    } as unknown as PrismaService;
    const service = new MediaService(new ConfigService({ MEDIA_ROOT: "var/test-media" }), prisma);
    await assert.rejects(
      service.uploadProductImage("other-product", actor.user.id, actor.sellerId, undefined),
      NotFoundException
    );
  });

  it("rejects decoded PNG product uploads even when their MIME type is spoofed", async () => {
    const image = await sharp({ create: { width: 32, height: 24, channels: 4, background: "#2457ff" } })
      .png()
      .toBuffer();
    const prisma = {
      products: { findFirst: async () => ({ id: "product" }) }
    } as unknown as PrismaService;
    const service = new MediaService(new ConfigService({ MEDIA_ROOT: "var/test-media" }), prisma);
    await assert.rejects(
      service.uploadProductImage("product", actor.user.id, actor.sellerId, {
        buffer: image,
        mimetype: "image/webp",
        originalname: "spoof.webp"
      } as Express.Multer.File),
      BadRequestException
    );
  });

  it("rejects seller staff profile-picture uploads before decoding the file", async () => {
    const service = new MediaService(new ConfigService({ MEDIA_ROOT: "var/test-media" }), {} as PrismaService);
    await assert.rejects(
      service.uploadSellerProfilePicture(actor.sellerId, actor.user.id, "staff", undefined),
      ForbiddenException
    );
  });

  it("stores seller profile pictures below the authenticated seller path", async () => {
    const base = join(process.cwd(), "var");
    await mkdir(base, { recursive: true });
    const root = await mkdtemp(join(base, "seller-profile-media-"));
    const image = await sharp({ create: { width: 80, height: 60, channels: 4, background: "#2457ff" } })
      .png()
      .toBuffer();
    let created: Record<string, unknown> | undefined;
    const tx = {
      $queryRaw: async () => [],
      sellers: { findFirst: async () => ({ id: actor.sellerId }) },
      seller_profile_media_assets: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => { created = data; }
      }
    };
    const prisma = {
      sellers: { findFirst: async () => ({ id: actor.sellerId }) },
      $transaction: async (callback: (client: typeof tx) => Promise<void>) => callback(tx)
    } as unknown as PrismaService;
    const service = new MediaService(new ConfigService({ MEDIA_ROOT: root }), prisma);
    try {
      const result = await service.uploadSellerProfilePicture(actor.sellerId, actor.user.id, "admin", {
        buffer: image,
        mimetype: "image/png",
        originalname: "portrait.png"
      } as Express.Multer.File);
      assert.match(String(created?.path), new RegExp(`^sellers/${actor.sellerId}/profile/[0-9a-f-]+\\.webp$`));
      assert.equal(created?.seller_id, actor.sellerId);
      assert.equal(result.url, `/media/${result.id}/profile.webp`);
      assert.equal(result.width, 640);
      assert.equal(result.height, 640);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
