export type ProductType = "digital" | "physical" | "service";
export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PayoutStatus =
  | "draft"
  | "requested"
  | "approved"
  | "settled"
  | "disputed";

export type Role =
  | "platform-admin"
  | "seller-admin"
  | "seller-staff";

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

