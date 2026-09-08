import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Vendor, VendorStatus } from "@topgsm/shared-types";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateVendorDto, UpdateVendorDto } from "./dto/vendor.dto";
import type {
  CreateSellerAgentDto,
  CreateSellerInviteDto
} from "./dto/seller-directory.dto";

@Injectable()
export class SellerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService
  ) {}

  async listVendors() {
    const sellers = await this.prisma.sellers.findMany({
      include: {
        user: { select: { full_name: true, email: true } },
        permissions: { select: { permission: true } },
        _count: { select: { listings: true, orders: true } }
      },
      orderBy: { created_at: "desc" }
    });

    return sellers.map((seller) => this.toVendor(seller));
  }

  async listAgents() {
    const agents = await this.prisma.seller_agents.findMany({
      orderBy: [{ available: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        specialty: true,
        rating: true,
        phone: true,
        available: true
      }
    });
    return agents.map((agent) => ({ ...agent, rating: Number(agent.rating) }));
  }

  async createAgent(input: CreateSellerAgentDto, actorUserId: string) {
    const agent = await this.prisma.seller_agents.create({
      data: {
        name: input.name.trim(),
        specialty: input.specialty.trim(),
        rating: input.rating,
        phone: input.phone?.trim() || null,
        available: input.available,
        created_by_user_id: actorUserId
      },
      select: {
        id: true,
        name: true,
        specialty: true,
        rating: true,
        phone: true,
        available: true
      }
    });
    return { ...agent, rating: Number(agent.rating) };
  }

  listInvitations() {
    return this.prisma.seller_invitations.findMany({
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        id: true,
        owner_name: true,
        owner_email: true,
        phone_number: true,
        status: true,
        created_at: true
      }
    });
  }

  async createInvitation(input: CreateSellerInviteDto, actorUserId: string) {
    try {
      return await this.prisma.seller_invitations.create({
        data: {
          owner_name: input.ownerName.trim(),
          owner_email: input.ownerEmail.trim().toLowerCase(),
          phone_number: input.phoneNumber.trim(),
          created_by_user_id: actorUserId
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("This seller already has an active invitation");
      }
      throw error;
    }
  }

  async createVendor(input: CreateVendorDto, adminUserId: string) {
    const email = input.ownerEmail.trim().toLowerCase();
    const passwordHash = await this.authService.createPasswordHash(input.password);
    const status = this.statusData(input.status);

    try {
      const sellerId = await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.users.create({
          data: {
            full_name: input.ownerName.trim(),
            email,
            password_hash: passwordHash,
            role: "seller_admin"
          }
        });
        const seller = await transaction.sellers.create({
          data: {
            user_id: user.id,
            shop_name: input.shopName.trim(),
            phone_number: input.phoneNumber?.trim() || null,
            commission: input.commission,
            holdback_rate: input.holdbackRate,
            blog_review_required: input.blogReviewRequired ?? true,
            ...status
          }
        });

        if (input.permissions.length) {
          await transaction.seller_permissions.createMany({
            data: input.permissions.map((permission) => ({
              seller_id: seller.id,
              permission,
              granted_by_id: adminUserId
            }))
          });
        }
        return seller.id;
      });

      return this.getVendor(sellerId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A user with this email already exists");
      }
      throw error;
    }
  }

  async updateVendor(
    sellerId: string,
    input: UpdateVendorDto,
    adminUserId: string
  ) {
    const current = await this.prisma.sellers.findUnique({
      where: { id: sellerId },
      select: { id: true, user_id: true }
    });
    if (!current) throw new NotFoundException("Vendor was not found");

    const passwordHash = input.password
      ? await this.authService.createPasswordHash(input.password)
      : undefined;

    try {
      await this.prisma.$transaction(async (transaction) => {
        if (input.ownerName !== undefined || input.ownerEmail !== undefined || passwordHash) {
          await transaction.users.update({
            where: { id: current.user_id },
            data: {
              ...(input.ownerName !== undefined
                ? { full_name: input.ownerName.trim() }
                : {}),
              ...(input.ownerEmail !== undefined
                ? { email: input.ownerEmail.trim().toLowerCase() }
                : {}),
              ...(passwordHash ? { password_hash: passwordHash } : {})
            }
          });
        }

        await transaction.sellers.update({
          where: { id: sellerId },
          data: {
            ...(input.shopName !== undefined
              ? { shop_name: input.shopName.trim() }
              : {}),
            ...(input.phoneNumber !== undefined
              ? { phone_number: input.phoneNumber.trim() || null }
              : {}),
            ...(input.commission !== undefined
              ? { commission: input.commission }
              : {}),
            ...(input.holdbackRate !== undefined
              ? { holdback_rate: input.holdbackRate }
              : {}),
            ...(input.blogReviewRequired !== undefined
              ? { blog_review_required: input.blogReviewRequired }
              : {}),
            ...(input.status ? this.statusData(input.status) : {})
          }
        });

        if (input.permissions) {
          await transaction.seller_permissions.deleteMany({
            where: { seller_id: sellerId }
          });
          if (input.permissions.length) {
            await transaction.seller_permissions.createMany({
              data: input.permissions.map((permission) => ({
                seller_id: sellerId,
                permission,
                granted_by_id: adminUserId
              }))
            });
          }
        }

        if (
          passwordHash ||
          input.status === "suspended" ||
          input.status === "invited"
        ) {
          await transaction.auth_sessions.updateMany({
            where: { user_id: current.user_id, revoked_at: null },
            data: { revoked_at: new Date() }
          });
        }
      });

      return this.getVendor(sellerId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A user with this email already exists");
      }
      throw error;
    }
  }

  private async getVendor(sellerId: string) {
    const seller = await this.prisma.sellers.findUnique({
      where: { id: sellerId },
      include: {
        user: { select: { full_name: true, email: true } },
        permissions: { select: { permission: true } },
        _count: { select: { listings: true, orders: true } }
      }
    });
    if (!seller) throw new NotFoundException("Vendor was not found");
    return this.toVendor(seller);
  }

  private statusData(status: VendorStatus) {
    if (status === "invited") {
      return { invited: true, approved: false, suspended_at: null };
    }
    if (status === "suspended") {
      return { invited: false, approved: false, suspended_at: new Date() };
    }
    return { invited: false, approved: true, suspended_at: null };
  }

  private toVendor(seller: {
    id: string;
    shop_name: string;
    phone_number: string | null;
    invited: boolean;
    approved: boolean;
    suspended_at: Date | null;
    commission: Prisma.Decimal;
    holdback_rate: Prisma.Decimal;
    blog_review_required: boolean;
    created_at: Date;
    updated_at: Date;
    user: { full_name: string; email: string };
    permissions: Array<{ permission: Vendor["permissions"][number] }>;
    _count: { listings: number; orders: number };
  }): Vendor {
    const status: VendorStatus = seller.suspended_at
      ? "suspended"
      : seller.approved
        ? "active"
        : "invited";

    return {
      id: seller.id,
      shopName: seller.shop_name,
      ownerName: seller.user.full_name,
      ownerEmail: seller.user.email,
      phoneNumber: seller.phone_number,
      status,
      commission: Number(seller.commission),
      holdbackRate: Number(seller.holdback_rate),
      blogReviewRequired: seller.blog_review_required,
      permissions: seller.permissions.map((item) => item.permission),
      productCount: seller._count.listings,
      orderCount: seller._count.orders,
      createdAt: seller.created_at.toISOString(),
      updatedAt: seller.updated_at.toISOString()
    };
  }
}
