import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { CommentsService } from "./comments.service";

const buyer = { id: "buyer-1", fullName: "Buyer", email: "buyer@example.com", role: "buyer" } as AppUser;
const seller = { id: "staff-1", fullName: "Seller", email: "seller@example.com", role: "seller-staff" } as AppUser;
const admin = { id: "admin-1", fullName: "Admin", email: "admin@example.com", role: "platform-admin" } as AppUser;

describe("product comments", () => {
  it("keeps guest comments pending even when signed-in comments publish immediately", async () => {
    let created: Record<string, unknown> | undefined;
    const prisma = {
      comment_settings: { findUnique: async () => ({ seller_lock_enabled: true, posting_policy: "guests", publication_policy: "immediate", updated_at: new Date() }) },
      products: { findFirst: async () => ({ id: "product-1" }) },
      comments: { create: async ({ data }: { data: Record<string, unknown> }) => { created = data; return { id: "comment-1", status: data.status }; } },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)
    } as unknown as PrismaService;
    const result = await new CommentsService(prisma).create("product", "product-1", { body: "Helpful question", guestName: "Visitor" }, null);
    assert.equal(result.status, "pending");
    assert.equal(created?.assignments, undefined);
    await assert.rejects(() => new CommentsService(prisma).create("product", "product-1", { body: "<script>alert(1)</script>", guestName: "Visitor" }, null), { name: "BadRequestException" });
  });

  it("assigns a published comment to every active seller in one transaction", async () => {
    let created: { assignments?: { create: Array<{ seller_id: string }> }; status?: string } | undefined;
    const prisma = {
      comment_settings: { findUnique: async () => ({ seller_lock_enabled: true, posting_policy: "buyers", publication_policy: "immediate", updated_at: new Date() }) },
      products: { findFirst: async () => ({ id: "product-1" }) },
      seller_listings: { findMany: async () => [{ seller_id: "seller-1" }, { seller_id: "seller-2" }] },
      comments: { create: async ({ data }: { data: typeof created }) => { created = data; return { id: "comment-1", status: data?.status }; } },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)
    } as unknown as PrismaService;
    await new CommentsService(prisma).create("product", "product-1", { body: "Question" }, buyer);
    assert.equal(created?.status, "approved");
    assert.deepEqual(created?.assignments?.create.map((item) => item.seller_id), ["seller-1", "seller-2"]);
  });

  it("never replies to another seller's assignment", async () => {
    let where: unknown;
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1", seller: { permissions: [] } }) },
      comment_assignments: { updateMany: async (input: { where: unknown }) => { where = input.where; return { count: 0 }; } }
    } as unknown as PrismaService;
    await assert.rejects(() => new CommentsService(prisma).reply(seller, "comment-1", "Answer"), { name: "ConflictException" });
    assert.deepEqual(where, {
      comment_id: "comment-1", assignee_key: "seller:seller-1", seller_id: "seller-1", replied_at: null,
      comment: { status: "approved", OR: [{ product_id: { not: null } }] }
    });
  });

  it("moves a reported comment out of the published state", async () => {
    let update: unknown;
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1", seller: { permissions: [] } }) },
      comment_assignments: { findFirst: async () => ({ comment_id: "comment-1" }) },
      comments: { updateMany: async (input: unknown) => { update = input; return { count: 1 }; } },
      comment_events: { create: async () => ({}) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)
    } as unknown as PrismaService;
    await new CommentsService(prisma).flag(seller, "comment-1");
    assert.deepEqual(update, { where: { id: "comment-1", status: "approved" }, data: { status: "spam_review", flagged_by_user_id: seller.id } });
  });

  it("creates seller assignments only when an admin approves a pending comment", async () => {
    let assigned: unknown;
    const prisma = {
      comments: {
        findUnique: async () => ({ product_id: "product-1", blog_post_id: null, status: "pending" }),
        updateMany: async () => ({ count: 1 })
      },
      products: { findFirst: async () => ({ id: "product-1" }) },
      seller_listings: { findMany: async () => [{ seller_id: "seller-1" }, { seller_id: "seller-2" }] },
      comment_assignments: { createMany: async ({ data }: { data: unknown }) => { assigned = data; } },
      comment_events: { create: async () => ({}) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)
    } as unknown as PrismaService;
    const result = await new CommentsService(prisma).moderate("comment-1", "approve", "admin-1");
    assert.equal(result.status, "approved");
    assert.deepEqual(assigned, [
      { comment_id: "comment-1", assignee_kind: "seller", assignee_key: "seller:seller-1", seller_id: "seller-1" },
      { comment_id: "comment-1", assignee_kind: "seller", assignee_key: "seller:seller-2", seller_id: "seller-2" }
    ]);
  });

  it("publishes a signed-in buyer comment on an editorial blog without requiring a purchase", async () => {
    let created: Record<string, unknown> | undefined;
    const prisma = {
      comment_settings: { findUnique: async () => ({ seller_lock_enabled: true, posting_policy: "purchasers", publication_policy: "immediate", updated_at: new Date() }) },
      blog_posts: { findFirst: async () => ({ id: "post-1", seller_id: null }) },
      comments: { create: async ({ data }: { data: Record<string, unknown> }) => { created = data; return { id: "comment-1", status: data.status }; } },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)
    } as unknown as PrismaService;
    const result = await new CommentsService(prisma).create("blog", "post-1", { body: "Useful guide" }, buyer);
    assert.equal(result.status, "approved");
    assert.deepEqual(created?.assignments, { create: [{ assignee_kind: "editorial", assignee_key: "editorial", seller_id: null }] });
  });

  it("does not count blog assignments toward the seller lock", async () => {
    let countWhere: unknown;
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1", seller: { permissions: [{ permission: "blog_manage" }] } }) },
      comment_settings: { findUnique: async () => ({ seller_lock_enabled: true, posting_policy: "buyers", publication_policy: "approval", updated_at: new Date() }) },
      comment_assignments: { count: async ({ where }: { where: unknown }) => { countWhere = where; return 0; } }
    } as unknown as PrismaService;
    assert.deepEqual(await new CommentsService(prisma).lockStatus(seller), { locked: false, unanswered: 0 });
    assert.deepEqual(countWhere, { seller_id: "seller-1", replied_at: null, comment: { status: "approved", product_id: { not: null } } });
  });

  it("allows only a platform admin to use an editorial assignment", async () => {
    let update: unknown;
    const prisma = {
      comment_assignments: { updateMany: async (input: unknown) => { update = input; return { count: 1 }; } }
    } as unknown as PrismaService;
    const service = new CommentsService(prisma);
    await assert.rejects(() => service.replyEditorial(seller, "comment-1", "Editorial answer"), { name: "ForbiddenException" });
    assert.deepEqual(await service.replyEditorial(admin, "comment-1", "Editorial answer"), { answered: true });
    assert.deepEqual(update, {
      where: { comment_id: "comment-1", assignee_key: "editorial", assignee_kind: "editorial", replied_at: null, comment: { status: "approved", blog_post: { is: { seller_id: null, archived_at: null, published_revision_id: { not: null } } } } },
      data: { reply_body: "Editorial answer", replied_by_user_id: "admin-1", replied_at: (update as { data: { replied_at: Date } }).data.replied_at }
    });
  });
});
