import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/lib/auth/server";
import { SERVER_API_BASE } from "@/lib/api/server";
import { SellerCommentsWorkspace } from "@/components/comments/SellerCommentsWorkspace";
import { SellerLockClientGate } from "@/components/comments/SellerLockClientGate";
import { AdminShopSetup } from "@/components/seller/AdminShopSetup";

export default async function SellerDashboardLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireUser(locale, ["seller-admin", "seller-staff", "platform-admin"]);
  if (user.role === "platform-admin" && !user.sellerId) return <AdminShopSetup locale={locale} />;
  const cookie = (await cookies()).toString();
  let locked = false;
  try {
    const response = await fetch(`${SERVER_API_BASE}/comments/seller/status`, { headers: { cookie, "X-TopGSM-Workspace": "seller" }, cache: "no-store" });
    locked = response.ok && ((await response.json()) as { locked: boolean }).locked;
  } catch {
    // Seller API requests still enforce the lock if this status probe fails.
  }
  if (locked) return <SellerCommentsWorkspace locale={locale} locked />;
  return <SellerLockClientGate locale={locale}>{children}</SellerLockClientGate>;
}
