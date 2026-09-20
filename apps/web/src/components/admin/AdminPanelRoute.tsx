import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";
import { VendorManagement } from "@/components/admin/VendorManagement";

export type AdminSection =
  | "overview"
  | "statistics"
  | "vendors"
  | "users"
  | "products"
  | "product-changes"
  | "coupons"
  | "orders"
  | "order-detail"
  | "payment-transactions"
  | "payment-methods"
  | "staff"
  | "bridge"
  | "ai-models"
  | "ai-assistant"
  | "settings-sms"
  | "security-rate-limit"
  | "security-login"
  | "security-captcha"
  | "settings-shipping"
  | "settings-usd"
  | "settings-comments"
  | "settings-notice"
  | "editorial";

export type AdminPanelRouteProps = {
  params: Promise<{
    locale: string;
  }>;
  section: AdminSection;
  orderId?: string;
};

export async function AdminPanelRoute({ params, section, orderId }: AdminPanelRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const user = await requireUser(
    locale,
    section === "editorial" ? ["platform-admin", "platform-staff"] : ["platform-admin"]
  );

  if (
    section === "editorial" &&
    user.role === "platform-staff" &&
    !user.platformPermissions?.includes("blog_manage")
  ) {
    redirect(`/${locale}`);
  }

  return (
    <VendorManagement
      locale={locale}
      adminName={user.fullName}
      section={section}
      orderId={orderId}
      ownerNavigation={user.role === "platform-admin"}
    />
  );
}
