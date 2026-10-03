"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

export function MarketingRedirect({ locale, code }: { locale: string; code: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.post<{ visitId: string; productSlug: string }>("/marketing/visit", { code }).then(({ data }) => {
      if (!cancelled) window.location.replace(`/${locale}/products/${encodeURIComponent(data.productSlug)}?visit=${encodeURIComponent(data.visitId)}`);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [code, locale]);
  return <main style={{ maxWidth: 520, margin: "64px auto", padding: 20 }} role="status">
    {failed ? <p>{locale === "fa" ? "این لینک بازاریابی در دسترس نیست." : "This referral link is unavailable."}</p>
      : <p>{locale === "fa" ? "در حال باز کردن محصول…" : "Opening product…"}</p>}
  </main>;
}
