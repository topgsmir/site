import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { CommentsService } from "./comments.service";

const buyer = { id: "buyer-1", fullName: "Buyer", email: "buyer@example.com", role: "buyer" } as AppUser;
const seller = { id: "staff-1", fullName: "Seller", email: "seller@example.com", role: "seller-staff" } as AppUser;

describe("product comments", () => {
  it("keeps guest comments pending even when signed-in comments publish immediately", async () => {
    let created: Record<string, unknown> | undefined;
    const prisma = {
      product_comment_settings: { findUnique: async () => ({ seller_lock_enabled: true, posting_policy: "guests", publication_policy: "immediate", updated_at: new Date() }) },
      products: { findFirst: async () => ({ id: "product-1" }) },
      product_comments: { create: async ({ data }: { data: Record<string, unknown> }) => { created = data; return { id: "comment-1", status: data.status }; } },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)
    } as unknown as PrismaService;
    const result = await new CommentsService(prisma).create("product-1", { body: "Helpful question", guestName: "Visitor" }, null);
    assert.equal(result.status, "pending");
    assert.equal(created?.assignments, undefined);
    await assert.rejects(() => new CommentsService(prisma).create("product-1", { body: "<script>alert(1)</script>", guestName: "Visitor" }, null), { name: "BadRequestException" });
  });

  it("assigns a published comment to every active seller in one transaction", async () => {
    let created: { assignments?: { create: Array<{ seller_id: string }> }; status?: string } | undefined;
    const prisma = {
      product_comment_settings: { findUnique: async () => ({ seller_lock_enabled: true, posting_policy: "buyers", publication_policy: "immediate", updated_at: new Date() }) },
      products: { findFirst: async () => ({ id: "product-1" }) },
      seller_listings: { findMany: async () => [{ seller_id: "seller-1" }, { seller_id: "seller-2" }] },
      product_comments: { create: async ({ data }: { data: typeof created }) => { created = data; return { id: "comment-1", status: data?.status }; } },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)
    } as unknown as PrismaService;
    await new CommentsService(prisma).create("product-1", { body: "Question" }, buyer);
    assert.equal(created?.status, "approved");
    assert.deepEqual(created?.assignments?.create.map((item) => item.seller_id), ["seller-1", "seller-2"]);
  });

  it("never replies to another seller's assignment", async () => {
    let where: unknown;
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
      product_comment_assignments: { updateMany: async (input: { where: unknown }) => { where = input.where; return { count: 0 }; } }
    } as unknown as PrismaService;
    await assert.rejects(() => new CommentsService(prisma).reply(seller, "comment-1", "Answer"), { name: "ConflictException" });
    assert.deepEqual(where, { comment_id: "comment-1", seller_id: "seller-1", replied_at: null, comment: { status: "approved" } });
  });

  it("moves a reported comment out of the published state", async () => {
    let update: unknown;
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
      product_comment_assignments: { findUnique: async () => ({ comment_id: "comment-1" }) },
      product_comments: { updateMany: async (input: unknown) => { update = input; return { count: 1 }; } },
      product_comment_events: { create: async () => ({}) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)
    } as unknown as PrismaService;
    await new CommentsService(prisma).flag(seller, "comment-1");
    assert.deepEqual(update, { where: { id: "comment-1", status: "approved" }, data: { status: "spam_review", flagged_by_user_id: seller.id } });
  });

  it("creates seller assignments only when an admin approves a pending comment", async () => {
    let assigned: unknown;
    const prisma = {
      product_comments: {
        findUnique: async () => ({ product_id: "product-1", status: "pending" }),
        updateMany: async () => ({ count: 1 })
      },
      seller_listings: { findMany: async () => [{ seller_id: "seller-1" }, { seller_id: "seller-2" }] },
      product_comment_assignments: { createMany: async ({ data }: { data: unknown }) => { assigned = data; } },
      product_comment_events: { create: async () => ({}) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)
    } as unknown as PrismaService;
    const result = await new CommentsService(prisma).moderate("comment-1", "approve", "admin-1");
    assert.equal(result.status, "approved");
    assert.deepEqual(assigned, [
      { comment_id: "comment-1", seller_id: "seller-1" },
      { comment_id: "comment-1", seller_id: "seller-2" }
    ]);
  });
});
