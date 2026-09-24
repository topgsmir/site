import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type {
  AdminSellerShippingProfile,
  AdminSellerShippingProfilesPage,
  AppUser,
  SellerShippingProfile
} from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { ListSellerShippingProfilesDto, UpdateSellerShippingProfileDto } from "./dto/shipping-settings.dto";

const PHYSICAL_PERMISSION = "physical_products_manage" as const;
const profileSelect = {
  enabled: true,
  sender_name: true,
  sender_mobile: true,
  province: true,
  city: true,
  address_line: true,
  postal_code: true,
  latitude: true,
  longitude: true,
  updated_at: true
} satisfies Prisma.seller_shipping_profilesSelect;

type ProfileRecord = Prisma.seller_shipping_profilesGetPayload<{ select: typeof profileSelect }>;

@Injectable()
export class SellerShippingProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(actor: AppUser): Promise<SellerShippingProfile> {
    const sellerId = await this.sellerIdForActor(actor);
    const profile = await this.prisma.seller_shipping_profiles.findUnique({ where: { seller_id: sellerId }, select: profileSelect });
    return this.map(sellerId, true, profile);
  }

  async updateMine(actor: AppUser, input: UpdateSellerShippingProfileDto): Promise<SellerShippingProfile> {
    const sellerId = await this.sellerIdForActor(actor);
    return this.save(sellerId, actor.id, input, true);
  }

  async listAdmin(input: ListSellerShippingProfilesDto): Promise<AdminSellerShippingProfilesPage> {
    const search = input.search?.normalize("NFKC").trim();
    const where = search ? {
      OR: [
        { shop_name: { contains: search, mode: "insensitive" as const } },
        { user: { full_name: { contains: search, mode: "insensitive" as const } } },
        { user: { email: { contains: search, mode: "insensitive" as const } } }
      ]
    } : {};
    if (input.cursor) {
      const cursor = await this.prisma.sellers.findFirst({ where: { ...where, id: input.cursor }, select: { id: true } });
      if (!cursor) throw new NotFoundException("Shipping profile page cursor was not found");
    }
    const rows = await this.prisma.sellers.findMany({
      where,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: { id: "asc" },
      select: {
        id: true, shop_name: true, invited: true, approved: true, suspended_at: true,
        user: { select: { full_name: true, email: true } },
        permissions: { where: { permission: PHYSICAL_PERMISSION }, select: { permission: true } },
        shipping_profile: { select: profileSelect }
      }
    });
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    return {
      items: page.map((seller) => ({
        ...this.map(seller.id, seller.permissions.length > 0, seller.shipping_profile),
        shopName: seller.shop_name,
        ownerName: seller.user.full_name,
        ownerEmail: seller.user.email!,
        sellerStatus: seller.suspended_at ? "suspended" : seller.approved && !seller.invited ? "active" : "invited"
      })),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null
    };
  }

  async updateAdmin(sellerId: string, actorUserId: string, input: UpdateSellerShippingProfileDto): Promise<AdminSellerShippingProfile> {
    const seller = await this.prisma.sellers.findUnique({
      where: { id: sellerId },
      select: {
        shop_name: true, invited: true, approved: true, suspended_at: true,
        user: { select: { full_name: true, email: true } },
        permissions: { where: { permission: PHYSICAL_PERMISSION }, select: { permission: true } }
      }
    });
    if (!seller) throw new NotFoundException("Seller was not found");
    const granted = seller.permissions.length > 0;
    const profile = await this.save(sellerId, actorUserId, input, granted);
    return {
      ...profile,
      shopName: seller.shop_name,
      ownerName: seller.user.full_name,
      ownerEmail: seller.user.email!,
      sellerStatus: seller.suspended_at ? "suspended" : seller.approved && !seller.invited ? "active" : "invited"
    };
  }

  async effectiveSender(sellerId: string) {
    const seller = await this.prisma.sellers.findFirst({
      where: {
        id: sellerId, invited: false, approved: true, suspended_at: null,
        permissions: { some: { permission: PHYSICAL_PERMISSION } }
      },
      select: { shop_name: true, shipping_profile: { select: profileSelect } }
    });
    if (!seller?.shipping_profile?.enabled || seller.shipping_profile.latitude === null || seller.shipping_profile.longitude === null) {
      throw new ServiceUnavailableException("The seller shipping profile is not ready for provider provisioning");
    }
    const profile = seller.shipping_profile;
    return {
      shopName: seller.shop_name,
      senderName: profile.sender_name,
      senderMobile: profile.sender_mobile,
      province: profile.province,
      city: profile.city,
      addressLine: profile.address_line,
      postalCode: profile.postal_code,
      latitude: profile.latitude!,
      longitude: profile.longitude!
    };
  }

  async isReady(sellerId: string) {
    const seller = await this.prisma.sellers.findFirst({
      where: {
        id: sellerId, invited: false, approved: true, suspended_at: null,
        permissions: { some: { permission: PHYSICAL_PERMISSION } },
        shipping_profile: { is: { enabled: true, latitude: { not: null }, longitude: { not: null } } }
      },
      select: { id: true }
    });
    return Boolean(seller);
  }

  async isReadyForActor(actor: AppUser) {
    if (actor.role !== "seller-admin" && actor.role !== "seller-staff") return false;
    const membership = await this.prisma.seller_memberships.findFirst({
      where: {
        user_id: actor.id, active: true,
        seller: {
          invited: false, approved: true, suspended_at: null,
          permissions: { some: { permission: PHYSICAL_PERMISSION } },
          shipping_profile: { is: { enabled: true, latitude: { not: null }, longitude: { not: null } } }
        }
      },
      select: { seller_id: true }
    });
    return Boolean(membership);
  }

  async sellerIdForActor(actor: AppUser) {
    if (actor.role !== "seller-admin" && actor.role !== "seller-staff") throw new ForbiddenException("Seller access is required");
    const membership = await this.prisma.seller_memberships.findFirst({
      where: {
        user_id: actor.id, active: true,
        seller: {
          invited: false, approved: true, suspended_at: null,
          permissions: { some: { permission: PHYSICAL_PERMISSION } }
        }
      },
      select: { seller_id: true }
    });
    if (!membership) throw new ForbiddenException("Physical-product access has not been granted to this seller");
    return membership.seller_id;
  }

  async assertAdminCanConfigure(sellerId: string) {
    const seller = await this.prisma.sellers.findUnique({
      where: { id: sellerId },
      select: { permissions: { where: { permission: PHYSICAL_PERMISSION }, select: { permission: true } } }
    });
    if (!seller) throw new NotFoundException("Seller was not found");
    if (seller.permissions.length === 0) throw new ForbiddenException("Grant physical-product access before configuring seller shipping");
  }

  private async save(sellerId: string, actorUserId: string, input: UpdateSellerShippingProfileDto, granted: boolean) {
    if (input.enabled && !granted) throw new ForbiddenException("Grant physical-product access before enabling seller shipping");
    const senderMobile = this.normalizeMobile(input.senderMobile);
    if (input.enabled) {
      const duplicateMobile = await this.prisma.seller_shipping_profiles.findFirst({
        where: { seller_id: { not: sellerId }, sender_mobile: senderMobile, enabled: true, latitude: { not: null }, longitude: { not: null } },
        select: { seller_id: true }
      });
      if (duplicateMobile) throw new ConflictException("This sender mobile is already used by another shipping tenant");
    }
    const data = {
      enabled: input.enabled,
      sender_name: input.senderName.normalize("NFKC").trim(),
      sender_mobile: senderMobile,
      province: input.province.normalize("NFKC").trim(),
      city: input.city.normalize("NFKC").trim(),
      address_line: input.addressLine.normalize("NFKC").trim(),
      postal_code: input.postalCode.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      updated_by_user_id: actorUserId
    };
    let profile: ProfileRecord;
    try {
      profile = await this.prisma.$transaction(async (tx) => {
        const previous = await tx.seller_shipping_profiles.findUnique({ where: { seller_id: sellerId }, select: profileSelect });
        const changedFields = Object.entries(data)
          .filter(([key, value]) => key !== "updated_by_user_id" && previous?.[key as keyof ProfileRecord] !== value)
          .map(([key]) => key);
        const saved = await tx.seller_shipping_profiles.upsert({
          where: { seller_id: sellerId },
          create: { seller_id: sellerId, ...data },
          update: data,
          select: profileSelect
        });
        await tx.seller_shipping_profile_events.create({
          data: { seller_id: sellerId, actor_user_id: actorUserId, enabled: saved.enabled, changed_fields: changedFields }
        });
        return saved;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("This sender mobile is already used by another shipping tenant");
      }
      throw error;
    }
    return this.map(sellerId, granted, profile);
  }

  private map(sellerId: string, granted: boolean, profile: ProfileRecord | null): SellerShippingProfile {
    return {
      sellerId,
      granted,
      enabled: profile?.enabled ?? false,
      complete: Boolean(profile && profile.latitude !== null && profile.longitude !== null),
      senderName: profile?.sender_name ?? null,
      senderMobile: profile?.sender_mobile ?? null,
      province: profile?.province ?? null,
      city: profile?.city ?? null,
      addressLine: profile?.address_line ?? null,
      postalCode: profile?.postal_code ?? null,
      latitude: profile?.latitude ?? null,
      longitude: profile?.longitude ?? null,
      updatedAt: profile?.updated_at.toISOString() ?? null
    };
  }

  private normalizeMobile(value: string) {
    const digits = value.replace(/\D/g, "");
    return digits.startsWith("0098") ? `0${digits.slice(4)}` : digits.startsWith("98") ? `0${digits.slice(2)}` : digits;
  }
}
