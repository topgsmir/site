import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DataAssistantCleanupService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private readonly prisma: PrismaService) {}
  onModuleInit() { this.timer = setInterval(() => { void this.prune().catch(() => undefined); }, 60 * 60 * 1000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async prune(limit = 500) {
    const now = new Date();
    const [conversations, audits] = await Promise.all([
      this.prisma.ai_conversations.findMany({ where: { expires_at: { lt: now } }, select: { id: true }, take: limit }),
      this.prisma.ai_audit_events.findMany({ where: { expires_at: { lt: now } }, select: { id: true }, take: limit })
    ]);
    const [deletedConversations, deletedAudits] = await this.prisma.$transaction([
      this.prisma.ai_conversations.deleteMany({ where: { id: { in: conversations.map(({ id }) => id) } } }),
      this.prisma.ai_audit_events.deleteMany({ where: { id: { in: audits.map(({ id }) => id) } } })
    ]);
    return { conversations: deletedConversations.count, audits: deletedAudits.count };
  }
}
