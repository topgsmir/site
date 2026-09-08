import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { PrismaService } from "../../prisma/prisma.service";
import type { BlogActor } from "../blog/blog-manage.guard";
import { MediaService } from "./media.service";

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

describe("blog media boundary", () => {
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
});
