import assert from "node:assert/strict";
import test from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";
import { buildOrderCsv } from "./order-export";
import { ExportOrdersDto } from "./dto/order.dto";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

const order = {
  id: "02f49ca0-44af-44de-bdf6-ff55d5a3b839",
  created_at: new Date("2026-09-29T20:35:12.000Z"),
  status: "paid",
  total_amount: { toString: () => "1234567890123.45" },
  currency: "IRR ",
  traffic_source: "=HYPERLINK(\"https://example.test\")",
  buyer: { full_name: "مریم، رضایی", email: null, phone_number: null },
  seller: { shop_name: "فروشگاه\nآزمایشی" },
  items: [{ product_title: "+فرمول", quantity: 2 }],
  payment_attempts: [{ provider: "zarinpal", provider_ref_id: "009981" }]
};

test("CSV preserves Persian, exact decimal money, UTC time, and neutralizes spreadsheet formulas", () => {
  const csv = buildOrderCsv([order], ["buyer", "seller", "createdAt", "totalAmount", "currency", "trafficSource", "items", "paymentReference"], "fa");
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"مریم، رضایی"/);
  assert.match(csv, /"فروشگاه\nآزمایشی"/);
  assert.match(csv, /"2026-09-29T20:35:12.000Z"/);
  assert.match(csv, /"1234567890123.45","IRR"/);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.test""\)"/);
  assert.match(csv, /"'\+فرمول \(2\)"/);
  assert.match(csv, /"009981"/);
  assert.ok(csv.endsWith("\r\n"));
});

test("export intersects selected IDs with active filters and requires platform order access", async () => {
  let query: { where: Record<string, unknown>; take: number; orderBy: unknown } | undefined;
  const prisma = { orders: { findMany: async (args: typeof query) => { query = args; return [order]; } } } as unknown as PrismaService;
  const service = new OrderService(prisma);
  const admin: AppUser = { id: "admin-1", fullName: "Admin", email: "admin@example.com", role: "platform-admin" };
  const input = { locale: "fa" as const, columns: ["id", "totalAmount"] as ("id" | "totalAmount")[], selectedIds: [order.id], statusGroup: "processing" as const, dateFrom: "2026-09-29", dateTo: "2026-09-30", sort: "oldest" as const };
  const csv = await service.exportCsv(admin, input);
  assert.match(csv, /1234567890123\.45/);
  assert.deepEqual(query?.where.id, { in: [order.id] });
  assert.deepEqual(query?.where.status, { in: ["paid", "processing", "shipped", "awaiting_confirmation"] });
  assert.deepEqual(query?.where.created_at, { gte: new Date("2026-09-28T20:30:00.000Z"), lt: new Date("2026-09-30T20:30:00.000Z") });
  assert.equal(query?.take, 5001);
  assert.deepEqual(query?.orderBy, [{ created_at: "asc" }, { id: "asc" }]);
  await service.exportCsv(admin, { ...input, trash: "trashed" });
  assert.deepEqual(query?.where.trashed_at, { not: null });
  await assert.rejects(() => service.exportCsv(admin, { ...input, dateFrom: "2026-02-30" }), /Invalid order date range/);
  await assert.rejects(() => service.exportCsv({ ...admin, role: "buyer" }, input), /Platform order access is required/);
});

test("export rejects result sets over the synchronous download limit", async () => {
  const prisma = { orders: { findMany: async () => Array(5001).fill(order) } } as unknown as PrismaService;
  const service = new OrderService(prisma);
  const admin: AppUser = { id: "admin-1", fullName: "Admin", email: "admin@example.com", role: "platform-admin" };
  await assert.rejects(() => service.exportCsv(admin, { locale: "fa", columns: ["id"] }), /Export exceeds 5000 orders/);
});

test("export input rejects unknown columns and malformed selected IDs", () => {
  const input = plainToInstance(ExportOrdersDto, { locale: "fa", columns: ["id", "commissionRate"], selectedIds: ["another-shop-order"] });
  const errors = validateSync(input);
  assert.ok(errors.some((error) => error.property === "columns"));
  assert.ok(errors.some((error) => error.property === "selectedIds"));
});
