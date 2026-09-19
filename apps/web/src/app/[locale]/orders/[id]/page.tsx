import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuyerOrderDetails } from "@/components/bridge/BuyerBridgeOrder";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";
export const dynamic="force-dynamic";
export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };
export default async function OrderPage({params}:{params:Promise<{locale:string;id:string}>}){const {locale,id}=await params;if(!isLocale(locale))notFound();await requireUser(locale,["buyer"]);return <BuyerOrderDetails locale={locale} orderId={id}/>}
