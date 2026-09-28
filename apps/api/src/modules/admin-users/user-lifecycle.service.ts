import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AccountStatus, LifecycleCandidate, ManagedUserRole, UserAccessDetails } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { resolveUserId } from "../../common/user-reference";
import { AuthService } from "../auth/auth.service";
import { assertMutable, identifier, lifecycleUserSelect, lockAdministration, lockEntity, preserveAdmin, reason, recipientSeller, validateRoleChange } from "./user-lifecycle.policy";
import type { ChangeAccountStatusDto, ChangeUserRoleDto, LifecycleCandidateSearchDto, LifecycleSearchDto } from "./dto/user-lifecycle.dto";
import { mapDeletionJob } from "./user-transfer.definition";

@Injectable()
export class UserLifecycleService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}

  async access(id: string): Promise<UserAccessDetails> {
    id = await resolveUserId(this.prisma, id);
    const user = await this.prisma.users.findUnique({ where: { id }, select: lifecycleUserSelect });
    if (!user) throw new NotFoundException("User not found");
    const job = await this.prisma.user_deletion_jobs.findFirst({ where: { user_id: id }, orderBy: { created_at: "desc" } });
    return {
      role: user.role as ManagedUserRole, status: user.account_status as AccountStatus, identifier: identifier(user),
      platformPermissions: user.platform_permissions.map(p => p.permission), ownedSellerId: user.sellers[0]?.id ?? null,
      requirements: { emailRequiredForNonBuyer: !user.email, canonicalSellerId: user.sellers[0]?.id ?? null, confirmationRoles: ["platform_admin", "seller_admin"] },
      memberships: user.seller_memberships.map(m => ({ sellerId: m.seller_id, shopName: m.seller.shop_name, role: m.role, active: true, canonicalOwner: user.sellers.some(s => s.id === m.seller_id) })),
      job: job ? mapDeletionJob(job) : null
    };
  }

  async setStatus(id: string, actorId: string, input: ChangeAccountStatusDto) {
    id = await resolveUserId(this.prisma, id);
    const auditReason = reason(input.reason);
    if (id === actorId) throw new ForbiddenException("You cannot block your own account");
    await this.prisma.$transaction(async tx => {
      await lockAdministration(tx, actorId);
      await lockEntity(tx, "user", id);
      const user = await tx.users.findUnique({ where: { id }, select: lifecycleUserSelect });
      if (!user) throw new NotFoundException("User not found");
      assertMutable(user);
      await preserveAdmin(tx, user, user.role, input.status);
      if (input.status === user.account_status) return;
      await tx.users.update({ where: { id }, data: { account_status: input.status, blocked_at: input.status === "blocked" ? new Date() : null } });
      await tx.auth_sessions.updateMany({ where: { user_id: id, revoked_at: null }, data: { revoked_at: new Date() } });
      await tx.user_account_events.create({ data: { user_id: id, actor_user_id: actorId, action: input.status === "blocked" ? "blocked" : "unblocked", reason: auditReason, before_data: { status: user.account_status }, after_data: { status: input.status } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.access(id);
  }

  async setRole(id: string, actorId: string, input: ChangeUserRoleDto) {
    id = await resolveUserId(this.prisma, id);
    const auditReason = reason(input.reason);
    // Verify outside the transaction; the locked transaction rechecks authority
    // and whether the current transition actually requires this verification.
    const verifiedHash = input.currentPassword ? await this.auth.verifyCurrentPassword(actorId, input.currentPassword) : undefined;
    await this.prisma.$transaction(async tx => {
      await lockAdministration(tx, actorId, verifiedHash);
      await lockEntity(tx, "user", id);
      if (input.sellerId) await lockEntity(tx, "seller", input.sellerId);
      const user = await tx.users.findUnique({ where: { id }, select: lifecycleUserSelect });
      if (!user) throw new NotFoundException("User not found");
      const highRisk = validateRoleChange(user, actorId, input);
      if (highRisk && (!input.currentPassword || ![identifier(user), user.support_code, user.id].includes(input.confirmation ?? ""))) throw new BadRequestException("Password and exact account identifier confirmation required");
      await preserveAdmin(tx, user, input.role, user.account_status);
      if (input.sellerId) {
        const seller = await tx.sellers.findFirst({ where: { id: input.sellerId, merged_into_seller_id: null }, select: { id: true } });
        if (!seller) throw new ConflictException("Seller is unavailable");
      }
      await tx.users.update({ where: { id }, data: { role: input.role } });
      await tx.platform_staff_permissions.deleteMany({ where: { user_id: id } });
      if (input.role === "platform_staff" && input.permissions?.length) {
        await tx.platform_staff_permissions.createMany({ data: input.permissions.map(permission => ({ user_id: id, permission, granted_by_id: actorId })) });
      }
      await tx.seller_memberships.updateMany({ where: { user_id: id, active: true }, data: { active: false } });
      if (input.sellerId) {
        const membershipRole = input.role === "seller_admin" ? "admin" : "staff";
        await tx.seller_memberships.upsert({ where: { seller_id_user_id: { seller_id: input.sellerId, user_id: id } }, create: { seller_id: input.sellerId, user_id: id, role: membershipRole }, update: { active: true, role: membershipRole } });
      }
      await tx.auth_sessions.updateMany({ where: { user_id: id, revoked_at: null }, data: { revoked_at: new Date() } });
      await tx.user_account_events.create({ data: {
        user_id: id, actor_user_id: actorId, action: "role_changed", reason: auditReason,
        before_data: { role: user.role, permissions: user.platform_permissions.map(p => p.permission), memberships: user.seller_memberships.map(m => ({ sellerId: m.seller_id, role: m.role })) },
        after_data: { role: input.role, permissions: input.permissions ?? [], sellerId: input.sellerId ?? null }
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.access(id);
  }

  async candidates(sourceId: string, query: LifecycleCandidateSearchDto) {
    sourceId = await resolveUserId(this.prisma, sourceId);
    const cursorId = query.cursor ? await resolveUserId(this.prisma, query.cursor) : undefined;
    const sourceSeller = await this.prisma.sellers.findFirst({ where: { user_id: sourceId, merged_into_seller_id: null }, select: { id: true } });
    const rows = await this.prisma.users.findMany({
      where: { id: { not: sourceId, ...(cursorId ? { gt: cursorId } : {}) }, account_status: "active", role: { in: ["buyer", "seller_admin", "seller_staff"] },
        ...(sourceSeller ? { email: { not: null } } : {}),
        ...(query.search?.trim() ? { OR: [{ full_name: { contains: query.search.trim(), mode: "insensitive" } }, { email: { contains: query.search.trim(), mode: "insensitive" } }, { username: { contains: query.search.trim(), mode: "insensitive" } }] } : {}) },
      orderBy: { id: "asc" }, take: 25, select: lifecycleUserSelect
    });
    const entityIds = rows.flatMap(row => [row.id, ...row.sellers.map(s => s.id), ...row.seller_memberships.map(m => m.seller_id)]);
    const held = new Set((await this.prisma.user_lifecycle_locks.findMany({ where: { entity_id: { in: entityIds } }, select: { entity_type: true, entity_id: true } })).map(row => `${row.entity_type}:${row.entity_id}`));
    const items: LifecycleCandidate[] = [];
    for (const row of rows) {
      try {
        const sellerId = recipientSeller(row);
        const seller = row.sellers.find(s => s.id === sellerId) ?? row.seller_memberships.find(m => m.seller_id === sellerId)?.seller;
        if (sellerId !== sourceSeller?.id && seller && (!seller.approved || seller.invited || seller.suspended_at)) continue;
        if (held.has(`user:${row.id}`) || sellerId && held.has(`seller:${sellerId}`)) continue;
        items.push({ id: row.id, label: row.full_name + " · " + identifier(row), sellerId, sellerName: row.sellers[0]?.shop_name ?? row.seller_memberships[0]?.seller.shop_name ?? null });
      } catch (error) { if (!(error instanceof ConflictException)) throw error; }
    }
    return { items, nextCursor: rows.length === 25 ? rows.at(-1)!.id : null };
  }

  async sellers(query: LifecycleSearchDto) {
    const rows = await this.prisma.sellers.findMany({ where: { merged_into_seller_id: null, ...(query.cursor ? { id: { gt: query.cursor } } : {}), ...(query.search?.trim() ? { shop_name: { contains: query.search.trim(), mode: "insensitive" } } : {}) }, orderBy: { id: "asc" }, take: 25, select: { id: true, shop_name: true } });
    return { items: rows.map(s => ({ id: s.id, label: s.shop_name, sellerId: s.id, sellerName: s.shop_name })), nextCursor: rows.length === 25 ? rows.at(-1)!.id : null };
  }

  async events(id: string, query: LifecycleSearchDto) {
    id = await resolveUserId(this.prisma, id);
    return this.prisma.user_account_events.findMany({ where: { user_id: id }, orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 25,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}), select: { id: true, action: true, reason: true, actor_user_id: true, before_data: true, after_data: true, created_at: true } });
  }
}
