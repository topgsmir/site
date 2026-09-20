import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdatePlatformNoticeDto } from "./dto/update-platform-notice.dto";

@Injectable()
export class PlatformNoticeService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdmin() {
    const notice = await this.prisma.platform_notice.findUnique({ where: { id: 1 } });
    return { message: notice?.message ?? "", enabled: notice?.enabled ?? false };
  }

  async getPublic() {
    const notice = await this.prisma.platform_notice.findUnique({ where: { id: 1 }, select: { message: true, enabled: true } });
    return { message: notice?.enabled ? notice.message : null };
  }

  async update(input: UpdatePlatformNoticeDto) {
    const message = input.message.trim();
    if (input.enabled && !message) throw new BadRequestException("An enabled notice needs a message");
    const notice = await this.prisma.platform_notice.upsert({
      where: { id: 1 },
      create: { id: 1, message, enabled: input.enabled },
      update: { message, enabled: input.enabled }
    });
    return { message: notice.message, enabled: notice.enabled };
  }
}
