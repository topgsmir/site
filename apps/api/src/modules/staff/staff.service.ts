import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import type {
  CompleteStaffSetupDto,
  CreateStaffInvitationDto,
  UpdateStaffDto
} from "./dto/staff.dto";

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService
  ) {}

  async list() {
    const [staff, invitations] = await Promise.all([
      this.prisma.users.findMany({
        where: { role: "platform_staff" },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        select: {
          id: true,
          full_name: true,
          email: true,
          created_at: true,
          platform_permissions: { select: { permission: true } }
        }
      }),
      this.prisma.platform_staff_invitations.findMany({
        where: { status: "pending" },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        select: {
          id: true,
          full_name: true,
          email: true,
          permissions: true,
          status: true,
          expires_at: true,
          created_at: true
        }
      })
    ]);
    return {
      staff: staff.map((item) => ({
        id: item.id,
        fullName: item.full_name,
        email: item.email,
        permissions: item.platform_permissions.map((row) => row.permission),
        createdAt: item.created_at.toISOString()
      })),
      invitations: invitations.map((item) => ({
        id: item.id,
        fullName: item.full_name,
        email: item.email,
        permissions: item.permissions,
        status: item.status,
        expiresAt: item.expires_at.toISOString(),
        createdAt: item.created_at.toISOString()
      }))
    };
  }

  async invite(input: CreateStaffInvitationDto, ownerId: string) {
    const token = randomBytes(32).toString("base64url");
    const email = input.email.trim().toLowerCase();
    const expiresAt = new Date(
      Date.now() + (input.expiresInHours ?? 48) * 60 * 60 * 1000
    );
    await this.prisma.platform_staff_invitations.updateMany({
      where: { email, status: "pending" },
      data: { status: "revoked", revoked_at: new Date() }
    });
    const invitation = await this.prisma.platform_staff_invitations.create({
      data: {
        full_name: input.fullName.trim(),
        email,
        permissions: input.permissions,
        token_hash: this.hash(token),
        expires_at: expiresAt,
        created_by_id: ownerId
      },
      select: { id: true, expires_at: true }
    });
    return {
      id: invitation.id,
      setupToken: token,
      expiresAt: invitation.expires_at.toISOString()
    };
  }

  async update(userId: string, input: UpdateStaffDto, ownerId: string) {
    const staff = await this.prisma.users.findFirst({
      where: { id: userId, role: "platform_staff" },
      select: { id: true }
    });
    if (!staff) throw new NotFoundException("Platform staff member was not found");
    await this.prisma.$transaction(async (tx) => {
      if (input.fullName !== undefined) {
        await tx.users.update({
          where: { id: userId },
          data: { full_name: input.fullName.trim() }
        });
      }
      if (input.permissions !== undefined) {
        await tx.platform_staff_permissions.deleteMany({ where: { user_id: userId } });
        if (input.permissions.length) {
          await tx.platform_staff_permissions.createMany({
            data: input.permissions.map((permission) => ({
              user_id: userId,
              permission,
              granted_by_id: ownerId
            }))
          });
        }
      }
      await tx.auth_sessions.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() }
      });
    });
    return this.list();
  }

  async revoke(id: string) {
    const invitation = await this.prisma.platform_staff_invitations.updateMany({
      where: { id, status: "pending" },
      data: { status: "revoked", revoked_at: new Date() }
    });
    if (invitation.count) return { revoked: true };

    const staff = await this.prisma.users.findFirst({
      where: { id, role: "platform_staff" },
      select: { id: true }
    });
    if (!staff) throw new NotFoundException("Staff member or invitation was not found");
    await this.prisma.$transaction([
      this.prisma.platform_staff_permissions.deleteMany({ where: { user_id: id } }),
      this.prisma.auth_sessions.updateMany({
        where: { user_id: id, revoked_at: null },
        data: { revoked_at: new Date() }
      }),
      this.prisma.users.update({ where: { id }, data: { role: "buyer" } })
    ]);
    return { revoked: true };
  }

  async completeSetup(token: string, input: CompleteStaffSetupDto) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new NotFoundException("Invitation was not found");
    }
    const invitation = await this.prisma.platform_staff_invitations.findUnique({
      where: { token_hash: this.hash(token) }
    });
    if (!invitation || invitation.status !== "pending") {
      throw new NotFoundException("Invitation was not found");
    }
    if (invitation.expires_at <= new Date()) {
      throw new GoneException("Invitation has expired");
    }
    const passwordHash = await this.auth.createPasswordHash(input.password);
    try {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.users.create({
          data: {
            full_name: invitation.full_name,
            email: invitation.email,
            password_hash: passwordHash,
            role: "platform_staff"
          }
        });
        if (invitation.permissions.length) {
          await tx.platform_staff_permissions.createMany({
            data: invitation.permissions.map((permission) => ({
              user_id: user.id,
              permission,
              granted_by_id: invitation.created_by_id
            }))
          });
        }
        const updated = await tx.platform_staff_invitations.updateMany({
          where: { id: invitation.id, status: "pending" },
          data: {
            status: "accepted",
            accepted_at: new Date(),
            accepted_by_id: user.id
          }
        });
        if (updated.count !== 1) throw new ConflictException("Invitation was already used");
      });
      return { completed: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("An account with this email already exists");
      }
      throw error;
    }
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
}
