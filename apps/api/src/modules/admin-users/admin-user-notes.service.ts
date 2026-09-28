import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminUserNote, AdminUserNotesPage } from "@topgsm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { resolveUserId } from "../../common/user-reference";
import type { UserNotesQueryDto } from "./dto/admin-user-notes.dto";

@Injectable()
export class AdminUserNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: UserNotesQueryDto): Promise<AdminUserNotesPage> {
    userId = await resolveUserId(this.prisma, userId);
    const user = await this.prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("User not found");
    if (query.cursor) {
      const cursor = await this.prisma.admin_user_notes.findFirst({ where: { id: query.cursor, user_id: userId }, select: { id: true } });
      if (!cursor) throw new BadRequestException("Invalid notes cursor");
    }
    const rows = await this.prisma.admin_user_notes.findMany({
      where: { user_id: userId },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      select: { id: true, body: true, seller_visible: true, created_at: true, actor: { select: { full_name: true } } }
    });
    const items = rows.slice(0, query.limit).map((row): AdminUserNote => ({
      id: row.id, body: row.body, authorName: row.actor.full_name, sellerVisible: row.seller_visible, createdAt: row.created_at.toISOString()
    }));
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
  }

  async create(userId: string, actorId: string, body: string, sellerVisible: boolean): Promise<AdminUserNote> {
    userId = await resolveUserId(this.prisma, userId);
    const note = body.trim();
    if (note.length < 3) throw new BadRequestException("Note must contain at least three characters");
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const user = await tx.users.findUnique({ where: { id: userId }, select: { account_status: true } });
      if (!user) throw new NotFoundException("User not found");
      if (user.account_status === "deleted" || user.account_status === "deletion_pending") throw new ConflictException("Notes cannot be added to an account being deleted");
      return tx.admin_user_notes.create({
        data: { user_id: userId, actor_user_id: actorId, body: note, seller_visible: sellerVisible },
        select: { id: true, body: true, seller_visible: true, created_at: true, actor: { select: { full_name: true } } }
      });
    });
    return { id: row.id, body: row.body, authorName: row.actor.full_name, sellerVisible: row.seller_visible, createdAt: row.created_at.toISOString() };
  }
}
