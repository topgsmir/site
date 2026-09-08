import { notFound } from "next/navigation";
import { BridgeCheckout, type StoreProduct } from "@/components/bridge/BridgeCheckout";
import { SERVER_API_BASE } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export default async function ProductPage({params}:{params:Promise<{locale:string;slug:string}>}) { const {locale,slug}=await params; if(!isLocale(locale))notFound(); const response=await fetch(`${SERVER_API_BASE}/products/${encodeURIComponent(slug)}`,{cache:"no-store"}); if(!response.ok)notFound(); const product=await response.json() as StoreProduct; const user=await getCurrentUser(); return <BridgeCheckout locale={locale} product={product} signedInBuyer={user?.role==="buyer"}/>; }
