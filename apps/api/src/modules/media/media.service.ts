import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppUser } from "@topgsm/shared-types";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";
import sharp from "sharp";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { BlogActor } from "../blog/blog-manage.guard";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;
const MAX_DIMENSION = 8_192;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/webp", "image/svg+xml"]);
const ALLOWED_IMAGE_FORMATS = new Set(["webp", "svg"]);

const PRODUCT_VARIANTS: VariantSpec[] = [
  { name: "thumb", width: 640, height: 640, fit: "cover" },
  { name: "large", width: 1400, height: 1400, fit: "cover" }
];

type VariantSpec = {
  name: string;
  width: number;
  height?: number;
  fit: "cover" | "inside";
};

@Injectable()
export class MediaService implements OnModuleInit, OnModuleDestroy {
  private readonly root: string;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService
  ) {
    const configured = config.get<string>("MEDIA_ROOT")?.trim() || "var/media";
    this.root = isAbsolute(configured) ? resolve(configured) : resolve(process.cwd(), configured);
  }

  onModuleInit() {
    this.cleanupTimer = setInterval(() => void this.cleanupOrphans(), 60 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async upload(
    actor: BlogActor,
    file: Express.Multer.File | undefined,
    options: { kind: "cover" | "inline"; focalX: number; focalY: number }
  ) {
    const { buffer, metadata } = await this.validateImageUpload(file);

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

    const { buffer, metadata } = await this.validateImageUpload(file);
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
      const previous = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${productId} FOR UPDATE`);
        const ownedProduct = await tx.products.findFirst({
          where: { id: productId, ...(sellerId ? { created_by_seller_id: sellerId } : {}) },
          select: { id: true }
        });
        if (!ownedProduct) throw new NotFoundException("Product was not found");
        const old = await tx.product_media_assets.findUnique({
          where: { product_id: productId },
          select: { id: true, variants: { select: { path: true } } }
        });
        if (old) await tx.product_media_assets.delete({ where: { id: old.id } });
        await tx.product_media_assets.create({
          data: {
            id,
            product_id: productId,
            uploaded_by_user_id: actorUserId,
            width: metadata.width!,
            height: metadata.height!,
            byte_size: buffer.length,
            checksum,
            variants: { create: variants }
          }
        });
        return old;
      });
      if (previous) {
        await Promise.allSettled(previous.variants.map((variant) => rm(this.safePath(variant.path), { force: true })));
      }
      return this.productImage(id, variants);
    } catch (error) {
      await Promise.all([...written, ...temporary].map((path) => rm(path, { force: true })));
      throw error;
    }
  }

  async deleteProductImage(productId: string, sellerId: string | null) {
    const previous = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${productId} FOR UPDATE`);
      const product = await tx.products.findFirst({
        where: { id: productId, ...(sellerId ? { created_by_seller_id: sellerId } : {}) },
        select: { id: true }
      });
      if (!product) throw new NotFoundException("Product was not found");
      const asset = await tx.product_media_assets.findUnique({
        where: { product_id: productId },
        select: { id: true, variants: { select: { path: true } } }
      });
      if (!asset) throw new NotFoundException("Product image was not found");
      await tx.product_media_assets.delete({ where: { id: asset.id } });
      return asset;
    });
    await Promise.allSettled(previous.variants.map((variant) => rm(this.safePath(variant.path), { force: true })));
    return { deleted: true };
  }

  async get(assetId: string, variantName: string, user?: AppUser) {
    const asset = await this.prisma.blog_media_assets.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        owner_user_id: true,
        published_at: true,
        checksum: true,
        variants: { where: { variant: variantName }, select: { path: true } }
      }
    });
    const variant = asset?.variants[0];
    if (!asset || !variant) return this.getProductImage(assetId, variantName, user);
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
        product: { select: { status: true, created_by_seller_id: true } },
        variants: { where: { variant: variantName }, select: { path: true } }
      }
    });
    const variant = asset?.variants[0];
    if (!asset || !variant) throw new NotFoundException("Media asset was not found");
    const published = asset.product.status === "active";
    let sellerCanRead = false;
    if (!published && user && (user.role === "seller-admin" || user.role === "seller-staff")) {
      sellerCanRead = Boolean(await this.prisma.seller_memberships.findFirst({
        where: {
          user_id: user.id,
          active: true,
          seller_id: asset.product.created_by_seller_id,
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

  async cleanupOrphans() {
    const assets = await this.prisma.blog_media_assets.findMany({
      where: {
        published_at: null,
        post_id: null,
        created_at: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      select: { id: true, variants: { select: { path: true } } },
      take: 500
    });
    for (const asset of assets) {
      await this.prisma.blog_media_assets.delete({ where: { id: asset.id } });
      await Promise.all(asset.variants.map((variant) => rm(this.safePath(variant.path), { force: true })));
    }
    return assets.length;
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
    if (!file?.buffer?.length) throw new BadRequestException("A WebP or SVG image is required");
    if (file.buffer.length > MAX_BYTES) throw new BadRequestException("Image exceeds the 8 MiB limit");
    const mimeType = file.mimetype.toLowerCase().split(";", 1)[0]?.trim();
    if (!mimeType || !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException("Only WebP or SVG images are accepted");
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
      metadata.pages && metadata.pages > 1 ||
      metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION ||
      metadata.width * metadata.height > MAX_PIXELS
    ) {
      throw new BadRequestException("Only static WebP or SVG images within the dimension limit are accepted");
    }
    return { buffer: file.buffer, metadata };
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
}
