export type AmadastConfig = {
  clientCode: string;
  userId: number;
  storeId: number;
  productType: number;
  packageType: number;
};

export type AmadastOrderPayload = {
  store_id: number;
  external_order_id: number;
  recipient_name: string;
  sender_name: string;
  recipient_mobile: string;
  sender_mobile: string;
  recipient_city_id: number;
  recipient_address: string;
  weight: number;
  value: number;
  product_type: number;
  package_type: number;
  recipient_postal_code: string;
  description?: string;
  is_breakable: boolean;
  is_liquid: boolean;
  is_big: boolean;
};

export type AmadastTracking = {
  amadastTrackingCode: string | null;
  courierTrackingCode: string | null;
  courierTitle: string | null;
  externalOrderId: number;
};
