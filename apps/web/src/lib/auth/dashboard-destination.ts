import type { AppUser } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";

function dashboardPath(user: Pick<AppUser, "role" | "platformPermissions">) {
  if (user.role === "platform-admin") return "/admin";
  if (user.role === "platform-staff") {
    if (user.platformPermissions?.includes("uploads_manage")) return "/admin/uploads";
    if (user.platformPermissions?.includes("blog_manage")) return "/admin/blog";
    return "/admin";
  }
  if (user.role === "seller-admin" || user.role === "seller-staff") return "/seller-dashboard";
  return "/account";
}

export function managementDashboardPath(user: Pick<AppUser, "role" | "platformPermissions"> | null | undefined) {
  if (!user || user.role === "buyer") return null;
  return dashboardPath(user);
}

export function dashboardFor(user: AppUser, locale: Locale) {
  return `/${locale}${dashboardPath(user)}`;
}
