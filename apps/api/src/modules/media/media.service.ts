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
import { PrismaService } from "../../prisma/prisma.service";
import type { BlogActor } from "../blog/blog-manage.guard";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;
const MAX_DIMENSION = 8_192;

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
    if (!file?.buffer?.length) throw new BadRequestException("A WebP image is required");
    if (file.buffer.length > MAX_BYTES) throw new BadRequestException("Image exceeds the 8 MiB limit");

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
      metadata.format !== "webp" ||
      !metadata.width ||
      !metadata.height ||
      metadata.pages && metadata.pages > 1 ||
      metadata.width > MAX_DIMENSION ||
      metadata.height > MAX_DIMENSION ||
      metadata.width * metadata.height > MAX_PIXELS
    ) {
      throw new BadRequestException("Only static WebP images within the dimension limit are accepted");
    }

    const id = randomUUID();
    const relativeDirectory = join(id.slice(0, 2), id.slice(2, 4), id);
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
        const pipeline = sharp(file.buffer, {
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
      const checksum = createHash("sha256").update(file.buffer).digest("hex");
      const asset = await this.prisma.blog_media_assets.create({
        data: {
          id,
          owner_user_id: actor.user.id,
          seller_id: actor.type === "seller" ? actor.sellerId : null,
          kind: options.kind,
          width: metadata.width,
          height: metadata.height,
          byte_size: file.buffer.length,
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
    if (!asset || !variant) throw new NotFoundException("Media asset was not found");
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
}
