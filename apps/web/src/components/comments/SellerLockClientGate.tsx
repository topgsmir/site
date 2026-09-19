"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { SellerCommentsWorkspace } from "./SellerCommentsWorkspace";

export function SellerLockClientGate({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await api.get<{ locked: boolean }>("/comments/seller/status");
        if (active) setLocked(response.data.locked);
      } catch {
        // The API guard remains authoritative if this convenience check fails.
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 15_000);
    window.addEventListener("focus", check);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, []);
  return locked ? <SellerCommentsWorkspace locale={locale} locked /> : children;
}
