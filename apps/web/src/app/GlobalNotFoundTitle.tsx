"use client";

import { useEffect } from "react";

export function GlobalNotFoundTitle() {
  useEffect(() => {
    const locale = window.location.pathname.split("/")[1];
    document.title = locale === "en" ? "Page not found | Top GSM" : locale === "ar" ? "الصفحة غير موجودة | Top GSM" : "صفحه پیدا نشد | Top GSM";
  }, []);
  return null;
}
