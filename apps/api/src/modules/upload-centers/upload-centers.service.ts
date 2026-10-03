import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateUploadCentersDto } from "./dto/update-upload-centers.dto";

@Injectable()
export class UploadCentersService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const row = await this.prisma.upload_center_settings.findUnique({
      where: { id: 1 }, select: { free_url: true, regular_url: true }
    });
    return { freeUrl: row?.free_url ?? "", regularUrl: row?.regular_url ?? "" };
  }

  async update(input: UpdateUploadCentersDto) {
    const freeUrl = this.normalizeUrl(input.freeUrl);
    const regularUrl = this.normalizeUrl(input.regularUrl);
    const row = await this.prisma.upload_center_settings.upsert({
      where: { id: 1 },
      create: { id: 1, free_url: freeUrl, regular_url: regularUrl },
      update: { free_url: freeUrl, regular_url: regularUrl },
      select: { free_url: true, regular_url: true }
    });
    return { freeUrl: row.free_url, regularUrl: row.regular_url };
  }

  private normalizeUrl(raw: string): string {
    const value = raw.trim();
    if (!value) return "";
    let url: URL;
    try { url = new URL(value); }
    catch { throw new BadRequestException("Upload center URL must be a valid HTTPS address"); }
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      throw new BadRequestException("Upload center URL must be a valid HTTPS address without credentials");
    }
    const normalized = url.toString();
    if (normalized.length > 2048) throw new BadRequestException("Upload center URL is too long");
    return normalized;
  }
}
