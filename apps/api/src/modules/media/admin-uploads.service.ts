import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type {
  AdminUploadBulkResult,
  AdminUploadDetail,
  AdminUploadListItem,
  AdminUploadPage,
  AdminUploadSource,
  AdminUploadSummary
} from "@topgsm/shared-types";
import { randomUUID } from "node:crypto";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AdminUploadsQueryDto, AdminUploadRefDto } from "./dto/admin-uploads.dto";
import { MediaService } from "./media.service";

const TRASH_DAYS = 30;
const CLAIM_STALE_MS = 15 * 60 * 1000;

type Cursor = { v: 1; sort: "newest" | "oldest" | "size"; value: string; id: string; source: AdminUploadSource };
type InventoryRow = {
  source: AdminUploadSource; id: string; kind: string; state: "active" | "trashed" | "purging";
  link_state: "linked" | "unlinked"; original_filename: string | null; original_mime_type: string | null;
  width: number; height: number; source_bytes: number; generated_bytes: bigint; checksum: string;
  created_at: Date; trashed_at: Date | null; purge_after: Date | null; preview_variant: string | null;
  owner_id: string; owner_name: string; owner_email: string | null;
  linked_id: string | null; linked_title: string | null; linked_type: "post" | "product" | null;
};

export function encodeUploadCursor(value: Cursor) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeUploadCursor(value: string, sort: Cursor["sort"]): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>;
    if (parsed.v !== 1 || parsed.sort !== sort || !["blog", "product"].includes(parsed.source ?? "") ||
      typeof parsed.value !== "string" || typeof parsed.id !== "string" || !/^[0-9a-f-]{36}$/i.test(parsed.id)) {
      throw new Error("invalid");
    }
    if (sort === "size" ? !/^\d+$/.test(parsed.value) : Number.isNaN(Date.parse(parsed.value))) throw new Error("invalid");
    return parsed as Cursor;
  } catch {
    throw new BadRequestException("The uploads cursor is invalid or no longer matches the selected sort");
  }
}

@Injectable()
export class AdminUploadsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminUploadsService.name);
  private timer?: NodeJS.Timeout;
  constructor(private readonly prisma: PrismaService, private readonly media: MediaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.runMaintenanceSafely(), 60 * 60 * 1000);
    this.timer.unref();
    setTimeout(() => void this.runMaintenanceSafely(), 15_000).unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async summary(): Promise<AdminUploadSummary> {
    const rows = await this.prisma.$queryRaw<Array<{
      asset_count: bigint; generated_storage_bytes: bigint; unlinked_count: bigint; trash_count: bigint; upcoming_purge_count: bigint;
    }>>(Prisma.sql`
      WITH inventory AS (
        SELECT a.id, a.trashed_at, a.purge_after,
          EXISTS (SELECT 1 FROM blog_revision_media r WHERE r.asset_id = a.id) AS linked,
          COALESCE((SELECT SUM(v.byte_size) FROM blog_media_variants v WHERE v.asset_id = a.id), 0) AS generated_bytes
        FROM blog_media_assets a
        UNION ALL
        SELECT a.id, a.trashed_at, a.purge_after, (a.product_id IS NOT NULL) AS linked,
          COALESCE((SELECT SUM(v.byte_size) FROM product_media_variants v WHERE v.asset_id = a.id), 0) AS generated_bytes
        FROM product_media_assets a
      )
      SELECT COUNT(*) AS asset_count, COALESCE(SUM(generated_bytes), 0) AS generated_storage_bytes,
        COUNT(*) FILTER (WHERE NOT linked AND trashed_at IS NULL) AS unlinked_count,
        COUNT(*) FILTER (WHERE trashed_at IS NOT NULL) AS trash_count,
        COUNT(*) FILTER (WHERE purge_after BETWEEN NOW() AND NOW() + INTERVAL '7 days') AS upcoming_purge_count
      FROM inventory
    `);
    const row = rows[0]!;
    return {
      assetCount: Number(row.asset_count), generatedStorageBytes: Number(row.generated_storage_bytes),
      unlinkedCount: Number(row.unlinked_count), trashCount: Number(row.trash_count), upcomingPurgeCount: Number(row.upcoming_purge_count)
    };
  }

  async list(query: AdminUploadsQueryDto): Promise<AdminUploadPage> {
    const cursor = query.cursor ? decodeUploadCursor(query.cursor, query.sort) : null;
    const search = query.search?.trim() ? `%${query.search.trim()}%` : null;
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    if (from && to && from > to) throw new BadRequestException("The upload date range is reversed");
    const conditions: Prisma.Sql[] = [];
    if (query.source !== "all") conditions.push(Prisma.sql`source = ${query.source}::media_asset_source`);
    if (query.state === "active") conditions.push(Prisma.sql`trashed_at IS NULL`);
    if (query.state === "trashed") conditions.push(Prisma.sql`trashed_at IS NOT NULL`);
    if (query.linked !== "all") conditions.push(Prisma.sql`link_state = ${query.linked}`);
    if (from) conditions.push(Prisma.sql`created_at >= ${from}`);
    if (to) conditions.push(Prisma.sql`created_at <= ${to}`);
    if (search) conditions.push(Prisma.sql`(id ILIKE ${search} OR original_filename ILIKE ${search} OR checksum ILIKE ${search} OR owner_name ILIKE ${search} OR COALESCE(owner_email, '') ILIKE ${search} OR COALESCE(linked_title, '') ILIKE ${search})`);
    if (cursor) {
      const op = query.sort === "oldest" ? Prisma.sql`>` : Prisma.sql`<`;
      const cursorValue = query.sort === "size" ? BigInt(cursor.value) : new Date(cursor.value);
      conditions.push(Prisma.sql`(sort_value, id, source::text) ${op} (${cursorValue}, ${cursor.id}, ${cursor.source})`);
    }
    const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
    const direction = query.sort === "oldest" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const sortExpression = query.sort === "size" ? Prisma.sql`generated_bytes` : Prisma.sql`created_at`;
    const rows = await this.prisma.$queryRaw<InventoryRow[]>(Prisma.sql`
      WITH unified AS (
        SELECT 'blog'::media_asset_source AS source, a.id, a.kind::text AS kind,
          CASE WHEN a.purging_at IS NOT NULL THEN 'purging' WHEN a.trashed_at IS NOT NULL THEN 'trashed' ELSE 'active' END AS state,
          CASE WHEN EXISTS (SELECT 1 FROM blog_revision_media r WHERE r.asset_id = a.id) THEN 'linked' ELSE 'unlinked' END AS link_state,
          a.original_filename, a.original_mime_type, a.width, a.height, a.byte_size AS source_bytes,
          COALESCE((SELECT SUM(v.byte_size) FROM blog_media_variants v WHERE v.asset_id = a.id), 0) AS generated_bytes,
          a.checksum, a.created_at, a.trashed_at, a.purge_after,
          (SELECT v.variant FROM blog_media_variants v WHERE v.asset_id = a.id ORDER BY v.byte_size ASC LIMIT 1) AS preview_variant,
          u.id AS owner_id, u.full_name AS owner_name, u.email AS owner_email,
          p.id AS linked_id, (SELECT t.title FROM blog_revision_translations t WHERE t.revision_id = p.working_revision_id AND t.title IS NOT NULL ORDER BY t.locale LIMIT 1) AS linked_title,
          CASE WHEN p.id IS NULL THEN NULL ELSE 'post' END AS linked_type
        FROM blog_media_assets a JOIN users u ON u.id = a.owner_user_id LEFT JOIN blog_posts p ON p.id = a.post_id
        UNION ALL
        SELECT 'product'::media_asset_source, a.id, 'product'::text,
          CASE WHEN a.purging_at IS NOT NULL THEN 'purging' WHEN a.trashed_at IS NOT NULL THEN 'trashed' ELSE 'active' END,
          CASE WHEN a.product_id IS NOT NULL THEN 'linked' ELSE 'unlinked' END,
          a.original_filename, a.original_mime_type, a.width, a.height, a.byte_size,
          COALESCE((SELECT SUM(v.byte_size) FROM product_media_variants v WHERE v.asset_id = a.id), 0),
          a.checksum, a.created_at, a.trashed_at, a.purge_after,
          (SELECT v.variant FROM product_media_variants v WHERE v.asset_id = a.id ORDER BY v.byte_size ASC LIMIT 1),
          u.id, u.full_name, u.email, p.id, p.title, CASE WHEN p.id IS NULL THEN NULL ELSE 'product' END
        FROM product_media_assets a JOIN users u ON u.id = a.uploaded_by_user_id LEFT JOIN products p ON p.id = COALESCE(a.product_id, a.restore_product_id)
      ), ranked AS (SELECT *, ${sortExpression} AS sort_value FROM unified)
      SELECT source, id, kind, state, link_state, original_filename, original_mime_type, width, height,
        source_bytes, generated_bytes, checksum, created_at, trashed_at, purge_after, preview_variant,
        owner_id, owner_name, owner_email, linked_id, linked_title, linked_type
      FROM ranked ${where}
      ORDER BY sort_value ${direction}, id ${direction}, source ${direction}
      LIMIT ${query.limit + 1}
    `);
    const hasMore = rows.length > query.limit;
    const pageRows = rows.slice(0, query.limit);
    const items = pageRows.map((row) => this.mapRow(row));
    const last = pageRows.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeUploadCursor({
        v: 1, sort: query.sort, value: query.sort === "size" ? String(last.generated_bytes) : last.created_at.toISOString(), id: last.id, source: last.source
      }) : null
    };
  }

  async detail(source: AdminUploadSource, id: string): Promise<AdminUploadDetail> {
    const detailQuery: AdminUploadsQueryDto = { limit: 50, source, state: "all", linked: "all", sort: "newest", search: id };
    const page = await this.list(detailQuery);
    const base = page.items.find((item) => item.id === id && item.source === source);
    if (!base) throw new NotFoundException("Upload was not found");
    const asset = source === "blog"
      ? await this.prisma.blog_media_assets.findUnique({ where: { id }, include: { variants: true, seller: { select: { id: true, shop_name: true } }, revision_references: { include: { revision: { include: { translations: true } } } } } })
      : await this.prisma.product_media_assets.findUnique({ where: { id }, include: {
        variants: true,
        product: { select: { id: true, title: true, media: { select: { id: true } }, created_by: { select: { id: true, shop_name: true } } } },
        restore_product: { select: { id: true, title: true, media: { select: { id: true } }, created_by: { select: { id: true, shop_name: true } } } },
        uploaded_by: true
      } });
    if (!asset) throw new NotFoundException("Upload was not found");
    const events = await this.prisma.media_admin_events.findMany({ where: { source, asset_id: id }, include: { actor: { select: { id: true, full_name: true } } }, orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 100 });
    const variants = asset.variants.map((variant) => ({ name: variant.variant, width: variant.width, height: variant.height, bytes: variant.byte_size, url: `/media/${id}/${variant.variant}.webp` }));
    const references = source === "blog" ? (asset as Awaited<ReturnType<typeof this.prisma.blog_media_assets.findUnique>> & any).revision_references.map((ref: any) => ({
      id: ref.revision_id,
      title: ref.revision.translations.find((item: any) => item.title)?.title ?? ref.revision_id,
      usage: ref.usage
    })) : [];
    const product = source === "product" ? ((asset as any).product ?? (asset as any).restore_product) : null;
    const purging = Boolean((asset as any).purging_at);
    const trashed = Boolean((asset as any).trashed_at);
    const restoration = !trashed ? { eligible: false, reason: "active" as const }
      : purging ? { eligible: false, reason: "purge_started" as const }
      : source === "blog" ? { eligible: true, reason: null }
      : !product ? { eligible: false, reason: "product_missing" as const }
      : product.media && product.media.id !== id ? { eligible: false, reason: "replacement_exists" as const }
      : { eligible: true, reason: null };
    return {
      ...base, variants,
      seller: source === "blog" && (asset as any).seller
        ? { id: (asset as any).seller.id, shopName: (asset as any).seller.shop_name }
        : source === "product" && product?.created_by
          ? { id: product.created_by.id, shopName: product.created_by.shop_name }
          : null,
      references, restoration,
      events: events.map((event) => ({ id: event.id, action: event.action, reason: event.reason, metadata: event.metadata as Record<string, unknown>, createdAt: event.created_at.toISOString(), actor: event.actor ? { id: event.actor.id, name: event.actor.full_name } : null }))
    };
  }

  async trash(items: AdminUploadRefDto[], reason: string, actorUserId: string): Promise<AdminUploadBulkResult> {
    return { results: await Promise.all(items.map((item) => this.resultFor(item, () => this.trashOne(item, reason.trim(), actorUserId)))) };
  }

  async restore(items: AdminUploadRefDto[], actorUserId: string): Promise<AdminUploadBulkResult> {
    return { results: await Promise.all(items.map((item) => this.resultFor(item, () => this.restoreOne(item, actorUserId)))) };
  }

  async runMaintenance() {
    await this.trashOrphanedBlogMedia();
    await this.purgeExpired();
  }

  private async runMaintenanceSafely() {
    try { await this.runMaintenance(); }
    catch { this.logger.error("Media maintenance failed; the next scheduled run will retry"); }
  }

  async trashOrphanedBlogMedia() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const assets = await this.prisma.blog_media_assets.findMany({ where: { trashed_at: null, published_at: null, post_id: null, created_at: { lt: cutoff }, revision_references: { none: {} } }, select: { id: true }, take: 500 });
    for (const asset of assets) await this.trashOne({ source: "blog", id: asset.id }, "Unused for more than 24 hours", null, true);
    return assets.length;
  }

  async purgeExpired() {
    const stale = new Date(Date.now() - CLAIM_STALE_MS);
    const [blog, product] = await Promise.all([
      this.prisma.blog_media_assets.findMany({ where: { purge_after: { lte: new Date() }, OR: [{ purging_at: null }, { purging_at: { lt: stale } }] }, select: { id: true }, take: 100 }),
      this.prisma.product_media_assets.findMany({ where: { purge_after: { lte: new Date() }, OR: [{ purging_at: null }, { purging_at: { lt: stale } }] }, select: { id: true }, take: 100 })
    ]);
    for (const item of [...blog.map(({ id }) => ({ source: "blog" as const, id })), ...product.map(({ id }) => ({ source: "product" as const, id }))]) await this.purgeOne(item);
    return blog.length + product.length;
  }

  private async trashOne(item: AdminUploadRefDto, reason: string, actorUserId: string | null, automatic = false) {
    const now = new Date(); const purgeAfter = new Date(now.getTime() + TRASH_DAYS * 86400_000);
    await this.prisma.$transaction(async (tx) => {
      if (item.source === "blog") {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM blog_media_assets WHERE id = ${item.id} FOR UPDATE`);
        const asset = await tx.blog_media_assets.findUnique({ where: { id: item.id }, select: { trashed_at: true, revision_references: { select: { revision_id: true }, take: 1 } } });
        if (!asset) throw new NotFoundException("Upload was not found");
        if (asset.trashed_at) return;
        if (asset.revision_references.length) throw new ConflictException("Referenced blog media cannot be moved to trash");
        await tx.blog_media_assets.update({ where: { id: item.id }, data: { trashed_at: now, purge_after: purgeAfter, trashed_by_user_id: actorUserId, purging_at: null } });
      } else {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM product_media_assets WHERE id = ${item.id} FOR UPDATE`);
        const asset = await tx.product_media_assets.findUnique({ where: { id: item.id }, select: { trashed_at: true, product_id: true } });
        if (!asset) throw new NotFoundException("Upload was not found");
        if (asset.trashed_at) return;
        await tx.product_media_assets.update({ where: { id: item.id }, data: { restore_product_id: asset.product_id, product_id: null, trashed_at: now, purge_after: purgeAfter, trashed_by_user_id: actorUserId, purging_at: null } });
      }
      await tx.media_admin_events.create({ data: { id: randomUUID(), source: item.source, asset_id: item.id, actor_user_id: actorUserId, action: automatic ? "auto_trashed" : "trashed", reason } });
    });
    return { purgeAfter: purgeAfter.toISOString() };
  }

  private async restoreOne(item: AdminUploadRefDto, actorUserId: string) {
    await this.prisma.$transaction(async (tx) => {
      if (item.source === "blog") {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM blog_media_assets WHERE id = ${item.id} FOR UPDATE`);
        const asset = await tx.blog_media_assets.findUnique({ where: { id: item.id }, select: { trashed_at: true, purging_at: true } });
        if (!asset) throw new NotFoundException("Upload was not found");
        if (!asset.trashed_at) return;
        if (asset.purging_at) throw new ConflictException("Purge has already started");
        await tx.blog_media_assets.update({ where: { id: item.id }, data: { trashed_at: null, trashed_by_user_id: null, purge_after: null, purging_at: null } });
      } else {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM product_media_assets WHERE id = ${item.id} FOR UPDATE`);
        const asset = await tx.product_media_assets.findUnique({ where: { id: item.id }, select: { trashed_at: true, purging_at: true, restore_product_id: true } });
        if (!asset) throw new NotFoundException("Upload was not found");
        if (!asset.trashed_at) return;
        if (asset.purging_at) throw new ConflictException("Purge has already started");
        if (!asset.restore_product_id) throw new ConflictException("The original product no longer exists");
        await tx.$queryRaw(Prisma.sql`SELECT id FROM products WHERE id = ${asset.restore_product_id} FOR UPDATE`);
        const product = await tx.products.findUnique({ where: { id: asset.restore_product_id }, select: { id: true, media: { select: { id: true } } } });
        if (!product) throw new ConflictException("The original product no longer exists");
        if (product.media && product.media.id !== item.id) throw new ConflictException("The product already has a replacement image");
        await tx.product_media_assets.update({ where: { id: item.id }, data: { product_id: product.id, restore_product_id: null, trashed_at: null, trashed_by_user_id: null, purge_after: null, purging_at: null } });
      }
      await tx.media_admin_events.create({ data: { id: randomUUID(), source: item.source, asset_id: item.id, actor_user_id: actorUserId, action: "restored" } });
    });
  }

  private async purgeOne(item: AdminUploadRefDto) {
    const now = new Date(); const stale = new Date(now.getTime() - CLAIM_STALE_MS);
    const model = item.source === "blog" ? this.prisma.blog_media_assets : this.prisma.product_media_assets;
    const claimed = await (model as any).updateMany({ where: { id: item.id, purge_after: { lte: now }, OR: [{ purging_at: null }, { purging_at: { lt: stale } }] }, data: { purging_at: now } });
    if (!claimed.count) return;
    const asset = await (model as any).findUnique({ where: { id: item.id }, select: { variants: { select: { path: true } } } });
    try {
      await this.prisma.$transaction(async (tx) => {
        // Backups hold the matching exclusive advisory lock while reading the
        // exported database snapshot and its referenced files.
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock_shared(${8204211947})`);
        await this.media.removeStoredFiles(asset?.variants.map((variant: { path: string }) => variant.path) ?? []);
        if (item.source === "blog") await tx.blog_media_assets.delete({ where: { id: item.id } });
        else await tx.product_media_assets.delete({ where: { id: item.id } });
        await tx.media_admin_events.create({ data: { id: randomUUID(), source: item.source, asset_id: item.id, action: "purged", reason: "30-day trash retention expired" } });
      });
    } catch (error) {
      await (model as any).updateMany({ where: { id: item.id, purging_at: now }, data: { purging_at: null } });
      const errorCode = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
        ? error.code
        : "UNKNOWN";
      await this.prisma.media_admin_events.create({ data: {
        id: randomUUID(), source: item.source, asset_id: item.id, action: "purge_failed",
        reason: "Filesystem removal failed", metadata: { errorCode }
      } });
    }
  }

  private async resultFor(item: AdminUploadRefDto, operation: () => Promise<{ purgeAfter?: string } | void>) {
    try { const value = await operation(); return { ...item, ok: true, status: 200, code: "ok", message: "Completed", ...value }; }
    catch (error) {
      const status = typeof (error as any)?.getStatus === "function" ? (error as any).getStatus() : 500;
      return {
        ...item, ok: false, status,
        code: status === 404 ? "not_found" : status === 409 ? "conflict" : "failed",
        message: status < 500 && error instanceof Error ? error.message : "Upload operation failed"
      };
    }
  }

  private mapRow(row: InventoryRow): AdminUploadListItem {
    return {
      source: row.source, id: row.id, kind: row.kind, state: row.state, linkState: row.link_state,
      originalFilename: row.original_filename, originalMimeType: row.original_mime_type,
      width: row.width, height: row.height, sourceBytes: row.source_bytes, generatedBytes: Number(row.generated_bytes), checksum: row.checksum,
      createdAt: row.created_at.toISOString(), trashedAt: row.trashed_at?.toISOString() ?? null, purgeAfter: row.purge_after?.toISOString() ?? null,
      previewUrl: row.preview_variant ? `/media/${row.id}/${row.preview_variant}.webp` : null,
      owner: { id: row.owner_id, name: row.owner_name, email: row.owner_email },
      linkedContent: row.linked_id && row.linked_title && row.linked_type ? { id: row.linked_id, title: row.linked_title, type: row.linked_type } : null
    };
  }
}
