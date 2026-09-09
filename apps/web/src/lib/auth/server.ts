import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SERVER_API_BASE } from "@/lib/api/server";
import type { Locale } from "@/lib/i18n";
import type { AppUser, Role } from "@topgsm/shared-types";
export type { AppUser } from "@topgsm/shared-types";

export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieHeader = (await cookies()).toString();

  if (!cookieHeader) return null;

  try {
    const response = await fetch(`${SERVER_API_BASE}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store"
    });

    if (!response.ok) return null;

    return (await response.json()) as AppUser;
  } catch {
    return null;
  }
}

export function dashboardFor(user: AppUser, locale: Locale) {
  if (user.role === "platform-admin") return `/${locale}/admin`;
  if (user.role === "platform-staff") {
    if (user.platformPermissions?.includes("blog_manage")) {
      return `/${locale}/admin/blog`;
    }
    return `/${locale}/admin`;
  }
  if (user.role === "seller-admin" || user.role === "seller-staff") {
    return `/${locale}/seller-dashboard`;
  }
  return `/${locale}`;
}

export async function requireUser(locale: Locale, allowedRoles: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  if (!allowedRoles.includes(user.role)) {
    redirect(dashboardFor(user, locale) as Route);
  }

  return user;
}
