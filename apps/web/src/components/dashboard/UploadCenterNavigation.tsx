"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import navigationStyles from "./DashboardNavigation.module.css";

export type UploadCenterSettings = { freeUrl: string; regularUrl: string };

const labels = {
  fa: { group: "مراکز آپلود", free: "آپلود محصولات رایگان", regular: "آپلود محصولات عادی", settings: "تنظیم نشانی‌ها", unavailable: "نشانی هنوز تنظیم نشده است" },
  en: { group: "Upload centers", free: "Free products", regular: "Regular products", settings: "Set URLs", unavailable: "URL has not been set" },
  ar: { group: "مراكز الرفع", free: "المنتجات المجانية", regular: "المنتجات العادية", settings: "إعداد الروابط", unavailable: "لم يُحدد الرابط بعد" }
} as const;

export function UploadCenterNavigation({ locale, settingsHref, active = false }: { locale: Locale; settingsHref?: string; active?: boolean }) {
  const [settings, setSettings] = useState<UploadCenterSettings | null>(null);
  const [open, setOpen] = useState(active);
  useEffect(() => {
    let active = true;
    const load = () => void api.get<UploadCenterSettings>("/upload-centers")
      .then(({ data }) => { if (active) setSettings(data); })
      .catch(() => { if (active) setSettings(null); });
    load();
    window.addEventListener("upload-centers-updated", load);
    return () => { active = false; window.removeEventListener("upload-centers-updated", load); };
  }, []);
  const c = labels[locale];
  return <div className={navigationStyles.group} data-open={open} data-active={active}>
    <button className={navigationStyles.groupTrigger} type="button" aria-expanded={open} aria-controls="upload-center-navigation" onClick={() => setOpen((value) => !value)}>
      <span>{c.group}</span><span className={navigationStyles.chevron} aria-hidden="true">⌄</span>
    </button>
    <div className={navigationStyles.subNavigation} id="upload-center-navigation">
      {([ ["freeUrl", c.free], ["regularUrl", c.regular] ] as const).map(([key, label]) =>
        settings?.[key] ? <a key={key} className={navigationStyles.item} href={settings[key]} rel="noreferrer">{label} ↗</a>
          : <span key={key} className={navigationStyles.item} title={c.unavailable} aria-disabled="true" style={{ cursor: "default", opacity: .55 }}>{label}</span>
      )}
      {settingsHref ? <a className={navigationStyles.item} href={settingsHref}>{c.settings}</a> : null}
    </div>
  </div>;
}
