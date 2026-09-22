export type BuyerOrder = {
  id: string;
  checkoutId?: string | null;
  status: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  chatAvailable: boolean;
  seller: { id: string; shopName: string };
  shippingAddress?: { recipientName: string; phoneNumber: string; province: string; city: string; postalCode: string; addressLine: string } | null;
  shipment?: { carrier: string | null; trackingCode: string | null; shippedAt: string } | null;
  items: OrderItem[];
};

export type OrderItem = {
  id: string;
  productTitle: string;
  productType: string;
  quantity: number;
  unitPrice: string;
  totalAmount: string;
  serviceNote?: string | null;
  serviceInputs?: Array<{ key: string; label: string; type: "text" | "textarea" | "password"; value: string | null; sensitive: boolean }>;
  digitalDelivery?: { downloadUrl: string; destinationHost: string; maxDownloads: number; downloadCount: number };
  bridge?: {
    id: string;
    status: string;
    completedAt?: string | null;
    input?: { fields?: Record<string, string> } | null;
    result?: unknown;
  };
};

// Match the existing server transition policy, which uses the first item's type.
export function canConfirmOrder(order: BuyerOrder) {
  const type = order.items[0]?.productType;
  return Boolean(type && ((type === "digital" && order.status === "paid") ||
    (type === "physical" && order.status === "shipped") ||
    (type !== "physical" && order.status === "awaiting_confirmation")));
}

export function canDownload(order: BuyerOrder, item: OrderItem) {
  const delivery = item.digitalDelivery;
  return Boolean(delivery && ["paid", "processing", "awaiting_confirmation", "delivered"].includes(order.status) &&
    (delivery.maxDownloads <= 0 || delivery.downloadCount < delivery.maxDownloads));
}
