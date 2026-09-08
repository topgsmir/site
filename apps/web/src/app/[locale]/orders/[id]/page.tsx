import { notFound } from "next/navigation";
import { BuyerBridgeOrder } from "@/components/bridge/BuyerBridgeOrder";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";
export const dynamic="force-dynamic";
export default async function OrderPage({params}:{params:Promise<{locale:string;id:string}>}){const {locale,id}=await params;if(!isLocale(locale))notFound();await requireUser(locale,["buyer"]);return <BuyerBridgeOrder locale={locale} orderId={id}/>}
