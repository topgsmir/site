import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AdminListCommentsDto, CreateCommentDto, ListCommentsDto, SellerListCommentsDto, UpdateCommentSettingsDto } from "./dto/comment.dto";

const DEFAULT_SETTINGS = { sellerLockEnabled: false, postingPolicy: "purchasers", publicationPolicy: "approval" } as const;
const VISIBLE = "approved";
const EDITORIAL_KEY = "editorial";
type CommentTargetType = "product" | "blog";
type DatabaseClient = PrismaService | Prisma.TransactionClient;

function cleanText(value: string) {
  const text = value.trim();
  if (!text || /[<>]/.test(text)) throw new BadRequestException("Comment text must be plain text");
  return text;
}

function sellerKey(sellerId: string) {
  return `seller:${sellerId}`;
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const row = await this.prisma.comment_settings.findUnique({ where: { id: 1 } });
    return row ? {
      sellerLockEnabled: row.seller_lock_enabled,
      postingPolicy: row.posting_policy,
      publicationPolicy: row.publication_policy,
      updatedAt: row.updated_at.toISOString()
    } : { ...DEFAULT_SETTINGS, updatedAt: null };
  }

  async updateSettings(input: UpdateCommentSettingsDto, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.comment_settings.upsert({
        where: { id: 1 },
        create: { id: 1, seller_lock_enabled: input.sellerLockEnabled, posting_policy: input.postingPolicy, publication_policy: input.publicationPolicy },
        update: { seller_lock_enabled: input.sellerLockEnabled, posting_policy: input.postingPolicy, publication_policy: input.publicationPolicy }
      });
      await tx.comment_events.create({ data: { actor_user_id: actorId, action: "settings_updated" } });
    });
    return this.getSettings();
  }

  async listPublic(targetType: CommentTargetType, targetId: string, query: ListCommentsDto) {
    await this.resolveTarget(this.prisma, targetType, targetId);
    const rows = await this.prisma.comments.findMany({
      where: { ...(targetType === "product" ? { product_id: targetId } : { blog_post_id: targetId }), status: VISIBLE },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true, body: true, guest_name: true, created_at: true,
        author: { select: { full_name: true } },
        assignments: {
          where: { replied_at: { not: null } },
          select: { assignee_kind: true, seller: { select: { shop_name: true } }, reply_body: true, replied_at: true }
        }
      }
    });
    const items = rows.slice(0, query.limit).map((row) => ({
      id: row.id,
      body: row.body,
      authorName: row.author?.full_name ?? row.guest_name ?? "Guest",
      createdAt: row.created_at.toISOString(),
      replies: row.assignments.map((reply) => {
        const authorName = reply.seller?.shop_name ?? "Top GSM Editorial";
        return {
          authorName,
          authorType: reply.assignee_kind as "seller" | "editorial",
          ...(reply.seller ? { sellerName: reply.seller.shop_name } : {}),
          body: reply.reply_body!,
          repliedAt: reply.replied_at!.toISOString()
        };
      })
    }));
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)?.id ?? null : null };
  }

  async create(targetType: CommentTargetType, targetId: string, body: CreateCommentDto, user: AppUser | null) {
    const settings = await this.getSettings();
    if (user && user.role !== "buyer") throw new ForbiddenException("Only buyers may comment");
    if (!user && settings.postingPolicy !== "guests") throw new ForbiddenException("Sign in to comment");
    if (user && body.guestName !== undefined) throw new BadRequestException("Guest name is not allowed for signed-in comments");
    if (!user && !body.guestName?.trim()) throw new BadRequestException("Guest name is required");
    const content = cleanText(body.body);
    const guestName = user ? null : cleanText(body.guestName!);

    if (targetType === "product" && settings.postingPolicy === "purchasers") {
      if (!user) throw new ForbiddenException("A purchase is required");
      const purchase = await this.prisma.order_items.findFirst({
        where: { order: { buyer_id: user.id, status: { in: ["paid", "processing", "shipped", "delivered"] } }, offer: { listing: { product_id: targetId } } },
        select: { id: true }
      });
      if (!purchase) throw new ForbiddenException("A completed purchase is required to comment");
    }

    const approved = Boolean(user && settings.publicationPolicy === "immediate");
    return this.prisma.$transaction(async (tx) => {
      const target = await this.resolveTarget(tx, targetType, targetId);
      const assignments = approved ? await this.assignmentRows(tx, target) : [];
      if (approved && targetType === "product" && !assignments.length) throw new ConflictException("This product has no active sellers");
      const row = await tx.comments.create({ data: {
        product_id: targetType === "product" ? targetId : null,
        blog_post_id: targetType === "blog" ? targetId : null,
        author_user_id: user?.id ?? null,
        guest_name: guestName,
        body: content,
        status: approved ? VISIBLE : "pending",
        published_at: approved ? new Date() : null,
        assignments: assignments.length ? { create: assignments } : undefined
      }, select: { id: true, status: true } });
      return { id: row.id, status: row.status };
    });
  }

  async sellerContext(user: AppUser) {
    if (user.role !== "seller-admin" && user.role !== "seller-staff") throw new ForbiddenException("Seller access is required");
    const membership = await this.prisma.seller_memberships.findFirst({
      where: { user_id: user.id, active: true, seller: { approved: true, invited: false, suspended_at: null } },
      select: { seller_id: true, seller: { select: { permissions: { where: { permission: "blog_manage" }, select: { permission: true } } } } }
    });
    if (!membership) throw new ForbiddenException("An active seller membership is required");
    return { sellerId: membership.seller_id, canManageBlog: membership.seller.permissions.length > 0 };
  }

  async lockStatus(user: AppUser) {
    const { sellerId } = await this.sellerContext(user);
    const settings = await this.getSettings();
    const unanswered = await this.prisma.comment_assignments.count({ where: {
      seller_id: sellerId, replied_at: null, comment: { status: VISIBLE, product_id: { not: null } }
    } });
    return { locked: settings.sellerLockEnabled && unanswered > 0, unanswered };
  }

  async isLockedUser(user: AppUser) {
    if (user.role !== "seller-admin" && user.role !== "seller-staff") return false;
    const membership = await this.prisma.seller_memberships.findFirst({ where: { user_id: user.id, active: true, seller: { approved: true, invited: false, suspended_at: null } }, select: { seller_id: true } });
    if (!membership) return false;
    const settings = await this.getSettings();
    if (!settings.sellerLockEnabled) return false;
    return Boolean(await this.prisma.comment_assignments.findFirst({
      where: { seller_id: membership.seller_id, replied_at: null, comment: { status: VISIBLE, product_id: { not: null } } }, select: { comment_id: true }
    }));
  }

  async listSeller(user: AppUser, query: SellerListCommentsDto) {
    const { sellerId, canManageBlog } = await this.sellerContext(user);
    const rows = await this.prisma.comment_assignments.findMany({
      where: {
        seller_id: sellerId,
        comment: { status: VISIBLE, OR: [
          { product_id: { not: null } },
          ...(canManageBlog ? [{ blog_post: { is: { seller_id: sellerId, archived_at: null, published_revision_id: { not: null } } } }] : [])
        ] }
      },
      orderBy: [{ comment: { created_at: "desc" } }, { comment_id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { comment_id_assignee_key: { comment_id: query.cursor, assignee_key: sellerKey(sellerId) } }, skip: 1 } : {}),
      select: {
        reply_body: true, replied_at: true,
        comment: { select: {
          id: true, body: true, created_at: true, guest_name: true,
          author: { select: { full_name: true } },
          product: { select: { id: true, title: true, slug: true } },
          blog_post: { select: {
            id: true,
            routes: { where: { locale: query.locale, is_current: true }, take: 1, select: { slug: true } },
            published_revision: { select: { translations: { where: { locale: query.locale }, take: 1, select: { title: true } } } }
          } }
        } }
      }
    });
    const items = rows.slice(0, query.limit).map((row) => {
      const target = this.mapTarget(row.comment);
      return {
        id: row.comment.id, body: row.comment.body,
        authorName: row.comment.author?.full_name ?? row.comment.guest_name ?? "Guest",
        createdAt: row.comment.created_at.toISOString(), target,
        productTitle: target.type === "product" ? target.title : null,
        productSlug: target.type === "product" ? target.slug : null,
        reply: row.reply_body, repliedAt: row.replied_at?.toISOString() ?? null
      };
    });
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)?.id ?? null : null };
  }

  async reply(user: AppUser, commentId: string, value: string) {
    const { sellerId, canManageBlog } = await this.sellerContext(user);
    const body = cleanText(value);
    const updated = await this.prisma.comment_assignments.updateMany({
      where: {
        comment_id: commentId, assignee_key: sellerKey(sellerId), seller_id: sellerId, replied_at: null,
        comment: { status: VISIBLE, OR: [
          { product_id: { not: null } },
          ...(canManageBlog ? [{ blog_post: { is: { seller_id: sellerId, archived_at: null, published_revision_id: { not: null } } } }] : [])
        ] }
      },
      data: { reply_body: body, replied_by_user_id: user.id, replied_at: new Date() }
    });
    if (updated.count !== 1) throw new ConflictException("Comment is unavailable or already answered");
    return { answered: true };
  }

  async flag(user: AppUser, commentId: string) {
    const { sellerId, canManageBlog } = await this.sellerContext(user);
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.comment_assignments.findFirst({
        where: {
          comment_id: commentId, assignee_key: sellerKey(sellerId), seller_id: sellerId,
          comment: { status: VISIBLE, OR: [
            { product_id: { not: null } },
            ...(canManageBlog ? [{ blog_post: { is: { seller_id: sellerId, archived_at: null, published_revision_id: { not: null } } } }] : [])
          ] }
        },
        select: { comment_id: true }
      });
      if (!owned) throw new NotFoundException("Comment not found");
      return this.flagComment(tx, commentId, user.id);
    });
  }

  async replyEditorial(user: AppUser, commentId: string, value: string) {
    if (user.role !== "platform-admin") throw new ForbiddenException("Platform administrator access is required");
    const body = cleanText(value);
    const updated = await this.prisma.comment_assignments.updateMany({
      where: { comment_id: commentId, assignee_key: EDITORIAL_KEY, assignee_kind: "editorial", replied_at: null, comment: { status: VISIBLE, blog_post: { is: { seller_id: null, archived_at: null, published_revision_id: { not: null } } } } },
      data: { reply_body: body, replied_by_user_id: user.id, replied_at: new Date() }
    });
    if (updated.count !== 1) throw new ConflictException("Comment is unavailable or already answered");
    return { answered: true };
  }

  async flagEditorial(user: AppUser, commentId: string) {
    if (user.role !== "platform-admin") throw new ForbiddenException("Platform administrator access is required");
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.comment_assignments.findFirst({
        where: { comment_id: commentId, assignee_key: EDITORIAL_KEY, assignee_kind: "editorial", comment: { status: VISIBLE, blog_post: { is: { seller_id: null, archived_at: null, published_revision_id: { not: null } } } } },
        select: { comment_id: true }
      });
      if (!owned) throw new NotFoundException("Comment not found");
      return this.flagComment(tx, commentId, user.id);
    });
  }

  async listAdmin(query: AdminListCommentsDto) {
    const search = query.search?.trim();
    const where: Prisma.commentsWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.target === "product" ? { product_id: { not: null } } : query.target === "blog" ? { blog_post_id: { not: null } } : {}),
      ...(search ? { OR: [
        { body: { contains: search, mode: "insensitive" } },
        { product: { is: { title: { contains: search, mode: "insensitive" } } } },
        { blog_post: { is: { published_revision: { is: { translations: { some: { title: { contains: search, mode: "insensitive" } } } } } } } },
        { author: { is: { full_name: { contains: search, mode: "insensitive" } } } },
        { guest_name: { contains: search, mode: "insensitive" } }
      ] } : {})
    };
    const rows = await this.prisma.comments.findMany({
      where, orderBy: [{ created_at: "desc" }, { id: "desc" }], take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true, body: true, status: true, guest_name: true, created_at: true, flagged_by_user_id: true,
        product: { select: { id: true, title: true, slug: true } },
        blog_post: { select: {
          id: true,
          routes: { where: { locale: query.locale, is_current: true }, take: 1, select: { slug: true } },
          published_revision: { select: { translations: { where: { locale: query.locale }, take: 1, select: { title: true } } } }
        } },
        author: { select: { full_name: true } },
        assignments: { select: { assignee_kind: true, reply_body: true, seller: { select: { shop_name: true } } } }
      }
    });
    const items = rows.slice(0, query.limit).map((row) => {
      const target = this.mapTarget(row);
      const editorial = row.assignments.find((assignment) => assignment.assignee_kind === "editorial");
      return {
        id: row.id, body: row.body, status: row.status,
        authorName: row.author?.full_name ?? row.guest_name ?? "Guest",
        createdAt: row.created_at.toISOString(), target,
        productTitle: target.type === "product" ? target.title : null,
        productSlug: target.type === "product" ? target.slug : null,
        flagged: Boolean(row.flagged_by_user_id),
        canReply: target.type === "blog" && Boolean(editorial) && !editorial?.reply_body && row.status === VISIBLE,
        canFlag: target.type === "blog" && Boolean(editorial) && row.status === VISIBLE,
        replies: row.assignments.map((assignment) => ({
          authorName: assignment.seller?.shop_name ?? "Top GSM Editorial",
          authorType: assignment.assignee_kind as "seller" | "editorial",
          ...(assignment.seller ? { sellerName: assignment.seller.shop_name } : {}),
          body: assignment.reply_body
        }))
      };
    });
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)?.id ?? null : null };
  }

  async moderate(commentId: string, action: "approve" | "reject" | "spam" | "restore", actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.comments.findUnique({ where: { id: commentId }, select: { product_id: true, blog_post_id: true, status: true } });
      if (!current) throw new NotFoundException("Comment not found");
      const expected = action === "approve" ? "pending" : action === "restore" || action === "spam" ? "spam_review" : undefined;
      if (expected && current.status !== expected) throw new ConflictException("Comment state has changed");
      if (action === "reject" && current.status !== "pending" && current.status !== VISIBLE) throw new ConflictException("Comment cannot be rejected");
      const status = action === "approve" || action === "restore" ? VISIBLE : action === "spam" ? "spam" : "rejected";
      const targetType: CommentTargetType = current.product_id ? "product" : "blog";
      const targetId = current.product_id ?? current.blog_post_id!;
      const assignments = action === "approve" ? await this.assignmentRows(tx, await this.resolveTarget(tx, targetType, targetId)) : [];
      if (action === "approve" && targetType === "product" && !assignments.length) throw new ConflictException("This product has no active sellers");
      const changed = await tx.comments.updateMany({
        where: { id: commentId, status: current.status },
        data: { status, flagged_by_user_id: null, ...(action === "approve" ? { published_at: new Date() } : {}) }
      });
      if (changed.count !== 1) throw new ConflictException("Comment state has changed");
      if (assignments.length) await tx.comment_assignments.createMany({ data: assignments.map((assignment) => ({ comment_id: commentId, ...assignment })) });
      await tx.comment_events.create({ data: { comment_id: commentId, actor_user_id: actorId, action } });
      return { status };
    });
  }

  private async flagComment(tx: Prisma.TransactionClient, commentId: string, actorId: string) {
    const updated = await tx.comments.updateMany({ where: { id: commentId, status: VISIBLE }, data: { status: "spam_review", flagged_by_user_id: actorId } });
    if (updated.count !== 1) throw new ConflictException("Comment is not available to flag");
    await tx.comment_events.create({ data: { comment_id: commentId, actor_user_id: actorId, action: "flagged_spam" } });
    return { status: "spam_review" };
  }

  private async resolveTarget(db: DatabaseClient, targetType: CommentTargetType, targetId: string) {
    if (targetType === "product") {
      const product = await db.products.findFirst({ where: { id: targetId, status: "active" }, select: { id: true } });
      if (!product) throw new NotFoundException("Product not found");
      return { type: targetType, id: product.id, sellerId: null } as const;
    }
    const post = await db.blog_posts.findFirst({
      where: {
        id: targetId, archived_at: null, published_revision_id: { not: null },
        OR: [{ seller_id: null }, { seller: { is: { approved: true, invited: false, suspended_at: null } } }]
      },
      select: { id: true, seller_id: true }
    });
    if (!post) throw new NotFoundException("Blog post not found");
    return { type: targetType, id: post.id, sellerId: post.seller_id } as const;
  }

  private async assignmentRows(tx: Prisma.TransactionClient, target: { type: CommentTargetType; id: string; sellerId: string | null }) {
    if (target.type === "blog") {
      return target.sellerId
        ? [{ assignee_kind: "seller", assignee_key: sellerKey(target.sellerId), seller_id: target.sellerId }]
        : [{ assignee_kind: "editorial", assignee_key: EDITORIAL_KEY, seller_id: null }];
    }
    const sellers = await this.activeSellerIds(tx, target.id);
    return sellers.map((sellerId) => ({ assignee_kind: "seller", assignee_key: sellerKey(sellerId), seller_id: sellerId }));
  }

  private mapTarget(row: {
    product: { id: string; title: string; slug: string } | null;
    blog_post: { id: string; routes: Array<{ slug: string }>; published_revision: { translations: Array<{ title: string | null }> } | null } | null;
  }) {
    if (row.product) return { type: "product" as const, id: row.product.id, title: row.product.title, slug: row.product.slug };
    const post = row.blog_post!;
    return {
      type: "blog" as const, id: post.id,
      title: post.published_revision?.translations[0]?.title ?? "Blog post",
      slug: post.routes[0]?.slug ?? ""
    };
  }

  private async activeSellerIds(tx: Prisma.TransactionClient, productId: string) {
    const listings = await tx.seller_listings.findMany({
      where: { product_id: productId, status: "active", seller: { approved: true, invited: false, suspended_at: null }, offers: { some: { status: "active" } } },
      select: { seller_id: true }
    });
    return listings.map((listing) => listing.seller_id);
  }
}
