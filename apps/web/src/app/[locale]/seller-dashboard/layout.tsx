import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/lib/auth/server";
import { SERVER_API_BASE } from "@/lib/api/server";
import { SellerCommentsWorkspace } from "@/components/comments/SellerCommentsWorkspace";
import { SellerLockClientGate } from "@/components/comments/SellerLockClientGate";

export default async function SellerDashboardLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireUser(locale, ["seller-admin", "seller-staff"]);
  const cookie = (await cookies()).toString();
  try {
    const response = await fetch(`${SERVER_API_BASE}/comments/seller/status`, { headers: { cookie }, cache: "no-store" });
    if (response.ok && ((await response.json()) as { locked: boolean }).locked) {
      return <SellerCommentsWorkspace locale={locale} locked />;
    }
  } catch {
    // Seller API requests still enforce the lock if this status probe fails.
  }
  return <SellerLockClientGate locale={locale}>{children}</SellerLockClientGate>;
}
