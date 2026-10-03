export const SMS_EVENTS = [
  "login_otp",
  "guest_comment_verification",
  "pending_product",
  "product_sold",
  "physical_order_shipped",
  "search_empty",
  "bridge_success",
  "bridge_failure"
] as const;

export type SmsEvent = typeof SMS_EVENTS[number];

export const SMS_PRODUCT_TYPES = ["any", "digital", "physical", "service", "bridge"] as const;
export const SMS_RECIPIENT_KINDS = ["requester", "buyer", "seller", "phone", "role", "all"] as const;
export const SMS_ROLES = ["platform_admin", "platform_staff", "seller_admin", "seller_staff", "buyer"] as const;
export type SmsProductType = typeof SMS_PRODUCT_TYPES[number];
export type SmsRecipientKind = typeof SMS_RECIPIENT_KINDS[number];

export const LEGACY_SMS_TEMPLATES: Partial<Record<SmsEvent, "otp" | "seller_new_order" | "buyer_success" | "buyer_failure">> = {
  login_otp: "otp",
  product_sold: "seller_new_order",
  bridge_success: "buyer_success",
  bridge_failure: "buyer_failure"
};

export function legacyTemplateForRule(event: SmsEvent, recipient: SmsRecipientKind) {
  if (event === "login_otp" && recipient === "requester") return "otp";
  if (event === "product_sold" && recipient === "seller") return "seller_new_order";
  if (event === "bridge_success" && recipient === "buyer") return "buyer_success";
  if (event === "bridge_failure" && recipient === "buyer") return "buyer_failure";
  return null;
}
