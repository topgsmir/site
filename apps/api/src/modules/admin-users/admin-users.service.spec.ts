import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import { AdminUsersService } from "./admin-users.service";

describe("AdminUsersService", () => {
  it("lists only buyers with a capped cursor page and safe projection", async () => {
    let query: Record<string, unknown> | undefined;
    const createdAt = new Date("2026-09-13T08:00:00.000Z");
    const prisma = {
      users: {
        findMany: async (input: Record<string, unknown>) => {
          query = input;
          return [
            {
              id: "3dd30b78-d1dc-44e0-a420-798e474b7a0a",
              full_name: "Customer One",
              email: "customer@example.com",
              phone_number: "+989121234567",
              created_at: createdAt,
              _count: { orders: 3 }
            },
            {
              id: "616546f2-fddf-4f60-a66e-918a49435915",
              full_name: "Customer Two",
              email: "second@example.com",
              phone_number: null,
              created_at: createdAt,
              _count: { orders: 0 }
            }
          ];
        }
      }
    } as unknown as PrismaService;
    const service = new AdminUsersService(prisma);

    const result = await service.list({
      cursor: "7775389f-8d83-4e81-8cfe-fbe6d62ca2a2",
      limit: 1
    });

    assert.deepEqual(query?.where, { role: "buyer" });
    assert.deepEqual(query?.cursor, { id: "7775389f-8d83-4e81-8cfe-fbe6d62ca2a2" });
    assert.equal(query?.skip, 1);
    assert.equal(query?.take, 2);
    assert.deepEqual(query?.select, {
      id: true,
      full_name: true,
      email: true,
      phone_number: true,
      created_at: true,
      _count: { select: { orders: true } }
    });
    assert.deepEqual(result, {
      items: [{
        id: "3dd30b78-d1dc-44e0-a420-798e474b7a0a",
        fullName: "Customer One",
        email: "customer@example.com",
        phoneNumber: "+989121234567",
        orderCount: 3,
        createdAt: createdAt.toISOString()
      }],
      nextCursor: "3dd30b78-d1dc-44e0-a420-798e474b7a0a"
    });
  });
});
