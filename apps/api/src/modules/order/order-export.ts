import type { OrderExportColumn } from "./dto/order.dto";

type ExportOrder = {
  id: string;
  created_at: Date;
  status: string;
  total_amount: { toString(): string };
  currency: string;
  traffic_source: string | null;
  buyer: { full_name: string; email: string | null; phone_number: string | null };
  seller: { shop_name: string };
  items: { product_title: string; quantity: number }[];
  payment_attempts: { provider: string; provider_ref_id: string | null }[];
};

const HEADINGS: Record<"fa" | "en" | "ar", Record<OrderExportColumn, string>> = {
  fa: { id: "شناسه سفارش", createdAt: "تاریخ ثبت (UTC)", status: "وضعیت", buyer: "خریدار", buyerEmail: "ایمیل خریدار", buyerPhone: "تلفن خریدار", seller: "فروشنده", items: "اقلام", totalAmount: "مبلغ کل", currency: "ارز", paymentProvider: "درگاه پرداخت", paymentReference: "کد پیگیری پرداخت", trafficSource: "منبع ورود" },
  en: { id: "Order ID", createdAt: "Created at (UTC)", status: "Status", buyer: "Buyer", buyerEmail: "Buyer email", buyerPhone: "Buyer phone", seller: "Seller", items: "Items", totalAmount: "Total amount", currency: "Currency", paymentProvider: "Payment provider", paymentReference: "Payment reference", trafficSource: "Traffic source" },
  ar: { id: "معرّف الطلب", createdAt: "تاريخ الطلب (UTC)", status: "الحالة", buyer: "المشتري", buyerEmail: "بريد المشتري", buyerPhone: "هاتف المشتري", seller: "البائع", items: "العناصر", totalAmount: "المبلغ الإجمالي", currency: "العملة", paymentProvider: "مزود الدفع", paymentReference: "مرجع الدفع", trafficSource: "مصدر الزيارة" }
};

function csvCell(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n");
  // Spreadsheet programs evaluate cells starting with these characters as formulas.
  const safe = /^\s*[=+\-@]/u.test(normalized) ? `'${normalized}` : normalized;
  return `"${safe.replace(/"/g, '""')}"`;
}

function valueFor(order: ExportOrder, column: OrderExportColumn): string {
  switch (column) {
    case "id": return order.id;
    case "createdAt": return order.created_at.toISOString();
    case "status": return order.status;
    case "buyer": return order.buyer.full_name;
    case "buyerEmail": return order.buyer.email ?? "";
    case "buyerPhone": return order.buyer.phone_number ?? "";
    case "seller": return order.seller.shop_name;
    case "items": return order.items.map((item) => `${item.product_title} (${item.quantity})`).join(" | ");
    case "totalAmount": return order.total_amount.toString();
    case "currency": return order.currency.trim();
    case "paymentProvider": return order.payment_attempts[0]?.provider ?? "";
    case "paymentReference": return order.payment_attempts[0]?.provider_ref_id ?? "";
    case "trafficSource": return order.traffic_source ?? "";
  }
}

export function buildOrderCsv(orders: ExportOrder[], columns: OrderExportColumn[], locale: "fa" | "en" | "ar"): string {
  const lines = [columns.map((column) => csvCell(HEADINGS[locale][column])).join(",")];
  for (const order of orders) lines.push(columns.map((column) => csvCell(valueFor(order, column))).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
