import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppUser } from "@topgsm/shared-types";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve, sep } from "node:path";
import sharp from "sharp";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { BlogActor } from "../blog/blog-manage.guard";
import { MEDIA_BACKUP_LOCK } from "./media-backup-lock";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;
const MAX_DIMENSION = 8_192;
// Vector inputs are intentionally rejected. SVG decoders have a much broader
// attack surface (external references, XML features, and resource expansion)
// than the bounded raster formats accepted here.
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp"]);
const IMAGE_FORMAT_MIME_TYPES: Readonly<Record<string, string>> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

const PRODUCT_VARIANTS: VariantSpec[] = [
  { name: "thumb", width: 640, height: 640, fit: "cover" },
  { name: "large", width: 1400, height: 1400, fit: "cover" }
];
const SELLER_PROFILE_SIZE = 640;

type VariantSpec = {
  name: string;
  width: number;
  height?: number;
  fit: "cover" | "inside";
};

@Injectable()
export class MediaService {
  private readonly root: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService
  ) {
    const configured = config.get<string>("MEDIA_ROOT")?.trim() || "var/media";
    this.root = isAbsolute(configured) ? resolve(configured) : resolve(process.cwd(), configured);
  }

  async upload(
    actor: BlogActor,
    file: Express.Multer.File | undefined,
    options: { kind: "cover" | "inline"; focalX: number; focalY: number }
  ) {
    const { buffer, metadata, mimeType, originalFilename } = await this.validateImageUpload(file);

    const id = randomUUID();
    const relativeDirectory = join("blog", id.slice(0, 2), id.slice(2, 4), id);
    const directory = this.safePath(relativeDirectory);
    await mkdir(directory, { recursive: true });
    const specs: VariantSpec[] = options.kind === "cover"
      ? [
          { name: "wide", width: 1600, height: 900, fit: "cover" },
          { name: "classic", width: 1200, height: 900, fit: "cover" },
          { name: "square", width: 960, height: 960, fit: "cover" }
        ]
      : [
          { name: "sm", width: 480, fit: "inside" },
          { name: "md", width: 960, fit: "inside" },
          { name: "lg", width: 1440, fit: "inside" }
        ];
    const written: string[] = [];
    const temporary: string[] = [];
    try {
      const variants = [];
      for (const spec of specs) {
        const finalPath = this.safePath(join(relativeDirectory, `${spec.name}.webp`));
        const temporaryPath = `${finalPath}.${randomUUID()}.tmp`;
        temporary.push(temporaryPath);
        const pipeline = sharp(buffer, {
          failOn: "error",
          animated: false,
          limitInputPixels: MAX_PIXELS
        }).rotate();
        const position = options.kind === "cover"
          ? this.focalPosition(options.focalX, options.focalY)
          : "centre";
        const output = await pipeline
          .resize({
            width: spec.width,
            height: spec.height,
            fit: spec.fit,
            position,
            withoutEnlargement: spec.fit === "inside"
          })
          .webp({ quality: 84, effort: 5 })
          .toBuffer({ resolveWithObject: true });
        await writeFile(temporaryPath, output.data, { flag: "wx" });
        await rename(temporaryPath, finalPath);
        temporary.splice(temporary.indexOf(temporaryPath), 1);
        written.push(finalPath);
        variants.push({
          variant: spec.name,
          width: output.info.width,
          height: output.info.height,
          byte_size: output.info.size,
          path: join(relativeDirectory, `${spec.name}.webp`).replaceAll("\\", "/")
        });
      }
      const checksum = createHash("sha256").update(buffer).digest("hex");
      const asset = await this.prisma.blog_media_assets.create({
        data: {
          id,
          owner_user_id: actor.user.id,
          seller_id: actor.type === "seller" ? actor.sellerId : null,
          kind: options.kind,
          width: metadata.width,
          height: metadata.height,
          byte_size: buffer.length,
          checksum,
          original_filename: originalFilename,
          original_mime_type: mimeType,
          variants: { create: variants }
        },
        include: { variants: true }
      });
      return {
        id: asset.id,
        kind: asset.kind,
        width: asset.width,
        height: asset.height,
        variants: asset.variants.map((variant) => ({
          name: variant.variant,
          url: `/media/${asset.id}/${variant.variant}.webp`,
          width: variant.width,
          height: variant.height
        }))
      };
    } catch (error) {
      await Promise.all([...written, ...temporary].map((path) => rm(path, { force: true })));
      throw error;
    }
  }

  async uploadProductImage(
    productId: string,
    actorUserId: string,
    sellerId: string | null,
    file: Express.Multer.File | undefined
  ) {
    const product = await this.prisma.products.findFirst({
      where: {
        id: productId,
        ...(sellerId ? { created_by_seller_id: sellerId } : {})
      },
      select: { id: true }
    });
    if (!product) throw new NotFoundException("Product was not found");

    const { buffer, metadata, mimeType, originalFilename } = await this.validateImageUpload(file);
    const id = randomUUID();
    const relativeDirectory = join("products", id.slice(0, 2), id.slice(2, 4), id);
    const directory = this.safePath(relativeDirectory);
    await mkdir(directory, { recursive: true });
    const written: string[] = [];
    const temporary: string[] = [];

    try {
      const variants: Array<{
        variant: string;
        width: number;
        height: number;
        byte_size: number;
        path: string;
      }> = [];
      for (const spec of PRODUCT_VARIANTS) {
        const finalPath = this.safePath(join(relativeDirectory, `${spec.name}.webp`));
        const temporaryPath = `${finalPath}.${randomUUID()}.tmp`;
        temporary.push(temporaryPath);
        const output = await sharp(buffer, {
          failOn: "error",
          animated: false,
          limitInputPixels: MAX_PIXELS
        })
          .rotate()
          .resize({
            width: spec.width,
            height: spec.height,
            fit: spec.fit,
            position: "centre",
            withoutEnlargement: false
          })
          .webp({ quality: 86, effort: 5 })
          .toBuffer({ resolveWithObject: true });
        await writeFile(temporaryPath, output.data, { flag: "wx" });
        await rename(temporaryPath, finalPath);
        temporary.splice(temporary.indexOf(temporaryPath), 1);
        written.push(finalPath);
        variants.push({
          variant: spec.name,
          width: output.info.width,
          height: output.info.height,
          byte_size: output.info.size,
          path: join(relativeDirectory, `${spec.name}.webp`).replaceAll("\\", "/")
        });
      }

      const checksum = createHash("sha256").update(buffer).digest("hex");
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${productId}::uuid FOR UPDATE`);
        const ownedProduct = await tx.products.findFirst({
          where: { id: productId, ...(sellerId ? { created_by_seller_id: sellerId } : {}) },
          select: { id: true }
        });
        if (!ownedProduct) throw new NotFoundException("Product was not found");
        const old = await tx.product_media_assets.findUnique({
          where: { product_id: productId },
          select: { id: true }
        });
        if (old) {
          const trashedAt = new Date();
          await tx.product_media_assets.update({ where: { id: old.id }, data: {
            product_id: null, restore_product_id: productId, trashed_at: trashedAt,
            trashed_by_user_id: actorUserId,
            purge_after: new Date(trashedAt.getTime() + 30 * 86400_000)
          } });
          await tx.media_admin_events.create({ data: {
            id: randomUUID(), source: "product", asset_id: old.id,
            actor_user_id: actorUserId, action: "trashed", reason: "Replaced by a newer product image"
          } });
        }
        await tx.product_media_assets.create({
          data: {
            id,
            product_id: productId,
            uploaded_by_user_id: actorUserId,
            width: metadata.width!,
            height: metadata.height!,
            byte_size: buffer.length,
            checksum,
            original_filename: originalFilename,
            original_mime_type: mimeType,
            variants: { create: variants }
          }
        });
      });
      return this.productImage(id, variants);
    } catch (error) {
      await Promise.all([...written, ...temporary].map((path) => rm(path, { force: true })));
      throw error;
    }
  }

  async deleteProductImage(productId: string, sellerId: string | null, actorUserId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${productId}::uuid FOR UPDATE`);
      const product = await tx.products.findFirst({
        where: { id: productId, ...(sellerId ? { created_by_seller_id: sellerId } : {}) },
        select: { id: true }
      });
      if (!product) throw new NotFoundException("Product was not found");
      const asset = await tx.product_media_assets.findUnique({
        where: { product_id: productId },
        select: { id: true }
      });
      if (!asset) throw new NotFoundException("Product image was not found");
      const trashedAt = new Date();
      await tx.product_media_assets.update({ where: { id: asset.id }, data: {
        product_id: null, restore_product_id: productId, trashed_at: trashedAt,
        trashed_by_user_id: actorUserId,
        purge_after: new Date(trashedAt.getTime() + 30 * 86400_000)
      } });
      await tx.media_admin_events.create({ data: {
        id: randomUUID(), source: "product", asset_id: asset.id,
        actor_user_id: actorUserId, action: "trashed", reason: "Product image removed"
      } });
    });
    return { deleted: true, recoverable: true };
  }

  async uploadSellerProfilePicture(
    sellerId: string,
    actorUserId: string,
    membershipRole: "admin" | "staff",
    file: Express.Multer.File | undefined
  ) {
    if (membershipRole !== "admin") {
      throw new ForbiddenException("Only a seller administrator can edit the public profile");
    }
    const seller = await this.prisma.sellers.findFirst({
      where: { id: sellerId, invited: false, approved: true, suspended_at: null },
      select: { id: true }
    });
    if (!seller) throw new NotFoundException("Seller was not found");

    const { buffer, mimeType, originalFilename } = await this.validateImageUpload(file);
    const id = randomUUID();
    const relativePath = join("sellers", sellerId, "profile", `${id}.webp`).replaceAll("\\", "/");
    const finalPath = this.safePath(relativePath);
    const temporaryPath = `${finalPath}.${randomUUID()}.tmp`;
    await mkdir(this.safePath(join("sellers", sellerId, "profile")), { recursive: true });
    let oldPath: string | null = null;
    try {
      const output = await sharp(buffer, {
        failOn: "error",
        animated: false,
        limitInputPixels: MAX_PIXELS
      })
        .rotate()
        .resize({
          width: SELLER_PROFILE_SIZE,
          height: SELLER_PROFILE_SIZE,
          fit: "cover",
          position: "centre",
          withoutEnlargement: false
        })
        .webp({ quality: 86, effort: 5 })
        .toBuffer({ resolveWithObject: true });
      await writeFile(temporaryPath, output.data, { flag: "wx" });
      await rename(temporaryPath, finalPath);
      const checksum = createHash("sha256").update(output.data).digest("hex");

      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock_shared(${MEDIA_BACKUP_LOCK})`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "sellers" WHERE "id" = ${sellerId} FOR UPDATE`);
        const editableSeller = await tx.sellers.findFirst({
          where: { id: sellerId, invited: false, approved: true, suspended_at: null },
          select: { id: true }
        });
        if (!editableSeller) throw new NotFoundException("Seller was not found");
        const old = await tx.seller_profile_media_assets.findUnique({
          where: { seller_id: sellerId },
          select: { id: true, path: true }
        });
        oldPath = old?.path ?? null;
        if (old) await tx.seller_profile_media_assets.delete({ where: { id: old.id } });
        await tx.seller_profile_media_assets.create({
          data: {
            id,
            seller_id: sellerId,
            uploaded_by_user_id: actorUserId,
            width: output.info.width,
            height: output.info.height,
            byte_size: output.info.size,
            checksum,
            path: relativePath,
            original_filename: originalFilename,
            original_mime_type: mimeType
          }
        });
      });
      if (oldPath && oldPath !== relativePath) {
        await rm(this.safePath(oldPath), { force: true }).catch(() => undefined);
      }
      return this.sellerProfilePicture(id, output.info.width, output.info.height);
    } catch (error) {
      await Promise.all([
        rm(finalPath, { force: true }),
        rm(temporaryPath, { force: true })
      ]);
      throw error;
    }
  }

  async deleteSellerProfilePicture(
    sellerId: string,
    membershipRole: "admin" | "staff"
  ) {
    if (membershipRole !== "admin") {
      throw new ForbiddenException("Only a seller administrator can edit the public profile");
    }
    let path: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock_shared(${MEDIA_BACKUP_LOCK})`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "sellers" WHERE "id" = ${sellerId} FOR UPDATE`);
      const seller = await tx.sellers.findFirst({
        where: { id: sellerId, invited: false, approved: true, suspended_at: null },
        select: { id: true }
      });
      if (!seller) throw new NotFoundException("Seller was not found");
      const asset = await tx.seller_profile_media_assets.findUnique({
        where: { seller_id: sellerId },
        select: { id: true, path: true }
      });
      if (!asset) throw new NotFoundException("Profile picture was not found");
      path = asset.path;
      await tx.seller_profile_media_assets.delete({ where: { id: asset.id } });
    });
    if (path) await rm(this.safePath(path), { force: true }).catch(() => undefined);
    return { deleted: true };
  }

  async get(assetId: string, variantName: string, user?: AppUser) {
    if (variantName === "profile") return this.getSellerProfilePicture(assetId, user);
    const asset = await this.prisma.blog_media_assets.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        owner_user_id: true,
        published_at: true,
        trashed_at: true,
        checksum: true,
        variants: { where: { variant: variantName }, select: { path: true } }
      }
    });
    const variant = asset?.variants[0];
    if (!asset || !variant) {
      if (variantName.startsWith("story-")) return this.getHomepageStoryImage(assetId, variantName, user);
      return this.getProductImage(assetId, variantName, user);
    }
    const uploadsManager = user?.role === "platform-admin" || (
      user?.role === "platform-staff" && user.platformPermissions?.includes("uploads_manage")
    );
    if (asset.trashed_at && !uploadsManager) throw new NotFoundException("Media asset was not found");
    if (
      !asset.published_at &&
      asset.owner_user_id !== user?.id &&
      user?.role !== "platform-admin" &&
      !(user?.role === "platform-staff" && user.platformPermissions?.includes("blog_manage"))
    ) {
      throw new ForbiddenException("Media asset is private");
    }
    const path = this.safePath(variant.path);
    try {
      return {
        buffer: await readFile(path),
        etag: `"${createHash("sha256").update(`${asset.checksum}:${variantName}`).digest("hex")}"`,
        published: Boolean(asset.published_at)
      };
    } catch {
      throw new NotFoundException("Media asset file was not found");
    }
  }

  private async getProductImage(assetId: string, variantName: string, user?: AppUser) {
    const asset = await this.prisma.product_media_assets.findUnique({
      where: { id: assetId },
      select: {
        uploaded_by_user_id: true,
        checksum: true,
        trashed_at: true,
        product: { select: { status: true, created_by_seller_id: true } },
        variants: { where: { variant: variantName }, select: { path: true } }
      }
    });
    const variant = asset?.variants[0];
    if (!asset || !variant) throw new NotFoundException("Media asset was not found");
    const uploadsManager = user?.role === "platform-admin" || (
      user?.role === "platform-staff" && user.platformPermissions?.includes("uploads_manage")
    );
    if (asset.trashed_at && !uploadsManager) throw new NotFoundException("Media asset was not found");
    const published = Boolean(!asset.trashed_at && asset.product?.status === "active");
    let sellerCanRead = false;
    if (!published && user && (user.role === "seller-admin" || user.role === "seller-staff")) {
      sellerCanRead = Boolean(await this.prisma.seller_memberships.findFirst({
        where: {
          user_id: user.id,
          active: true,
          seller_id: asset.product?.created_by_seller_id ?? "",
          seller: {
            invited: false,
            approved: true,
            suspended_at: null,
            permissions: { some: { permission: "products_manage" } }
          }
        },
        select: { user_id: true }
      }));
    }
    const platformCanRead = user?.role === "platform-admin" || (
      user?.role === "platform-staff" && user.platformPermissions?.includes("catalog_view")
    );
    if (!published && asset.uploaded_by_user_id !== user?.id && !platformCanRead && !sellerCanRead) {
      throw new ForbiddenException("Media asset is private");
    }
    try {
      return {
        buffer: await readFile(this.safePath(variant.path)),
        etag: `"${createHash("sha256").update(`${asset.checksum}:${variantName}`).digest("hex")}"`,
        published
      };
    } catch {
      throw new NotFoundException("Media asset file was not found");
    }
  }

  private async getHomepageStoryImage(assetId: string, variantName: string, user?: AppUser) {
    const story = await this.prisma.homepage_stories.findUnique({
      where: { id: assetId },
      select: { enabled: true, image_checksum: true, image_path: true }
    });
    if (!story) throw new NotFoundException("Media asset was not found");
    if (variantName !== `story-${story.image_checksum.slice(0, 12)}`) throw new NotFoundException("Media asset was not found");
    const canPreview = user?.role === "platform-admin";
    if (!story.enabled && !canPreview) throw new NotFoundException("Media asset was not found");
    try {
      return {
        buffer: await readFile(this.safePath(story.image_path)),
        etag: `"${createHash("sha256").update(`${story.image_checksum}:${variantName}`).digest("hex")}"`,
        published: story.enabled
      };
    } catch {
      throw new NotFoundException("Media asset file was not found");
    }
  }

  private async getSellerProfilePicture(assetId: string, user?: AppUser) {
    const asset = await this.prisma.seller_profile_media_assets.findUnique({
      where: { id: assetId },
      select: {
        uploaded_by_user_id: true,
        checksum: true,
        path: true,
        seller: { select: { invited: true, approved: true, suspended_at: true } }
      }
    });
    if (!asset) throw new NotFoundException("Media asset was not found");
    const published = !asset.seller.invited && asset.seller.approved && !asset.seller.suspended_at;
    const platformCanRead = user?.role === "platform-admin" || (
      user?.role === "platform-staff" && user.platformPermissions?.includes("vendors_manage")
    );
    if (!published && asset.uploaded_by_user_id !== user?.id && !platformCanRead) {
      throw new ForbiddenException("Media asset is private");
    }
    try {
      return {
        buffer: await readFile(this.safePath(asset.path)),
        etag: `"${asset.checksum}"`,
        published
      };
    } catch {
      throw new NotFoundException("Media asset file was not found");
    }
  }

  async removeStoredFiles(relativePaths: string[]) {
    await Promise.all(relativePaths.map((path) => rm(this.safePath(path), { force: true })));
  }

  private safePath(relativePath: string) {
    const full = resolve(this.root, relativePath);
    if (full !== this.root && !full.startsWith(`${this.root}${sep}`)) {
      throw new BadRequestException("Invalid media path");
    }
    return full;
  }

  private focalPosition(x: number, y: number) {
    const horizontal = x < 0.34 ? "west" : x > 0.66 ? "east" : "";
    const vertical = y < 0.34 ? "north" : y > 0.66 ? "south" : "";
    return `${vertical}${horizontal}` || "centre";
  }

  private async validateImageUpload(file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException("A JPEG, PNG, or WebP image is required");
    if (file.buffer.length > MAX_BYTES) throw new BadRequestException("Image exceeds the 8 MiB limit");
    const mimeType = file.mimetype.toLowerCase().split(";", 1)[0]?.trim();
    if (!mimeType || !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException("Only JPEG, PNG, or WebP images are accepted");
    }
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(file.buffer, {
        failOn: "error",
        animated: false,
        limitInputPixels: MAX_PIXELS
      }).metadata();
    } catch {
      throw new BadRequestException("Image could not be decoded safely");
    }
    if (
      !metadata.width || !metadata.height ||
      !ALLOWED_IMAGE_FORMATS.has(metadata.format ?? "") ||
      IMAGE_FORMAT_MIME_TYPES[metadata.format ?? ""] !== mimeType ||
      metadata.pages && metadata.pages > 1 ||
      metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION ||
      metadata.width * metadata.height > MAX_PIXELS
    ) {
      throw new BadRequestException("Only static JPEG, PNG, or WebP images within the dimension limit are accepted");
    }
    return { buffer: file.buffer, metadata, mimeType, originalFilename: normalizeOriginalFilename(file.originalname) };
  }

  private productImage(id: string, variants: Array<{ variant: string; width: number; height: number }>) {
    return {
      id,
      variants: variants.map((variant) => ({
        name: variant.variant,
        url: `/media/${id}/${variant.variant}.webp`,
        width: variant.width,
        height: variant.height
      }))
    };
  }

  private sellerProfilePicture(id: string, width: number, height: number) {
    return { id, url: `/media/${id}/profile.webp`, width, height };
  }
}

export function normalizeOriginalFilename(value: string | undefined) {
  if (!value) return null;
  const normalized = basename(value.replaceAll("\\", "/")).normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .trim();
  return normalized ? Array.from(normalized).slice(0, 255).join("") : null;
}
