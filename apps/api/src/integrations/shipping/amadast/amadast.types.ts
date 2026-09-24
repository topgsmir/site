export type AmadastConfig = {
  clientCode: string;
  userId: number;
  storeId: number;
  productType: number;
  packageType: number;
};

export type AmadastTenantConfig = Pick<AmadastConfig, "clientCode" | "userId">;

export type AmadastPlace = {
  id: number;
  title: string;
  parentId: number | null;
};

export type AmadastLocationInput = {
  title: string;
  address: string;
  province: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
};

export type AmadastStoreInput = {
  title: string;
  locationId: number;
  adminName: string;
  phone: string;
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
