import "reflect-metadata";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BadRequestException, ConflictException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import sharp from "sharp";
import type { HomepageContent } from "@topgsm/shared-types";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BROWSER_SESSION_MUTATION } from "../auth/browser-session-mutation.decorator";
import type { PrismaService } from "../../prisma/prisma.service";
import { SaveHomepageDto, HomepageLocaleDto } from "./homepage.dto";
import { HomepageService, validateHomepageLinks } from "./homepage.service";
import { HomepageImagesService } from "./homepage-images.service";
import { AdminHomepageController } from "./homepage.controller";

export function homepageFixture(): HomepageContent {
  const link = { label: "Browse", href: "/en/products" };
  const section = { enabled: true, title: "Section", description: "Description" };
  return { hero: { eyebrow: "Repair", title: "Repair", accent: "Together", description: "Description", image: "/images/repair-studio.png", imageAlt: "Phone", primary: { ...link }, secondary: { label: "Experts", href: "#agents" } }, shortcuts: [], collections: { ...section, items: [] }, offers: { ...section, items: [] }, experts: { ...section }, latest: { ...section }, about: { ...section, points: ["Expert help"], link: { ...link } }, footer: { description: "Repair", links: [{ ...link }] } };
}

describe("homepage content security and persistence", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const validate = (value: unknown) => pipe.transform(value, { type: "body", metatype: SaveHomepageDto });

  it("validates nested documents, locale, bounds, and boolean types", async () => {
    await validate({ version: 0, content: homepageFixture() });
    for (const edit of [
      (v: HomepageContent) => { v.hero.title = " "; },
      (v: HomepageContent) => { v.hero.title = "x".repeat(101); },
      (v: HomepageContent) => { (v.experts as unknown as { enabled: string }).enabled = "false"; },
      (v: HomepageContent) => { v.about.points = new Array(9).fill("Reason"); },
      (v: HomepageContent) => { (v.hero as unknown as Record<string, unknown>).html = "<script>"; }
    ]) { const content = homepageFixture(); edit(content); await assert.rejects(validate({ version: 0, content }), BadRequestException); }
    await assert.rejects(validate({ version: -1, content: homepageFixture() }), BadRequestException);
    await assert.rejects(validate({ version: 0, content: {} }), BadRequestException);
    await assert.rejects(pipe.transform({ locale: "zz" }, { type: "query", metatype: HomepageLocaleDto }), BadRequestException);
  });

  it("rejects executable links, credential URLs, protocol-relative URLs, and arbitrary image requests", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,x", "//evil.test", "/\\evil.test", "https://user:pass@example.com", "http://example.com", "/%0a/evil", " /en"]) {
      const content = homepageFixture(); content.hero.primary.href = href;
      assert.throws(() => validateHomepageLinks(content), BadRequestException, href);
    }
    for (const image of ["https://example.com/a.png", "/api/auth/me", "/images/../secret.png", "data:image/svg+xml,x", "/images/test.svg"]) {
      const content = homepageFixture(); content.hero.image = image;
      assert.throws(() => validateHomepageLinks(content), BadRequestException, image);
    }
    const content = homepageFixture(); content.hero.primary.href = "https://example.com/product?q=phone";
    assert.doesNotThrow(() => validateHomepageLinks(content));
  });

  it("requires platform-admin and browser mutation protection for both writes", () => {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, AdminHomepageController), [PlatformAdminGuard]);
    for (const action of ["save", "upload"] as const) assert.equal(Reflect.getMetadata(BROWSER_SESSION_MUTATION, AdminHomepageController.prototype[action]), true);
  });

  it("returns explicit defaults and rejects stale edits before replacing content", async () => {
    const prisma = { homepage_content: { findUnique: async () => null }, $transaction: async (fn: (tx: unknown) => unknown) => fn({ homepage_content: { updateMany: async () => ({ count: 0 }) } }) } as unknown as PrismaService;
    const service = new HomepageService(prisma);
    assert.deepEqual(await service.get("fa"), { locale: "fa", content: null, version: 0, updatedAt: null });
    await assert.rejects(service.save("fa", { version: 2, content: homepageFixture() }, "actor"), ConflictException);
  });

  it("limits admin writes before saving and derives actor from authentication", async () => {
    const events: string[] = [];
    const controller = new AdminHomepageController({ save: async (_locale: string, _body: unknown, actor: string) => { events.push(actor); } } as unknown as HomepageService, {} as HomepageImagesService, { consumeMediaAdmin: async () => { events.push("limited"); } } as never);
    await controller.save({ locale: "fa" }, { version: 0, content: homepageFixture() }, { headers: {}, authenticatedUser: { id: "verified-actor" } as never }, "127.0.0.1");
    assert.deepEqual(events, ["limited", "verified-actor"]);
  });

  it("accepts one real multipart image through the HTTP interceptor", async () => {
    const root = await mkdtemp(join(tmpdir(), "topgsm-homepage-http-test-"));
    const images = new HomepageImagesService(new ConfigService({ MEDIA_ROOT: root }));
    const module = await Test.createTestingModule({
      controllers: [AdminHomepageController],
      providers: [{ provide: HomepageService, useValue: {} }, { provide: HomepageImagesService, useValue: images }, { provide: AuthRateLimitService, useValue: { consumeMediaUpload: async () => undefined } }]
    }).overrideGuard(PlatformAdminGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => { authenticatedUser?: { id: string } } } }) => { context.switchToHttp().getRequest().authenticatedUser = { id: "test-admin" }; return true; } }).compile();
    const app = module.createNestApplication({ logger: false });
    try {
      await app.listen(0, "127.0.0.1");
      const buffer = await sharp({ create: { width: 10, height: 10, channels: 3, background: "navy" } }).png().toBuffer();
      const form = new FormData(); form.set("file", new Blob([new Uint8Array(buffer)], { type: "image/png" }), "test.png");
      const response = await fetch(`${await app.getUrl()}/admin/homepage/images`, { method: "POST", body: form });
      assert.equal(response.status, 201, await response.clone().text());
      const result = await response.json() as { url: string };
      assert.match(result.url, /^\/homepage-images\/[0-9a-f-]{36}\.webp$/);
    } finally { await app.close(); await rm(root, { recursive: true, force: true }); }
  });

  it("decodes and re-encodes uploads, rejects SVG and traversal, and serves immutable WebP", async () => {
    const root = await mkdtemp(join(tmpdir(), "topgsm-homepage-test-"));
    try {
      const images = new HomepageImagesService(new ConfigService({ MEDIA_ROOT: root }));
      await assert.rejects(images.upload({ buffer: Buffer.from("<svg/>"), mimetype: "image/svg+xml" } as Express.Multer.File), BadRequestException);
      await assert.rejects(images.upload({ buffer: Buffer.from("not a PNG"), mimetype: "image/png" } as Express.Multer.File), BadRequestException);
      await assert.rejects(images.get("../../secret"));
      const input = await sharp({ create: { width: 20, height: 20, channels: 3, background: "navy" } }).png().toBuffer();
      const { url } = await images.upload({ buffer: input, mimetype: "image/png" } as Express.Multer.File);
      assert.match(url, /^\/homepage-images\/[0-9a-f-]{36}\.webp$/);
      const metadata = await sharp(await images.get(url.split("/").at(-1)!.slice(0, -5))).metadata();
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, 20);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
