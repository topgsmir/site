import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import { BlogService } from "./blog.service";

const now = new Date("2026-09-07T12:00:00.000Z");

describe("seller blog isolation", () => {
  it("rejects a related product outside the seller catalog", async () => {
    let createCalled = false;
    const prisma = {
      seller_listings: { findFirst: async () => null },
      blog_posts: { create: async () => { createCalled = true; } }
    } as unknown as PrismaService;
    const service = new BlogService(prisma);

    await assert.rejects(service.create("seller-1", {
      title: "Repair guide",
      content: "Safe repair steps",
      status: "draft",
      relatedProductId: "00000000-0000-4000-8000-000000000001"
    }), NotFoundException);
    assert.equal(createCalled, false);
  });

  it("derives ownership, slug, and publication time on the server", async () => {
    let createData: Record<string, unknown> | undefined;
    const prisma = {
      seller_listings: { findFirst: async () => ({ id: "listing-1" }) },
      blog_posts: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createData = data;
          return {
            id: data.id,
            title: data.title,
            slug: data.slug,
            excerpt: null,
            status: data.status,
            published_at: data.published_at,
            created_at: now,
            updated_at: now,
            product: null
          };
        }
      }
    } as unknown as PrismaService;
    const service = new BlogService(prisma);

    const post = await service.create("seller-1", {
      title: "  Screen   repair  ",
      content: "Instructions",
      status: "published"
    });

    assert.equal(createData?.seller_id, "seller-1");
    assert.equal(createData?.title, "Screen repair");
    assert.match(String(createData?.slug), /^screen-repair-[0-9a-f]{8}$/);
    assert.ok(createData?.published_at instanceof Date);
    assert.equal(post.status, "published");
  });

  it("keeps public reads limited to published posts by active sellers", async () => {
    let findArguments: Record<string, unknown> | undefined;
    const prisma = {
      blog_posts: {
        findMany: async (args: Record<string, unknown>) => {
          findArguments = args;
          return [];
        }
      }
    } as unknown as PrismaService;
    const service = new BlogService(prisma);

    await service.listPublic({ limit: 20 });
    assert.deepEqual(findArguments?.where, {
      status: "published",
      published_at: { not: null },
      seller: { invited: false, approved: true, suspended_at: null }
    });
  });
});
