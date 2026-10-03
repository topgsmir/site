import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SERVER_API_BASE } from "@/lib/api/server";
import type { Locale } from "@/lib/i18n";
import type { AppUser, Role } from "@topgsm/shared-types";
import { dashboardFor } from "./dashboard-destination";
export type { AppUser } from "@topgsm/shared-types";
export { dashboardFor } from "./dashboard-destination";

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

export async function requireUser(locale: Locale, allowedRoles: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  if (!allowedRoles.includes(user.role)) {
    redirect(dashboardFor(user, locale) as Route);
  }

  return user;
}

export async function requireAuthenticatedUser(locale: Locale) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}
