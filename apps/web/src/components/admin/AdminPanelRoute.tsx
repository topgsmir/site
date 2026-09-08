import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";
import { VendorManagement } from "@/components/admin/VendorManagement";

export type AdminSection = "overview" | "vendors" | "products";

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

  const user = await requireUser(locale, ["platform-admin"]);

  return (
    <VendorManagement
      locale={locale}
      adminName={user.fullName}
      section={section}
    />
  );
}
