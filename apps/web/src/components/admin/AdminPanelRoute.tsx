import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";
import { VendorManagement } from "@/components/admin/VendorManagement";

export type AdminSection =
  | "overview"
  | "vendors"
  | "users"
  | "products"
  | "product-changes"
  | "orders"
  | "payment-transactions"
  | "payment-methods"
  | "staff"
  | "bridge"
  | "ai-models"
  | "ai-assistant"
  | "editorial";

export type AdminPanelRouteProps = {
  params: Promise<{
    locale: string;
  }>;
  section: AdminSection;
};

export async function AdminPanelRoute({ params, section }: AdminPanelRouteProps) {
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
      ownerNavigation={user.role === "platform-admin"}
    />
  );
}
