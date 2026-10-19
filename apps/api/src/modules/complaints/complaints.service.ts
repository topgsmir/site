import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateComplaintsSettingsDto } from "./dto/update-complaints-settings.dto";

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const row = await this.prisma.complaints_settings.findUnique({
      where: { id: 1 },
      select: { phone_number: true, telegram_id: true }
    });
    return { phoneNumber: row?.phone_number ?? "", telegramId: row?.telegram_id ?? "" };
  }

  async update(input: UpdateComplaintsSettingsDto) {
    const phoneNumber = this.normalizePhone(input.phoneNumber);
    const telegramId = this.normalizeTelegram(input.telegramId);
    const row = await this.prisma.complaints_settings.upsert({
      where: { id: 1 },
      create: { id: 1, phone_number: phoneNumber, telegram_id: telegramId },
      update: { phone_number: phoneNumber, telegram_id: telegramId },
      select: { phone_number: true, telegram_id: true }
    });
    return { phoneNumber: row.phone_number, telegramId: row.telegram_id };
  }

  private normalizePhone(raw: string): string {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value) return "";
    if (!/^[+0-9()/\- ]{3,40}$/.test(value) || !/\d{3,}/.test(value)) {
      throw new BadRequestException("Phone number is invalid");
    }
    return value;
  }

  private normalizeTelegram(raw: string): string {
    const value = raw.trim();
    if (!value) return "";
    let handle = value;
    try {
      if (/^https?:\/\//i.test(value) || value.toLowerCase().startsWith("t.me/")) {
        const url = new URL(value.startsWith("http") ? value : `https://${value}`);
        if (!/^(?:www\.)?t\.me$/i.test(url.hostname)) throw new Error();
        handle = decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] ?? "");
      }
    } catch {
      throw new BadRequestException("Telegram ID is invalid");
    }
    handle = handle.replace(/^@+/, "");
    if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(handle)) {
      throw new BadRequestException("Telegram ID is invalid");
    }
    return handle;
  }
}
