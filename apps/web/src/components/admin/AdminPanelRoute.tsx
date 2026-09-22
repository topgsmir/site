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
  | "settings-goghdi"
  | "security-rate-limit"
  | "security-login"
  | "security-captcha"
  | "settings-shipping"
  | "settings-usd"
  | "settings-comments"
  | "settings-notice"
  | "settings-backup"
  | "editorial"
  | "uploads";

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
    section === "editorial" || section === "uploads" ? ["platform-admin", "platform-staff"] : ["platform-admin"]
  );

  if (
    (section === "editorial" || section === "uploads") &&
    user.role === "platform-staff" &&
    !user.platformPermissions?.includes(section === "editorial" ? "blog_manage" : "uploads_manage")
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
      platformPermissions={user.platformPermissions ?? []}
    />
  );
}
