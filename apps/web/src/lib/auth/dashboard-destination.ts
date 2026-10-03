import type { AppUser } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";

export function dashboardFor(user: AppUser, locale: Locale) {
  if (user.role === "platform-admin") return `/${locale}/admin`;
  if (user.role === "platform-staff") {
    if (user.platformPermissions?.includes("uploads_manage")) return `/${locale}/admin/uploads`;
    if (user.platformPermissions?.includes("blog_manage")) return `/${locale}/admin/blog`;
    return `/${locale}/admin`;
  }
  if (user.role === "seller-admin" || user.role === "seller-staff") return `/${locale}/seller-dashboard`;
  return `/${locale}/account`;
}
