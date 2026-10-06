import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "../../prisma/client";
import sharp from "sharp";
import { HomepageStoriesService, normalizeStoryTargetUrl } from "./homepage-stories.service";

describe("homepage stories", () => {
  it("accepts only HTTP(S) and same-site relative destinations", () => {
    assert.equal(normalizeStoryTargetUrl(" /fa/products?q=screen#results "), "/fa/products?q=screen#results");
    assert.equal(normalizeStoryTargetUrl("https://example.com/path"), "https://example.com/path");
    assert.throws(() => normalizeStoryTargetUrl("javascript:alert(1)"), BadRequestException);
    assert.throws(() => normalizeStoryTargetUrl("//evil.example/path"), BadRequestException);
    assert.throws(() => normalizeStoryTargetUrl("https://user:secret@example.com/path"), BadRequestException);
  });

  it("caps and orders public reads while filtering inactive stories", async () => {
    let received: unknown;
    const prisma = {
      homepage_stories: {
        findMany: async (query: unknown) => {
          received = query;
          return [];
        }
      }
    } as unknown as PrismaService;
    const service = new HomepageStoriesService(new ConfigService({ MEDIA_ROOT: "var/test-media" }), prisma);
    assert.deepEqual(await service.listPublic({ locale: "fa" }), []);
    assert.deepEqual(received, {
      where: { locale: "fa", enabled: true },
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
      take: 20
    });
  });

  it("rejects SVG story uploads before decoding XML content", async () => {
    const service = new HomepageStoriesService(new ConfigService({ MEDIA_ROOT: "var/test-media" }), {} as PrismaService);
    await assert.rejects(
      service.create("00000000-0000-4000-8000-000000000001", {
        locale: "en", title: "Story", targetUrl: "/en", position: 0, enabled: true
      }, {
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="file:///etc/passwd" /></svg>'),
        mimetype: "image/svg+xml",
        originalname: "unsafe.svg"
      } as Express.Multer.File),
      BadRequestException
    );
  });

  it("waits for the backup lock before deleting metadata and again before cleaning the committed file", async () => {
    const root = await mkdtemp(join(tmpdir(), "topgsm-story-backup-lock-"));
    const path = "stories/original.webp";
    await mkdir(join(root, "stories")); await writeFile(join(root, path), "original");
    const events: string[] = [];
    let releaseMutation!: () => void;
    let releaseCleanup!: () => void;
    const mutationGate = new Promise<void>((resolve) => { releaseMutation = resolve; });
    const cleanupGate = new Promise<void>((resolve) => { releaseCleanup = resolve; });
    let cleanupStarted!: () => void;
    const cleanupWaiting = new Promise<void>((resolve) => { cleanupStarted = resolve; });
    let transactions = 0;
    const prisma = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        const transaction = ++transactions;
        const result = await callback({
          $executeRaw: async (sql: Prisma.Sql) => {
            assert.match(sql.sql, /pg_advisory_xact_lock_shared/);
            if (transaction === 1) await mutationGate;
            else { cleanupStarted(); await cleanupGate; }
            events.push(`lock-${transaction}`);
          },
          $queryRaw: async () => [],
          homepage_stories: {
            findUnique: async () => ({ image_path: path }),
            delete: async () => { events.push("delete"); }
          }
        });
        events.push(`commit-${transaction}`);
        return result;
      }
    } as unknown as PrismaService;
    try {
      const service = new HomepageStoriesService(new ConfigService({ MEDIA_ROOT: root }), prisma);
      const pending = service.remove("00000000-0000-4000-8000-000000000001");
      assert.deepEqual(events, []);
      assert.equal(await readFile(join(root, path), "utf8"), "original");
      releaseMutation();
      await cleanupWaiting;
      assert.deepEqual(events, ["lock-1", "delete", "commit-1"]);
      assert.equal(await readFile(join(root, path), "utf8"), "original");
      releaseCleanup();
      assert.deepEqual(await pending, { deleted: true });
      await assert.rejects(readFile(join(root, path)), { code: "ENOENT" });
      assert.deepEqual(events, ["lock-1", "delete", "commit-1", "lock-2", "commit-2"]);
    } finally { releaseMutation(); releaseCleanup(); await rm(root, { recursive: true, force: true }); }
  });

  it("preserves the original image when a replacement transaction fails to commit", async () => {
    const root = await mkdtemp(join(tmpdir(), "topgsm-story-backup-rollback-"));
    const path = "stories/original.webp";
    await mkdir(join(root, "stories")); await writeFile(join(root, path), "original");
    let replacementPath: string | undefined;
    const prisma = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        await callback({
          $executeRaw: async () => 1, $queryRaw: async () => [],
          homepage_stories: {
            findUnique: async () => ({ image_path: path }),
            update: async ({ data }: { data: { image_path: string } }) => { replacementPath = data.image_path; return {}; }
          }
        });
        throw new Error("simulated commit failure");
      }
    } as unknown as PrismaService;
    try {
      const service = new HomepageStoriesService(new ConfigService({ MEDIA_ROOT: root }), prisma);
      const buffer = await sharp({ create: { width: 10, height: 10, channels: 3, background: "navy" } }).png().toBuffer();
      await assert.rejects(service.update("00000000-0000-4000-8000-000000000001", "actor", {
        locale: "en", title: "Story", targetUrl: "/en", position: 0, enabled: true
      }, { buffer, mimetype: "image/png", originalname: "image.png" } as Express.Multer.File), /simulated commit failure/);
      assert.equal(await readFile(join(root, path), "utf8"), "original");
      assert.ok(replacementPath);
      await assert.rejects(readFile(join(root, replacementPath)), { code: "ENOENT" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
