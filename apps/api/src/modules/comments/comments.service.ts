import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AdminListCommentsDto, CreateCommentDto, ListCommentsDto, UpdateCommentSettingsDto } from "./dto/comment.dto";

const DEFAULT_SETTINGS = { sellerLockEnabled: false, postingPolicy: "purchasers", publicationPolicy: "approval" } as const;
const VISIBLE = "approved";

function cleanText(value: string) {
  const text = value.trim();
  if (!text || /[<>]/.test(text)) throw new BadRequestException("Comment text must be plain text");
  return text;
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const row = await this.prisma.product_comment_settings.findUnique({ where: { id: 1 } });
    return row ? {
      sellerLockEnabled: row.seller_lock_enabled,
      postingPolicy: row.posting_policy,
      publicationPolicy: row.publication_policy,
      updatedAt: row.updated_at.toISOString()
    } : { ...DEFAULT_SETTINGS, updatedAt: null };
  }

  async updateSettings(input: UpdateCommentSettingsDto, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.product_comment_settings.upsert({
        where: { id: 1 },
        create: { id: 1, seller_lock_enabled: input.sellerLockEnabled, posting_policy: input.postingPolicy, publication_policy: input.publicationPolicy },
        update: { seller_lock_enabled: input.sellerLockEnabled, posting_policy: input.postingPolicy, publication_policy: input.publicationPolicy }
      });
      await tx.product_comment_events.create({ data: { actor_user_id: actorId, action: "settings_updated" } });
    });
    return this.getSettings();
  }

  async listPublic(productId: string, query: ListCommentsDto) {
    const rows = await this.prisma.product_comments.findMany({
      where: { product_id: productId, status: VISIBLE },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true, body: true, guest_name: true, created_at: true,
        author: { select: { full_name: true } },
        assignments: { where: { replied_at: { not: null } }, select: { seller: { select: { shop_name: true } }, reply_body: true, replied_at: true } }
      }
    });
    const items = rows.slice(0, query.limit).map((row) => ({
      id: row.id, body: row.body, authorName: row.author?.full_name ?? row.guest_name ?? "Guest", createdAt: row.created_at.toISOString(),
      replies: row.assignments.map((reply) => ({ sellerName: reply.seller.shop_name, body: reply.reply_body!, repliedAt: reply.replied_at!.toISOString() }))
    }));
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)?.id ?? null : null };
  }

  async create(productId: string, body: CreateCommentDto, user: AppUser | null) {
    const settings = await this.getSettings();
    if (user && user.role !== "buyer") throw new ForbiddenException("Only buyers may comment");
    if (!user && settings.postingPolicy !== "guests") throw new ForbiddenException("Sign in to comment");
    if (user && body.guestName !== undefined) throw new BadRequestException("Guest name is not allowed for signed-in comments");
    if (!user && !body.guestName?.trim()) throw new BadRequestException("Guest name is required");
    const content = cleanText(body.body);
    const guestName = user ? null : cleanText(body.guestName!);

    const product = await this.prisma.products.findFirst({ where: { id: productId, status: "active" }, select: { id: true } });
    if (!product) throw new NotFoundException("Product not found");
    if (settings.postingPolicy === "purchasers") {
      if (!user) throw new ForbiddenException("A purchase is required");
      const purchase = await this.prisma.order_items.findFirst({
        where: { order: { buyer_id: user.id, status: { in: ["paid", "processing", "shipped", "delivered"] } }, offer: { listing: { product_id: productId } } },
        select: { id: true }
      });
      if (!purchase) throw new ForbiddenException("A completed purchase is required to comment");
    }

    const approved = Boolean(user && settings.publicationPolicy === "immediate");
    return this.prisma.$transaction(async (tx) => {
      const sellers = approved ? await this.activeSellerIds(tx, productId) : [];
      if (approved && !sellers.length) throw new ConflictException("This product has no active sellers");
      const row = await tx.product_comments.create({ data: {
        product_id: productId, author_user_id: user?.id ?? null, guest_name: guestName, body: content,
        status: approved ? VISIBLE : "pending", published_at: approved ? new Date() : null,
        assignments: sellers.length ? { create: sellers.map((seller_id) => ({ seller_id })) } : undefined
      }, select: { id: true, status: true } });
      return { id: row.id, status: row.status };
    });
  }

  async sellerIdForUser(user: AppUser) {
    if (user.role !== "seller-admin" && user.role !== "seller-staff") throw new ForbiddenException("Seller access is required");
    const membership = await this.prisma.seller_memberships.findFirst({
      where: { user_id: user.id, active: true, seller: { approved: true, invited: false, suspended_at: null } },
      select: { seller_id: true }
    });
    if (!membership) throw new ForbiddenException("An active seller membership is required");
    return membership.seller_id;
  }

  async lockStatus(user: AppUser) {
    const sellerId = await this.sellerIdForUser(user);
    const settings = await this.getSettings();
    const unanswered = await this.prisma.product_comment_assignments.count({ where: {
      seller_id: sellerId, replied_at: null, comment: { status: VISIBLE }
    } });
    return { locked: settings.sellerLockEnabled && unanswered > 0, unanswered };
  }

  async isLockedUser(user: AppUser) {
    if (user.role !== "seller-admin" && user.role !== "seller-staff") return false;
    const membership = await this.prisma.seller_memberships.findFirst({ where: { user_id: user.id, active: true }, select: { seller_id: true } });
    if (!membership) return false;
    const settings = await this.getSettings();
    if (!settings.sellerLockEnabled) return false;
    return Boolean(await this.prisma.product_comment_assignments.findFirst({
      where: { seller_id: membership.seller_id, replied_at: null, comment: { status: VISIBLE } }, select: { comment_id: true }
    }));
  }

  async listSeller(user: AppUser, query: ListCommentsDto) {
    const sellerId = await this.sellerIdForUser(user);
    const rows = await this.prisma.product_comment_assignments.findMany({
      where: { seller_id: sellerId, comment: { status: VISIBLE } },
      orderBy: [{ comment: { created_at: "desc" } }, { comment_id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { comment_id_seller_id: { comment_id: query.cursor, seller_id: sellerId } }, skip: 1 } : {}),
      select: { reply_body: true, replied_at: true, comment: { select: { id: true, body: true, created_at: true, guest_name: true, author: { select: { full_name: true } }, product: { select: { title: true, slug: true } } } } }
    });
    const items = rows.slice(0, query.limit).map((row) => ({
      id: row.comment.id, body: row.comment.body, authorName: row.comment.author?.full_name ?? row.comment.guest_name ?? "Guest",
      createdAt: row.comment.created_at.toISOString(), productTitle: row.comment.product.title, productSlug: row.comment.product.slug,
      reply: row.reply_body, repliedAt: row.replied_at?.toISOString() ?? null
    }));
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)?.id ?? null : null };
  }

  async reply(user: AppUser, commentId: string, value: string) {
    const sellerId = await this.sellerIdForUser(user);
    const body = cleanText(value);
    const updated = await this.prisma.product_comment_assignments.updateMany({
      where: { comment_id: commentId, seller_id: sellerId, replied_at: null, comment: { status: VISIBLE } },
      data: { reply_body: body, replied_by_user_id: user.id, replied_at: new Date() }
    });
    if (updated.count !== 1) throw new ConflictException("Comment is unavailable or already answered");
    return { answered: true };
  }

  async flag(user: AppUser, commentId: string) {
    const sellerId = await this.sellerIdForUser(user);
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.product_comment_assignments.findUnique({ where: { comment_id_seller_id: { comment_id: commentId, seller_id: sellerId } }, select: { comment_id: true } });
      if (!owned) throw new NotFoundException("Comment not found");
      const updated = await tx.product_comments.updateMany({ where: { id: commentId, status: VISIBLE }, data: { status: "spam_review", flagged_by_user_id: user.id } });
      if (updated.count !== 1) throw new ConflictException("Comment is not available to flag");
      await tx.product_comment_events.create({ data: { comment_id: commentId, actor_user_id: user.id, action: "flagged_spam" } });
      return { status: "spam_review" };
    });
  }

  async listAdmin(query: AdminListCommentsDto) {
    const search = query.search?.trim();
    const where: Prisma.product_commentsWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { OR: [
        { body: { contains: search, mode: "insensitive" } },
        { product: { title: { contains: search, mode: "insensitive" } } },
        { author: { full_name: { contains: search, mode: "insensitive" } } },
        { guest_name: { contains: search, mode: "insensitive" } }
      ] } : {})
    };
    const rows = await this.prisma.product_comments.findMany({
      where, orderBy: [{ created_at: "desc" }, { id: "desc" }], take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: { id: true, body: true, status: true, guest_name: true, created_at: true, flagged_by_user_id: true,
        product: { select: { title: true, slug: true } }, author: { select: { full_name: true } },
        assignments: { select: { reply_body: true, seller: { select: { shop_name: true } } } }
      }
    });
    const items = rows.slice(0, query.limit).map((row) => ({
      id: row.id, body: row.body, status: row.status, authorName: row.author?.full_name ?? row.guest_name ?? "Guest", createdAt: row.created_at.toISOString(),
      productTitle: row.product.title, productSlug: row.product.slug, flagged: Boolean(row.flagged_by_user_id),
      replies: row.assignments.map((assignment) => ({ sellerName: assignment.seller.shop_name, body: assignment.reply_body }))
    }));
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)?.id ?? null : null };
  }

  async moderate(commentId: string, action: "approve" | "reject" | "spam" | "restore", actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.product_comments.findUnique({ where: { id: commentId }, select: { product_id: true, status: true } });
      if (!current) throw new NotFoundException("Comment not found");
      const expected = action === "approve" ? "pending" : action === "restore" || action === "spam" ? "spam_review" : undefined;
      if (expected && current.status !== expected) throw new ConflictException("Comment state has changed");
      if (action === "reject" && current.status !== "pending" && current.status !== VISIBLE) throw new ConflictException("Comment cannot be rejected");
      const status = action === "approve" || action === "restore" ? VISIBLE : action === "spam" ? "spam" : "rejected";
      const sellers = action === "approve" ? await this.activeSellerIds(tx, current.product_id) : [];
      if (action === "approve" && !sellers.length) throw new ConflictException("This product has no active sellers");
      const changed = await tx.product_comments.updateMany({
        where: { id: commentId, status: current.status },
        data: { status, flagged_by_user_id: null, ...(action === "approve" ? { published_at: new Date() } : {}) }
      });
      if (changed.count !== 1) throw new ConflictException("Comment state has changed");
      if (sellers.length) await tx.product_comment_assignments.createMany({ data: sellers.map((seller_id) => ({ comment_id: commentId, seller_id })) });
      await tx.product_comment_events.create({ data: { comment_id: commentId, actor_user_id: actorId, action } });
      return { status };
    });
  }

  private async activeSellerIds(tx: Prisma.TransactionClient, productId: string) {
    const listings = await tx.seller_listings.findMany({
      where: { product_id: productId, status: "active", seller: { approved: true, invited: false, suspended_at: null }, offers: { some: { status: "active" } } },
      select: { seller_id: true }
    });
    return listings.map((listing) => listing.seller_id);
  }
}
