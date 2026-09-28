import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import type { ManagedUserRole } from "@topgsm/shared-types";
import type { ChangeUserRoleDto } from "./dto/user-lifecycle.dto";

export const lifecycleUserSelect = {
  id: true, support_code: true, role: true, account_status: true, full_name: true, username: true, email: true, phone_number: true,
  sellers: { where: { merged_into_seller_id: null }, select: { id: true, shop_name: true, approved: true, invited: true, suspended_at: true } },
  seller_memberships: { where: { active: true }, orderBy: { seller_id: "asc" }, take: 2, select: { seller_id: true, role: true, seller: { select: { shop_name: true, merged_into_seller_id: true, approved: true, invited: true, suspended_at: true } } } },
  platform_permissions: { select: { permission: true } }
} satisfies Prisma.usersSelect;
export type LifecycleUser = Prisma.usersGetPayload<{ select: typeof lifecycleUserSelect }>;
export function identifier(user: Pick<LifecycleUser, "id" | "support_code" | "username" | "email">) { return user.username ?? user.email ?? user.support_code; }
export function reason(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 500) throw new BadRequestException("A reason between 3 and 500 characters is required");
  return trimmed;
}
export function assertMutable(user: Pick<LifecycleUser, "account_status">) {
  if (!["active", "blocked"].includes(user.account_status)) throw new ConflictException("Account cannot be changed");
}
export function validateRoleChange(user: LifecycleUser, actorId: string, input: ChangeUserRoleDto) {
  assertMutable(user);
  if (actorId === user.id && input.role !== user.role) throw new ForbiddenException("You cannot change your own role");
  const sellerRole = input.role === "seller_admin" || input.role === "seller_staff";
  if (input.role !== "buyer" && !user.email) throw new BadRequestException("Add an email address before assigning a staff or seller role");
  if (sellerRole !== Boolean(input.sellerId)) throw new BadRequestException("Select exactly one seller for a seller role");
  if ((input.role === "platform_staff") !== Array.isArray(input.permissions)) throw new BadRequestException("Only platform staff requires an explicit permission list");
  const owner = user.sellers[0];
  if (owner && (input.role !== "seller_admin" || input.sellerId !== owner.id)) {
    throw new ConflictException("Transfer seller ownership before changing this owner's role");
  }
  return user.role === "platform_admin" || input.role === "platform_admin" || input.role === "seller_admin" || user.role === "seller_admin";
}
export function recipientSeller(user: LifecycleUser) {
  if (user.account_status !== "active" || ["platform_admin", "platform_staff"].includes(user.role)) throw new ConflictException("Replacement must be an active non-platform user");
  const ids = new Set([...user.sellers.map(s => s.id), ...user.seller_memberships.map(m => m.seller_id)]);
  if (user.seller_memberships.some(m => m.seller.merged_into_seller_id) || ids.size > 1) throw new ConflictException("Replacement has an ambiguous seller context");
  if (!ids.size && user.role !== "buyer") throw new ConflictException("Replacement seller account has no seller");
  return [...ids][0] ?? null;
}
export async function lockEntity(tx: Prisma.TransactionClient, kind: "user" | "seller", id: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"lifecycle:" + kind + ":" + id}, 0))::text`;
}
export async function lockAdministration(tx: Prisma.TransactionClient, actorId: string, expectedPasswordHash?: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(27160000)::text`;
  await tx.$queryRaw`SELECT id FROM users WHERE id=${actorId} FOR SHARE`;
  const actor = await tx.users.findUnique({ where: { id: actorId }, select: { role: true, account_status: true, password_hash: true } });
  if (actor?.role !== "platform_admin" || actor.account_status !== "active") throw new ForbiddenException("Active platform administrator required");
  if (expectedPasswordHash && actor.password_hash !== expectedPasswordHash) throw new ForbiddenException("Administrator credentials changed; confirm again");
}
export async function preserveAdmin(tx: Prisma.TransactionClient, user: LifecycleUser, role: ManagedUserRole, status: string) {
  if (user.role !== "platform_admin" || user.account_status !== "active" || (role === "platform_admin" && status === "active")) return;
  if (await tx.users.count({ where: { role: "platform_admin", account_status: "active", id: { not: user.id } } }) === 0) {
    throw new ConflictException("At least one active platform administrator must remain");
  }
}
