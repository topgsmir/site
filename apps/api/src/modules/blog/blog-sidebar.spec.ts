import "reflect-metadata";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BadRequestException, ConflictException, ValidationPipe } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { BROWSER_SESSION_MUTATION } from "../auth/browser-session-mutation.decorator";
import type { PrismaService } from "../../prisma/prisma.service";
import { AdminBlogSidebarController } from "./blog-sidebar.controller";
import { SaveBlogSidebarDto } from "./blog-sidebar.dto";
import { BlogSidebarService, validateBlogSidebarHref } from "./blog-sidebar.service";

const fixture = () => ({
  version: 0,
  content: {
    enabled: true,
    title: "Your next step",
    description: "Useful products",
    ctaLabel: "Browse",
    ctaHref: "/en/products"
  },
  productIds: ["00000000-0000-4000-8000-000000000001"]
});

describe("blog sidebar settings", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const validate = (value: unknown) => pipe.transform(value, { type: "body", metatype: SaveBlogSidebarDto });

  it("validates nested copy, versions, and a unique three-product maximum", async () => {
    await validate(fixture());
    for (const change of [
      (value: ReturnType<typeof fixture>) => { value.content.title = " "; },
      (value: ReturnType<typeof fixture>) => { value.content.ctaLabel = "x".repeat(61); },
      (value: ReturnType<typeof fixture>) => { value.productIds = new Array(4).fill("00000000-0000-4000-8000-000000000001"); },
      (value: ReturnType<typeof fixture>) => { value.productIds = ["not-a-uuid"]; },
      (value: ReturnType<typeof fixture>) => { value.version = -1; }
    ]) {
      const value = fixture(); change(value);
      await assert.rejects(validate(value), BadRequestException);
    }
    await assert.rejects(validate({ ...fixture(), unexpected: true }), BadRequestException);
  });

  it("rejects executable, credential, protocol-relative, and control-character destinations", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,x", "//evil.test", "/\\evil.test", "https://user:pass@example.com", "http://example.com", "/%0a/evil", "/en/\u202eevil", " /en/products"]) {
      assert.throws(() => validateBlogSidebarHref(href), BadRequestException, href);
    }
    assert.doesNotThrow(() => validateBlogSidebarHref("/fa/products?type=service"));
    assert.doesNotThrow(() => validateBlogSidebarHref("https://example.com/products"));
  });

  it("requires the owner guard and browser mutation protection", () => {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, AdminBlogSidebarController), [PlatformAdminGuard]);
    assert.equal(Reflect.getMetadata(BROWSER_SESSION_MUTATION, AdminBlogSidebarController.prototype.save), true);
  });

  it("returns explicit defaults and rejects stale updates before replacing products", async () => {
    let deleted = false;
    const prisma = {
      blog_sidebar_settings: { findUnique: async () => null },
      products: { count: async () => 1 },
      $transaction: async (fn: (tx: unknown) => unknown) => fn({
        blog_sidebar_settings: { updateMany: async () => ({ count: 0 }) },
        blog_sidebar_products: { deleteMany: async () => { deleted = true; } }
      })
    } as unknown as PrismaService;
    const service = new BlogSidebarService(prisma);
    assert.deepEqual(await service.get("fa"), { locale: "fa", version: 0, content: null, products: [], updatedAt: null });
    await assert.rejects(service.save("fa", { ...fixture(), version: 2 }, "actor"), ConflictException);
    assert.equal(deleted, false);
  });

  it("rate-limits the write and derives the editor from the authenticated request", async () => {
    const events: string[] = [];
    const controller = new AdminBlogSidebarController(
      { save: async (_locale: string, _body: unknown, actorId: string) => { events.push(actorId); return {} as never; } } as unknown as BlogSidebarService,
      { consumeBlogMutation: async () => { events.push("limited"); } } as never
    );
    await controller.save({ locale: "fa" }, fixture(), { headers: {}, authenticatedUser: { id: "verified-owner" } as never }, "127.0.0.1");
    assert.deepEqual(events, ["limited", "verified-owner"]);
  });
});
