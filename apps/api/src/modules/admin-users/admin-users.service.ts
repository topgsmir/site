import { Injectable } from "@nestjs/common";
import type { AdminUsersPage } from "@topgsm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import type { ListAdminUsersQueryDto } from "./dto/admin-users.dto";

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListAdminUsersQueryDto): Promise<AdminUsersPage> {
    const users = await this.prisma.users.findMany({
      where: { role: "buyer" },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      select: {
        id: true,
        full_name: true,
        email: true,
        phone_number: true,
        created_at: true,
        _count: { select: { orders: true } }
      }
    });
    const hasMore = users.length > input.limit;
    const page = hasMore ? users.slice(0, input.limit) : users;

    return {
      items: page.map((user) => ({
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phoneNumber: user.phone_number,
        orderCount: user._count.orders,
        createdAt: user.created_at.toISOString()
      })),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null
    };
  }
}
