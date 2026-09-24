import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
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
});
