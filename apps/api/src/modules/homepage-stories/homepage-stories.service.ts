import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve, sep } from "node:path";
import sharp from "sharp";
import { PrismaService } from "../../prisma/prisma.service";
import type { HomepageStoriesQueryDto, SaveHomepageStoryDto } from "./dto/homepage-story.dto";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const MAX_DIMENSION = 8_192;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

@Injectable()
export class HomepageStoriesService {
  private readonly root: string;

  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    const configured = config.get<string>("MEDIA_ROOT")?.trim() || "var/media";
    this.root = isAbsolute(configured) ? resolve(configured) : resolve(process.cwd(), configured);
  }

  async listPublic(query: HomepageStoriesQueryDto) {
    const rows = await this.prisma.homepage_stories.findMany({
      where: { locale: query.locale, enabled: true },
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
      take: 20
    });
    return rows.map((row) => this.toResponse(row));
  }

  async listAdmin(query: HomepageStoriesQueryDto) {
    const rows = await this.prisma.homepage_stories.findMany({
      where: { locale: query.locale },
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
      take: 50
    });
    return rows.map((row) => this.toResponse(row));
  }

  async create(actorUserId: string, input: SaveHomepageStoryDto, file: Express.Multer.File | undefined) {
    const id = randomUUID();
    const image = await this.writeImage(id, file);
    try {
      const row = await this.prisma.homepage_stories.create({
        data: {
          id,
          locale: input.locale,
          title: normalizedTitle(input.title),
          target_url: normalizeStoryTargetUrl(input.targetUrl),
          position: input.position,
          enabled: input.enabled,
          ...image.data,
          created_by_id: actorUserId,
          updated_by_id: actorUserId
        }
      });
      return this.toResponse(row);
    } catch (error) {
      await rm(image.absolutePath, { force: true });
      throw error;
    }
  }

  async update(id: string, actorUserId: string, input: SaveHomepageStoryDto, file: Express.Multer.File | undefined) {
    const current = await this.prisma.homepage_stories.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Homepage story was not found");
    const replacement = file ? await this.writeImage(id, file) : null;
    try {
      const row = await this.prisma.homepage_stories.update({
        where: { id },
        data: {
          locale: input.locale,
          title: normalizedTitle(input.title),
          target_url: normalizeStoryTargetUrl(input.targetUrl),
          position: input.position,
          enabled: input.enabled,
          ...(replacement?.data ?? {}),
          updated_by_id: actorUserId
        }
      });
      if (replacement && replacement.data.image_path !== current.image_path) {
        await rm(this.safePath(current.image_path), { force: true }).catch(() => undefined);
      }
      return this.toResponse(row);
    } catch (error) {
      if (replacement) await rm(replacement.absolutePath, { force: true });
      throw error;
    }
  }

  async remove(id: string) {
    const current = await this.prisma.homepage_stories.findUnique({ where: { id }, select: { image_path: true } });
    if (!current) throw new NotFoundException("Homepage story was not found");
    await this.prisma.homepage_stories.delete({ where: { id } });
    await rm(this.safePath(current.image_path), { force: true }).catch(() => undefined);
    return { deleted: true };
  }

  private async writeImage(id: string, file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException("A story image is required");
    if (file.buffer.length > MAX_BYTES) throw new BadRequestException("Image exceeds the 5 MiB limit");
    const mimeType = file.mimetype.toLowerCase().split(";", 1)[0]?.trim();
    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException("Only JPEG, PNG, or WebP images are accepted");
    }
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(file.buffer, { failOn: "error", animated: false, limitInputPixels: MAX_PIXELS }).metadata();
    } catch {
      throw new BadRequestException("Image could not be decoded safely");
    }
    if (!metadata.width || !metadata.height || !ALLOWED_FORMATS.has(metadata.format ?? "") ||
      metadata.pages && metadata.pages > 1 || metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION ||
      metadata.width * metadata.height > MAX_PIXELS) {
      throw new BadRequestException("Only static images within the dimension limit are accepted");
    }

    const relativeDirectory = join("stories", id.slice(0, 2), id.slice(2, 4), id);
    const relativePath = join(relativeDirectory, `${randomUUID()}.webp`).replaceAll("\\", "/");
    const directory = this.safePath(relativeDirectory);
    const absolutePath = this.safePath(relativePath);
    const temporaryPath = `${absolutePath}.${randomUUID()}.tmp`;
    await mkdir(directory, { recursive: true });
    try {
      const output = await sharp(file.buffer, { failOn: "error", animated: false, limitInputPixels: MAX_PIXELS })
        .rotate()
        .resize({ width: 512, height: 512, fit: "cover", position: "centre" })
        .webp({ quality: 86, effort: 5 })
        .toBuffer({ resolveWithObject: true });
      await writeFile(temporaryPath, output.data, { flag: "wx" });
      await rename(temporaryPath, absolutePath);
      return {
        absolutePath,
        data: {
          image_path: relativePath,
          image_width: output.info.width,
          image_height: output.info.height,
          image_byte_size: output.info.size,
          image_checksum: createHash("sha256").update(output.data).digest("hex"),
          original_filename: normalizeFilename(file.originalname),
          original_mime_type: mimeType
        }
      };
    } catch (error) {
      await Promise.all([temporaryPath, absolutePath].map((path) => rm(path, { force: true })));
      throw error;
    }
  }

  private safePath(relativePath: string) {
    const full = resolve(this.root, relativePath);
    if (full !== this.root && !full.startsWith(`${this.root}${sep}`)) throw new BadRequestException("Invalid media path");
    return full;
  }

  private toResponse(row: { id: string; locale: string; title: string; target_url: string; position: number; enabled: boolean; image_width: number; image_height: number; image_checksum: string; created_at: Date; updated_at: Date }) {
    return {
      id: row.id,
      locale: row.locale,
      title: row.title,
      targetUrl: row.target_url,
      position: row.position,
      enabled: row.enabled,
      image: { url: `/media/${row.id}/story-${row.image_checksum.slice(0, 12)}.webp`, width: row.image_width, height: row.image_height },
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }
}

function normalizedTitle(value: string) {
  const title = value.trim();
  if (!title) throw new BadRequestException("Story title is required");
  return title;
}

export function normalizeStoryTargetUrl(value: string) {
  const target = value.trim();
  if (target.startsWith("/") && !target.startsWith("//")) {
    const parsed = new URL(target, "https://topgsm.invalid");
    if (parsed.origin !== "https://topgsm.invalid") throw new BadRequestException("Invalid story destination URL");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported protocol");
    if (parsed.username || parsed.password) throw new Error("embedded credentials");
    return parsed.toString();
  } catch {
    throw new BadRequestException("Story destination must be an HTTP(S) URL or a site-relative path");
  }
}

function normalizeFilename(value: string | undefined) {
  if (!value) return null;
  const normalized = basename(value.replaceAll("\\", "/")).normalize("NFKC").replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
  return normalized ? Array.from(normalized).slice(0, 255).join("") : null;
}
