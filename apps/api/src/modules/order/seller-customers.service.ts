import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AppUser, SellerCustomerDetail, SellerCustomerOrder, SellerCustomersPage } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { isUserSupportCode, userReferenceWhere } from "../../common/user-reference";
import type { SellerCustomerDetailQueryDto, SellerCustomerSearchDto } from "./dto/seller-customers.dto";

@Injectable()
export class SellerCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertSellerHistoryAccess(actor: AppUser): Promise<string> {
    if (actor.role !== "seller-admin" && actor.role !== "seller-staff") throw new ForbiddenException("Seller access is required");
    const membership = await this.prisma.seller_memberships.findFirst({
      where: { user_id: actor.id, active: true, seller: { invited: false, approved: true, suspended_at: null, permissions: { some: { permission: "orders_manage" } } } },
      select: { seller_id: true }
    });
    if (!membership) throw new ForbiddenException("Active seller orders permission is required");
    return membership.seller_id;
  }

  async search(actor: AppUser, query: SellerCustomerSearchDto): Promise<SellerCustomersPage> {
    const sellerId = await this.assertSellerHistoryAccess(actor);
    const search = query.search.trim();
    if (search.length < 3) throw new BadRequestException("Search must contain at least three characters");
    const sellerOrders = { seller_id: sellerId };
    const baseWhere: Prisma.usersWhereInput = { account_status: { not: "deleted" }, orders: { some: sellerOrders } };
    const exactCustomer = isUserSupportCode(search)
      ? await this.prisma.users.findFirst({ where: { ...baseWhere, support_code: search.toUpperCase() }, select: {
        id: true, full_name: true, email: true, phone_number: true,
        _count: { select: { orders: { where: sellerOrders } } }
      } })
      : null;
    if (exactCustomer) {
      return { items: [{
        id: exactCustomer.id,
        fullName: exactCustomer.full_name,
        email: exactCustomer.email,
        phoneNumber: exactCustomer.phone_number,
        orderCount: exactCustomer._count.orders
      }], nextCursor: null };
    }
    const where: Prisma.usersWhereInput = { ...baseWhere, OR: [
      { full_name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { username: { contains: search, mode: "insensitive" } },
      { phone_number: { contains: search } },
      ...( /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search) ? [{ id: search }] : [] )
    ] };
    let cursorId: string | undefined;
    if (query.cursor) {
      const cursor = await this.prisma.users.findFirst({ where: { AND: [where, userReferenceWhere(query.cursor)] }, select: { id: true } });
      if (!cursor) throw new BadRequestException("Invalid customer cursor");
      cursorId = cursor.id;
    }
    const rows = await this.prisma.users.findMany({
      where,
      orderBy: [{ full_name: "asc" }, { id: "asc" }], ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}), take: query.limit + 1,
      select: { id: true, full_name: true, email: true, phone_number: true, _count: { select: { orders: { where: sellerOrders } } } }
    });
    const items = rows.slice(0, query.limit).map((row) => ({ id: row.id, fullName: row.full_name, email: row.email, phoneNumber: row.phone_number, orderCount: row._count.orders }));
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
  }

  async detail(actor: AppUser, userId: string, query: SellerCustomerDetailQueryDto): Promise<SellerCustomerDetail> {
    const sellerId = await this.assertSellerHistoryAccess(actor);
    const user = await this.prisma.users.findFirst({
      where: { ...userReferenceWhere(userId), account_status: { not: "deleted" }, orders: { some: { seller_id: sellerId } } },
      select: { id: true, full_name: true, email: true, phone_number: true, _count: { select: { orders: { where: { seller_id: sellerId } } } } }
    });
    if (!user) throw new NotFoundException("Customer not found");
    userId = user.id;
    if (query.notesCursor) {
      const cursor = await this.prisma.admin_user_notes.findFirst({ where: { id: query.notesCursor, user_id: userId, seller_visible: true }, select: { id: true } });
      if (!cursor) throw new BadRequestException("Invalid notes cursor");
    }
    if (query.ordersCursor) {
      const cursor = await this.prisma.orders.findFirst({ where: { id: query.ordersCursor, buyer_id: userId, seller_id: sellerId }, select: { id: true } });
      if (!cursor) throw new BadRequestException("Invalid orders cursor");
    }
    const [notes, orders] = await Promise.all([
      this.prisma.admin_user_notes.findMany({ where: { user_id: userId, seller_visible: true }, orderBy: [{ created_at: "desc" }, { id: "desc" }], ...(query.notesCursor ? { cursor: { id: query.notesCursor }, skip: 1 } : {}), take: 11, select: { id: true, body: true, created_at: true } }),
      this.prisma.orders.findMany({ where: { buyer_id: userId, seller_id: sellerId }, orderBy: [{ created_at: "desc" }, { id: "desc" }], ...(query.ordersCursor ? { cursor: { id: query.ordersCursor }, skip: 1 } : {}), take: 11, select: { id: true, status: true, total_amount: true, currency: true, created_at: true, seller: { select: { shop_name: true } }, items: { select: { product_title: true, quantity: true } } } })
    ]);
    const mappedNotes = notes.slice(0, 10).map((note) => ({ id: note.id, body: note.body, createdAt: note.created_at.toISOString() }));
    const mappedOrders: SellerCustomerOrder[] = orders.slice(0, 10).map((order) => ({ id: order.id, status: order.status, totalAmount: order.total_amount.toString(), currency: order.currency, createdAt: order.created_at.toISOString(), shopName: order.seller.shop_name, items: order.items.map((item) => ({ title: item.product_title, quantity: item.quantity })) }));
    return {
      customer: { id: user.id, fullName: user.full_name, email: user.email, phoneNumber: user.phone_number, orderCount: user._count.orders },
      notes: { items: mappedNotes, nextCursor: notes.length > 10 ? mappedNotes.at(-1)!.id : null },
      orders: { items: mappedOrders, nextCursor: orders.length > 10 ? mappedOrders.at(-1)!.id : null }
    };
  }
}
