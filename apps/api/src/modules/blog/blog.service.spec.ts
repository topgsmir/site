import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { BlogActor } from "./blog-manage.guard";
import { BlogService } from "./blog.service";
import { validateRichText } from "./rich-text.validator";

const sellerActor: BlogActor = {
  type: "seller",
  sellerId: "00000000-0000-4000-8000-000000000001",
  reviewRequired: true,
  user: {
    id: "00000000-0000-4000-8000-000000000002",
    fullName: "Seller",
    email: "seller@example.com",
    role: "seller-admin",
    permissions: ["blog_manage"]
  }
};

describe("multilingual blog security", () => {
  it("rejects raw HTML nodes and unsafe link protocols", () => {
    assert.throws(
      () => validateRichText({ type: "doc", content: [{ type: "html", text: "<script />" }] }),
      BadRequestException
    );
    assert.throws(
      () => validateRichText({
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: "open", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }]
        }]
      }),
      BadRequestException
    );
  });

  it("accepts allowlisted content and extracts same-origin media ids", () => {
    const result = validateRichText({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{ type: "image", attrs: { src: "/media/00000000-0000-4000-8000-000000000003/md.webp" } }]
      }]
    });
    assert.deepEqual(result.mediaIds, ["00000000-0000-4000-8000-000000000003"]);
  });

  it("scopes seller product search to active listings", async () => {
    let where: unknown;
    const prisma = {
      products: {
        findMany: async (input: { where: unknown }) => {
          where = input.where;
          return [];
        }
      }
    } as unknown as PrismaService;
    const service = new BlogService(prisma);
    await service.productOptions(sellerActor, { limit: 20 });
    assert.deepEqual(where, {
      status: "active",
      listings: {
        some: {
          seller_id: sellerActor.sellerId,
          status: "active"
        }
      }
    });
  });

  it("public listings exclude archives and suspended sellers", async () => {
    let where: unknown;
    const prisma = {
      blog_posts: {
        findMany: async (input: { where: unknown }) => {
          where = input.where;
          return [];
        }
      }
    } as unknown as PrismaService;
    const service = new BlogService(prisma);
    await service.listPublic("fa", { limit: 20 });
    assert.deepEqual(where, {
      archived_at: null,
      published_revision_id: { not: null },
      OR: [
        { seller_id: null },
        { seller: { approved: true, invited: false, suspended_at: null } }
      ],
      published_revision: { translations: { some: { locale: "fa" } } }
    });
  });

});
