import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

/** Immutable, decoded raster assets on the same persistent MEDIA_ROOT as product images. */
@Injectable()
export class HomepageImagesService {
  private readonly root: string;
  constructor(config: ConfigService) { this.root = resolve(config.get<string>("MEDIA_ROOT")?.trim() || "var/media", "homepage"); }

  async upload(file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length || file.buffer.length > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      throw new BadRequestException("Choose a JPEG, PNG, or WebP image up to 5 MB");
    }
    let buffer: Buffer;
    try {
      const input = sharp(file.buffer, { failOn: "error", limitInputPixels: 20_000_000, animated: false });
      const metadata = await input.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192) throw new Error("Invalid raster");
      buffer = await input.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
    } catch { throw new BadRequestException("The image could not be decoded. Choose a static image up to 20 megapixels."); }
    const id = randomUUID();
    await mkdir(this.root, { recursive: true });
    await writeFile(resolve(this.root, `${id}.webp`), buffer, { flag: "wx" });
    return { url: `/homepage-images/${id}.webp` };
  }

  async get(id: string) {
    // Recheck at the filesystem boundary, including direct service callers.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new NotFoundException();
    try { return await readFile(resolve(this.root, `${id}.webp`)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new NotFoundException(); throw error; }
  }
}
