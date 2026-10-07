import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import sharp from "sharp";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { MEDIA_BACKUP_LOCK } from "../media/media-backup-lock";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES: Readonly<Record<string, string>> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;

export function profilePictureUrl(userId: string, key: string | null | undefined) {
  return key ? `/user-pictures/${userId}/picture.webp?v=${key}` : null;
}

@Injectable()
export class ProfilePictureService {
  private readonly root: string;
  private readonly logger = new Logger(ProfilePictureService.name);

  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    const configured = config.get<string>("MEDIA_ROOT")?.trim() || "var/media";
    this.root = isAbsolute(configured) ? resolve(configured) : resolve(process.cwd(), configured);
  }

  async upload(userId: string, file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException("A JPEG, PNG, or WebP image is required");
    if (file.buffer.length > MAX_BYTES) throw new BadRequestException("Image exceeds the 8 MiB limit");
    const mime = file.mimetype.toLowerCase().split(";", 1)[0]?.trim();
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(file.buffer, { failOn: "error", animated: false, limitInputPixels: MAX_PIXELS }).metadata();
    } catch {
      throw new BadRequestException("Image could not be decoded safely");
    }
    if (!metadata.width || !metadata.height || !metadata.format || TYPES[metadata.format] !== mime ||
        (metadata.pages ?? 1) > 1 || metadata.width > 8_192 || metadata.height > 8_192 ||
        metadata.width * metadata.height > MAX_PIXELS) {
      throw new BadRequestException("Only static JPEG, PNG, or WebP images within the dimension limit are accepted");
    }
    const image = await sharp(file.buffer, { failOn: "error", animated: false, limitInputPixels: MAX_PIXELS })
      .rotate().resize(512, 512, { fit: "cover", position: "centre" })
      .webp({ quality: 84, effort: 5 }).toBuffer();
    const key = randomUUID();
    const directory = this.directory(userId);
    const finalPath = this.picturePath(userId, key);
    const temporaryPath = `${finalPath}.${randomUUID()}.tmp`;
    let oldKey: string | null = null;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock_shared(${MEDIA_BACKUP_LOCK})`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`);
        const user = await tx.users.findFirst({ where: { id: userId, account_status: "active" }, select: { profile_picture_key: true } });
        if (!user) throw new NotFoundException("User was not found");
        oldKey = user.profile_picture_key;
        await mkdir(directory, { recursive: true });
        await writeFile(temporaryPath, image, { flag: "wx" });
        await rename(temporaryPath, finalPath);
        await tx.users.update({ where: { id: userId }, data: { profile_picture_key: key } });
      });
    } catch (error) {
      await Promise.all([rm(temporaryPath, { force: true }), rm(finalPath, { force: true })]);
      throw error;
    }
    if (oldKey) await this.removeOld(userId, oldKey);
    return { url: profilePictureUrl(userId, key) };
  }

  async remove(userId: string) {
    let oldKey: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock_shared(${MEDIA_BACKUP_LOCK})`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`);
      const user = await tx.users.findFirst({ where: { id: userId, account_status: "active" }, select: { profile_picture_key: true } });
      if (!user) throw new NotFoundException("User was not found");
      oldKey = user.profile_picture_key;
      if (oldKey) await tx.users.update({ where: { id: userId }, data: { profile_picture_key: null } });
    });
    if (oldKey) await this.removeOld(userId, oldKey);
    return { url: null };
  }

  async get(userId: string) {
    if (!UUID.test(userId)) throw new NotFoundException("Profile picture was not found");
    // A replacement can remove a file between the database read and file read.
    // Retry against the current pointer so an in-flight request still gets an image.
    for (let attempt = 0; attempt < 3; attempt++) {
      const user = await this.prisma.users.findFirst({
        where: { id: userId, account_status: "active" }, select: { profile_picture_key: true }
      });
      if (!user?.profile_picture_key) throw new NotFoundException("Profile picture was not found");
      try {
        return { buffer: await readFile(this.picturePath(userId, user.profile_picture_key)), etag: `"${user.profile_picture_key}"` };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    throw new NotFoundException("Profile picture was not found");
  }

  async purgeDeletedUserPicture(userId: string, key: string) {
    await this.removeOld(userId, key);
  }

  private directory(userId: string) {
    if (!UUID.test(userId)) throw new NotFoundException("User was not found");
    return join(this.root, "users", userId, "profile");
  }

  private picturePath(userId: string, key: string) {
    if (!UUID.test(key)) throw new NotFoundException("Profile picture was not found");
    return join(this.directory(userId), `${key}.webp`);
  }

  private async removeOld(userId: string, key: string) {
    try {
      await rm(this.picturePath(userId, key), { force: true, maxRetries: 3, retryDelay: 100 });
    } catch (error) {
      this.logger.error(`Could not remove replaced profile picture for user ${userId}`, error);
    }
  }
}
