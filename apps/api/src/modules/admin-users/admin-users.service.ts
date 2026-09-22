import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminUserHistoryPage, AdminUsersPage } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeIranianPhone } from "../sms/phone-number";
import type { AdminUserHistoryQueryDto, ListAdminUsersQueryDto, UpdateAdminUserDto } from "./dto/admin-users.dto";

const userSelect = {
  id: true, full_name: true, username: true, email: true, phone_number: true,
  role: true, created_at: true, updated_at: true,
  _count: { select: { orders: true } }
} satisfies Prisma.usersSelect;

type HistoryItem = AdminUserHistoryPage["items"][number];
const item = (id: string, at: Date, title: string, details: HistoryItem["details"]): HistoryItem =>
  ({ id, at: at.toISOString(), title, details });

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  private mapUser(user: Prisma.usersGetPayload<{ select: typeof userSelect }>) {
    return {
      id: user.id, fullName: user.full_name, username: user.username,
      email: user.email, phoneNumber: user.phone_number, role: user.role,
      orderCount: user._count.orders, createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString()
    };
  }

  async list(input: ListAdminUsersQueryDto): Promise<AdminUsersPage> {
    const search = input.search?.trim();
    const from = input.joinedFrom ? new Date(`${input.joinedFrom}T00:00:00.000Z`) : undefined;
    const to = input.joinedTo ? new Date(`${input.joinedTo}T00:00:00.000Z`) : undefined;
    if ((from && (Number.isNaN(from.getTime()) || from.toISOString().slice(0, 10) !== input.joinedFrom))
      || (to && (Number.isNaN(to.getTime()) || to.toISOString().slice(0, 10) !== input.joinedTo))
      || (from && to && from > to)) {
      throw new BadRequestException("Invalid joined date range");
    }
    const where: Prisma.usersWhereInput = {
      ...(input.role !== "all" ? { role: input.role } : {}),
      ...(search ? { OR: [
        { full_name: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone_number: { contains: search } },
        ...( /^[0-9a-f-]{36}$/i.test(search) ? [{ id: search }] : [] )
      ] } : {}),
      ...(from || to ? { created_at: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 86_400_000) } : {}) } } : {}),
      ...(input.hasOrders === "yes" ? { orders: { some: {} } } : input.hasOrders === "no" ? { orders: { none: {} } } : {}),
      ...(input.hasPhone === "yes" ? { phone_number: { not: null } } : input.hasPhone === "no" ? { phone_number: null } : {})
    };
    const orderBy: Prisma.usersOrderByWithRelationInput[] = input.sort === "oldest"
      ? [{ created_at: "asc" }, { id: "asc" }]
      : input.sort === "name" ? [{ full_name: "asc" }, { id: "asc" }]
      : input.sort === "orders" ? [{ orders: { _count: "desc" } }, { id: "desc" }]
      : [{ created_at: "desc" }, { id: "desc" }];
    const [total, users] = await Promise.all([
      this.prisma.users.count({ where }),
      this.prisma.users.findMany({ where, orderBy, skip: (input.page - 1) * input.limit, take: input.limit, select: userSelect })
    ]);
    return { items: users.map((user) => this.mapUser(user)), page: input.page, pageSize: input.limit, total };
  }

  async detail(id: string) {
    const user = await this.prisma.users.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new NotFoundException("User not found");
    return this.mapUser(user);
  }

  async update(id: string, actorId: string, input: UpdateAdminUserDto) {
    if (input.fullName === null || input.email === null) throw new BadRequestException("Name and email cannot be null");
    const data = {
      ...(input.fullName !== undefined ? { full_name: input.fullName.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.username !== undefined ? { username: input.username?.trim().toLowerCase() || null } : {}),
      ...(input.phoneNumber !== undefined ? { phone_number: input.phoneNumber ? normalizeIranianPhone(input.phoneNumber) : null } : {})
    };
    if (!Object.keys(data).length) throw new BadRequestException("No profile fields supplied");
    if (data.full_name !== undefined && data.full_name.length < 2) throw new BadRequestException("Name is too short");
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
        const before = await tx.users.findUnique({ where: { id }, select: userSelect });
        if (!before) throw new NotFoundException("User not found");
        const after = await tx.users.update({ where: { id }, data, select: userSelect });
        await tx.admin_user_profile_changes.create({ data: {
          user_id: id, actor_user_id: actorId,
          before_data: { fullName: before.full_name, username: before.username, email: before.email, phoneNumber: before.phone_number },
          after_data: { fullName: after.full_name, username: after.username, email: after.email, phoneNumber: after.phone_number }
        } });
        return this.mapUser(after);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Email, username, or phone number is already in use");
      }
      throw error;
    }
  }

  async history(id: string, input: AdminUserHistoryQueryDto): Promise<AdminUserHistoryPage> {
    await this.detail(id);
    const skip = (input.page - 1) * input.limit;
    const take = input.limit;
    let total = 0;
    let items: HistoryItem[] = [];
    switch (input.section) {
      case "orders": {
        const where = { buyer_id: id };
        const [count, rows] = await Promise.all([
          this.prisma.orders.count({ where }),
          this.prisma.orders.findMany({ where, skip, take, orderBy: [{ created_at: "desc" }, { id: "desc" }], select: {
            id: true, created_at: true, status: true, currency: true, total_amount: true,
            seller: { select: { shop_name: true } },
            items: { select: { product_title: true, quantity: true, total_amount: true } },
            payment_attempts: { select: { provider: true, status: true, amount: true, created_at: true } },
            events: { select: { from_status: true, to_status: true, created_at: true }, orderBy: { created_at: "asc" } },
            shipping_address: { select: { province: true, city: true } }
          } })
        ]);
        total = count;
        items = rows.map((row) => item(row.id, row.created_at, `Order · ${row.status}`, {
          seller: row.seller.shop_name, amount: row.total_amount.toString(), currency: row.currency,
          products: row.items.map((line) => `${line.product_title} × ${line.quantity}`).join(", "),
          payments: row.payment_attempts.map((payment) => `${payment.provider}: ${payment.status} (${payment.amount})`).join(", "),
          statusHistory: row.events.map((event) => `${event.to_status} ${event.created_at.toISOString()}`).join(" · "),
          destination: row.shipping_address ? `${row.shipping_address.city}, ${row.shipping_address.province}` : null
        }));
        break;
      }
      case "checkouts": {
        const where = { buyer_id: id };
        const [count, rows] = await Promise.all([
          this.prisma.checkouts.count({ where }),
          this.prisma.checkouts.findMany({ where, skip, take, orderBy: [{ created_at: "desc" }, { id: "desc" }], select: { id: true, created_at: true, status: true, total_amount: true, currency: true, expires_at: true, payment_groups: { select: { provider: true, status: true, amount: true } } } })
        ]);
        total = count;
        items = rows.map((row) => item(row.id, row.created_at, `Checkout · ${row.status}`, { amount: row.total_amount.toString(), currency: row.currency, expiresAt: row.expires_at.toISOString(), paymentGroups: row.payment_groups.map((group) => `${group.provider}: ${group.status} (${group.amount})`).join(", ") }));
        break;
      }
      case "payments": {
        const where = { order: { buyer_id: id } };
        const [count, rows] = await Promise.all([
          this.prisma.payment_attempts.count({ where }),
          this.prisma.payment_attempts.findMany({ where, skip, take, orderBy: [{ created_at: "desc" }, { id: "desc" }], select: { id: true, order_id: true, created_at: true, status: true, provider: true, amount: true, currency: true, verified_at: true, refunded_at: true, failure_code: true, refund: { select: { status: true, created_at: true } } } })
        ]);
        total = count;
        items = rows.map((row) => item(row.id, row.created_at, `Payment · ${row.status}`, { orderId: row.order_id, provider: row.provider, amount: row.amount.toString(), currency: row.currency, verifiedAt: row.verified_at?.toISOString() ?? null, refundedAt: row.refunded_at?.toISOString() ?? null, failureCode: row.failure_code, refund: row.refund?.status ?? null }));
        break;
      }
      case "entitlements": {
        const where = { buyer_id: id };
        const [count, rows] = await Promise.all([
          this.prisma.digital_entitlements.count({ where }),
          this.prisma.digital_entitlements.findMany({ where, skip, take, orderBy: [{ created_at: "desc" }, { id: "desc" }], select: { id: true, created_at: true, max_downloads: true, download_count: true, last_accessed_at: true, order_item: { select: { order_id: true, product_title: true } } } })
        ]);
        total = count;
        items = rows.map((row) => item(row.id, row.created_at, "Digital access", { orderId: row.order_item.order_id, product: row.order_item.product_title, downloads: row.download_count, maximum: row.max_downloads, lastAccessedAt: row.last_accessed_at?.toISOString() ?? null }));
        break;
      }
      case "comments": {
        const where = { OR: [{ author_user_id: id }, { flagged_by_user_id: id }] };
        const [count, rows] = await Promise.all([
          this.prisma.comments.count({ where }),
          this.prisma.comments.findMany({ where, skip, take, orderBy: [{ created_at: "desc" }, { id: "desc" }], select: { id: true, created_at: true, status: true, body: true, author_user_id: true, flagged_by_user_id: true, product: { select: { title: true } }, blog_post: { select: { published_revision: { select: { translations: { take: 1, select: { title: true } } } } } } } })
        ]);
        total = count;
        items = rows.map((row) => item(row.id, row.created_at, row.author_user_id === id ? "Comment" : "Flagged comment", { target: row.product?.title ?? row.blog_post?.published_revision?.translations[0]?.title ?? "Unavailable content", targetType: row.product ? "product" : "blog", status: row.status, body: row.body, flaggedByUser: row.flagged_by_user_id === id }));
        break;
      }
      case "communications": {
        const phone = (await this.prisma.users.findUniqueOrThrow({ where: { id }, select: { phone_number: true } })).phone_number;
        if (!phone) break;
        const records = Prisma.sql`
          SELECT id::text AS id, created_at AS at, 'OTP challenge'::text AS title,
            status::text AS status, attempts::text AS detail
          FROM otp_challenges WHERE phone_number = ${phone}
          UNION ALL
          SELECT id::text, created_at, 'SMS delivery'::text, status::text, template::text
          FROM sms_deliveries WHERE recipient = ${phone}`;
        const [counts, rows] = await Promise.all([
          this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT count(*)::bigint AS count FROM (${records}) AS records`),
          this.prisma.$queryRaw<{ id: string; at: Date; title: string; status: string; detail: string }[]>(Prisma.sql`SELECT * FROM (${records}) AS records ORDER BY at DESC, id DESC LIMIT ${take} OFFSET ${skip}`)
        ]);
        total = Number(counts[0]?.count ?? 0);
        items = rows.map((row) => item(row.id, row.at, row.title, { status: row.status, detail: row.detail }));
        break;
      }
      case "sessions": {
        const where = { user_id: id };
        const [count, rows] = await Promise.all([
          this.prisma.auth_sessions.count({ where }),
          this.prisma.auth_sessions.findMany({ where, skip, take, orderBy: [{ created_at: "desc" }, { id: "desc" }], select: { id: true, created_at: true, expires_at: true, revoked_at: true } })
        ]);
        total = count;
        items = rows.map((row) => item(row.id, row.created_at, "Session", { expiresAt: row.expires_at.toISOString(), revokedAt: row.revoked_at?.toISOString() ?? null, active: !row.revoked_at && row.expires_at > new Date() }));
        break;
      }
      case "seller": {
        const where = { user_id: id };
        const [count, rows] = await Promise.all([
          this.prisma.seller_memberships.count({ where }),
          this.prisma.seller_memberships.findMany({ where, skip, take, orderBy: [{ created_at: "desc" }, { seller_id: "desc" }], select: { seller_id: true, created_at: true, role: true, active: true, seller: { select: { shop_name: true, approved: true, suspended_at: true } } } })
        ]);
        total = count;
        items = rows.map((row) => item(row.seller_id, row.created_at, "Seller membership", { shop: row.seller.shop_name, role: row.role, active: row.active, approved: row.seller.approved, suspendedAt: row.seller.suspended_at?.toISOString() ?? null }));
        break;
      }
      case "ai": {
        const where = { owner_user_id: id };
        const [count, rows] = await Promise.all([
          this.prisma.ai_conversations.count({ where }),
          this.prisma.ai_conversations.findMany({ where, skip, take, orderBy: [{ created_at: "desc" }, { id: "desc" }], select: { id: true, created_at: true, title: true, capability_key: true, deleted_at: true, _count: { select: { messages: true, runs: true } } } })
        ]);
        total = count;
        items = rows.map((row) => item(row.id, row.created_at, "AI conversation", { title: row.title, capability: row.capability_key, messages: row._count.messages, runs: row._count.runs, deletedAt: row.deleted_at?.toISOString() ?? null }));
        break;
      }
      case "activity": {
        const sources = [
          ["order_events", "actor_user_id", "created_at", "Order action", "order_id", "to_status"],
          ["payout_events", "actor_user_id", "created_at", "Payout action", "payout_id", "to_status"],
          ["product_change_events", "actor_user_id", "created_at", "Product change", "product_id", "action"],
          ["blog_change_events", "actor_user_id", "created_at", "Blog change", "post_id", "action"],
          ["blog_moderation_events", "actor_id", "created_at", "Blog moderation", "post_id", "to_status"],
          ["ai_audit_events", "actor_user_id", "created_at", "AI audit", "capability_key", "event_type"],
          ["security_policy_events", "actor_user_id", "created_at", "Security policy", "action", "action"],
          ["auth_login_setting_events", "actor_user_id", "created_at", "Login settings", "id", "email_password_enabled"],
          ["sms_setting_events", "actor_user_id", "changed_at", "SMS settings", "settings_id", "otp_enabled"],
          ["shipping_setting_events", "actor_user_id", "changed_at", "Shipping settings", "settings_id", "amadast_enabled"],
          ["seller_shipping_profile_events", "actor_user_id", "changed_at", "Seller shipping", "seller_id", "enabled"],
          ["usd_exchange_rate_events", "actor_user_id", "created_at", "USD rate", "settings_id", "event_type"],
          ["payment_method_config_events", "actor_user_id", "created_at", "Payment method", "provider_code", "enabled"],
          ["comment_events", "actor_user_id", "created_at", "Comment moderation", "comment_id", "action"],
          ["bridge_data_access_audits", "user_id", "accessed_at", "Bridge access", "fulfillment_id", "access_kind"]
        ] as const;
        const selects = sources.map(([table, actor, timestamp, title, reference, action]) => Prisma.sql`
          SELECT id::text AS id, ${Prisma.raw(timestamp)} AS at, ${title}::text AS title,
            ${Prisma.raw(reference)}::text AS reference, ${Prisma.raw(action)}::text AS action
          FROM ${Prisma.raw(table)} WHERE ${Prisma.raw(actor)} = ${id}`);
        const records = Prisma.join(selects, " UNION ALL ");
        const [counts, rows] = await Promise.all([
          this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT count(*)::bigint AS count FROM (${records}) AS records`),
          this.prisma.$queryRaw<{ id: string; at: Date; title: string; reference: string | null; action: string | null }[]>(Prisma.sql`SELECT * FROM (${records}) AS records ORDER BY at DESC, id DESC LIMIT ${take} OFFSET ${skip}`)
        ]);
        total = Number(counts[0]?.count ?? 0);
        items = rows.map((row) => item(row.id, row.at, row.title, { reference: row.reference, action: row.action }));
        break;
      }
      case "profile": {
        const where = { user_id: id };
        const [count, rows] = await Promise.all([
          this.prisma.admin_user_profile_changes.count({ where }),
          this.prisma.admin_user_profile_changes.findMany({ where, skip, take, orderBy: [{ created_at: "desc" }, { id: "desc" }], select: { id: true, created_at: true, actor_user_id: true, before_data: true, after_data: true } })
        ]);
        total = count;
        items = rows.map((row) => item(row.id, row.created_at, "Profile edited", { actorId: row.actor_user_id, before: JSON.stringify(row.before_data), after: JSON.stringify(row.after_data) }));
        break;
      }
      case "related": {
        const links = await this.prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
          SELECT source.relname AS table_name, attribute.attname AS column_name
          FROM pg_constraint AS link
          JOIN pg_class AS source ON source.oid = link.conrelid
          JOIN pg_namespace AS namespace ON namespace.oid = source.relnamespace
          JOIN pg_attribute AS attribute ON attribute.attrelid = source.oid AND attribute.attnum = link.conkey[1]
          WHERE link.contype = 'f' AND link.confrelid = 'users'::regclass
            AND array_length(link.conkey, 1) = 1 AND namespace.nspname = current_schema()
          ORDER BY source.relname, attribute.attname`;
        const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
        const selects = links.map(({ table_name, column_name }) => Prisma.sql`
          SELECT COALESCE(to_jsonb(record)->>'id', record.ctid::text) AS id,
            COALESCE((to_jsonb(record)->>'created_at')::timestamptz,
              (to_jsonb(record)->>'changed_at')::timestamptz,
              (to_jsonb(record)->>'accessed_at')::timestamptz,
              (to_jsonb(record)->>'granted_at')::timestamptz,
              (to_jsonb(record)->>'updated_at')::timestamptz) AS at,
            ${table_name}::text AS title,
            jsonb_strip_nulls(jsonb_build_object(
              'status', to_jsonb(record)->>'status',
              'action', to_jsonb(record)->>'action',
              'eventType', to_jsonb(record)->>'event_type',
              'role', to_jsonb(record)->>'role',
              'active', to_jsonb(record)->>'active',
              'approved', to_jsonb(record)->>'approved',
              'enabled', to_jsonb(record)->>'enabled',
              'permission', to_jsonb(record)->>'permission',
              'provider', to_jsonb(record)->>'provider',
              'currency', to_jsonb(record)->>'currency',
              'amount', to_jsonb(record)->>'total_amount',
              'name', COALESCE(to_jsonb(record)->>'shop_name', to_jsonb(record)->>'title', to_jsonb(record)->>'name')
            )) AS details
          FROM ${Prisma.raw(quote(table_name))} AS record
          WHERE record.${Prisma.raw(quote(column_name))} = ${id}`);
        if (!selects.length) break;
        const records = Prisma.join(selects, " UNION ALL ");
        const [counts, rows] = await Promise.all([
          this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT count(*)::bigint AS count FROM (${records}) AS records`),
          this.prisma.$queryRaw<{ id: string; at: Date | null; title: string; details: Record<string, string> }[]>(Prisma.sql`SELECT * FROM (${records}) AS records ORDER BY at DESC NULLS LAST, title, id LIMIT ${take} OFFSET ${skip}`)
        ]);
        total = Number(counts[0]?.count ?? 0);
        items = rows.map((row) => ({ id: row.id, at: row.at?.toISOString() ?? null, title: row.title, details: row.details }));
        break;
      }
    }
    return { items, page: input.page, pageSize: take, total };
  }
}
