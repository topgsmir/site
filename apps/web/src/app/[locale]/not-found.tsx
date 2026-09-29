"use client";

import { useParams } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PublicStatePage } from "@/components/PublicStatePage";

export default function NotFound() {
  const { locale: value } = useParams<{ locale: string }>();
  return <PublicStatePage locale={isLocale(value) ? value : "fa"} kind="not-found" />;
}
