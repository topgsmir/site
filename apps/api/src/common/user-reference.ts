import { NotFoundException } from "@nestjs/common";
import type { Prisma } from "../prisma/client";

export const USER_REFERENCE_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9]{5})$/i;
const USER_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORT_CODE_PATTERN = /^[0-9]{5}$/;

export const isUserSupportCode = (reference: string) => SUPPORT_CODE_PATTERN.test(reference);

export function userReferenceWhere(reference: string): Prisma.usersWhereInput {
  if (SUPPORT_CODE_PATTERN.test(reference)) return { support_code: reference };
  return { id: USER_UUID_PATTERN.test(reference) ? reference.toLowerCase() : reference };
}

export async function resolveUserId(
  database: Pick<Prisma.TransactionClient, "users">,
  reference: string
): Promise<string> {
  if (!SUPPORT_CODE_PATTERN.test(reference)) return USER_UUID_PATTERN.test(reference) ? reference.toLowerCase() : reference;
  const user = await database.users.findUnique({ where: { support_code: reference }, select: { id: true } });
  if (!user) throw new NotFoundException("User not found");
  return user.id;
}
