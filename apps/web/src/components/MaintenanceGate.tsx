"use client";

import type { BackupRestoreProgress, PublicSystemStatus } from "@topgsm/shared-types";
import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./MaintenanceGate.module.css";
import { isUuidV4 } from "@/lib/safe-navigation";

const copy = {
  en: {
    eyebrow: "Protected maintenance", title: "The platform is being restored.",
    publicMessage: "Top GSM is temporarily unavailable while a verified backup is restored. No action is required.",
    privateMessage: "This view uses the one-time restore monitor and does not depend on the restored database session.",
    waiting: "Waiting for the maintenance runner…", reload: "Reload and sign in", recovery: "Operator recovery is required.",
    recoveryHint: "The automatic rollback could not be verified. Keep the service in maintenance mode and inspect the API restore journal before intervening."
  },
  fa: {
    eyebrow: "نگه‌داری محافظت‌شده", title: "پلتفرم در حال بازیابی است.",
    publicMessage: "تا پایان بازیابی پشتیبان تأییدشده، تاپ‌جی‌اس‌ام موقتاً در دسترس نیست. نیازی به اقدامی نیست.",
    privateMessage: "این نما با نشان یک‌بارمصرف بازیابی کار می‌کند و به نشست پایگاه داده وابسته نیست.",
    waiting: "در انتظار اجرای بازیابی…", reload: "بارگذاری دوباره و ورود", recovery: "بازیابی دستی اپراتور لازم است.",
    recoveryHint: "بازگشت خودکار قابل تأیید نبود. سرویس را در حالت نگه‌داری نگه دارید و پیش از هر اقدام گزارش بازیابی API را بررسی کنید."
  },
  ar: {
    eyebrow: "صيانة محمية", title: "تجري استعادة المنصة.",
    publicMessage: "يتعذر الوصول إلى Top GSM مؤقتًا أثناء استعادة نسخة متحقق منها. لا يلزم اتخاذ أي إجراء.",
    privateMessage: "تستخدم هذه الشاشة رمز مراقبة الاستعادة ولا تعتمد على جلسة قاعدة البيانات المستعادة.",
    waiting: "في انتظار مشغل الاستعادة…", reload: "إعادة التحميل وتسجيل الدخول", recovery: "يلزم تدخل المشغل للاسترداد.",
    recoveryHint: "تعذر التحقق من التراجع التلقائي. أبقِ الخدمة في وضع الصيانة وافحص سجل استعادة API قبل التدخل."
  }
} as const;

type Monitor = { id: string; token: string; locale?: string };

function savedMonitor(): Monitor | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem("topgsm-restore-monitor") ?? "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (!isUuidV4(value.id) || typeof value.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.token)) return null;
    return { id: value.id, token: value.token, ...(typeof value.locale === "string" && ["fa", "en", "ar"].includes(value.locale) ? { locale: value.locale } : {}) };
  } catch { return null; }
}

export function MaintenanceGate({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [status, setStatus] = useState<PublicSystemStatus | null>(null);
  const [progress, setProgress] = useState<BackupRestoreProgress | null>(null);
  const [monitor, setMonitor] = useState<Monitor | null>(null);

  const poll = useCallback(async () => {
    const currentMonitor = savedMonitor();
    setMonitor(currentMonitor);
    try { setStatus((await api.get<PublicSystemStatus>("/system/status", { timeout: 4_000 })).data); }
    catch { /* An API restart is expected while a locally initiated restore is active. */ }
    if (currentMonitor) {
      try {
        setProgress((await api.get<BackupRestoreProgress>(`/system/restores/${currentMonitor.id}`, {
          headers: { Authorization: `Bearer ${currentMonitor.token}` }, timeout: 4_000
        })).data);
      } catch { /* The maintenance runner may not have bound its port yet. */ }
    }
  }, []);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(() => void poll(), 3_000);
    return () => window.clearInterval(timer);
  }, [poll]);

  const visible = Boolean(status?.maintenance || (monitor && progress && !["success", "failed"].includes(progress.status)) || progress?.status === "success" || progress?.status === "failed" || progress?.status === "recovery_required");
  if (!visible) return null;
  const phase = progress?.phase ?? "validating";
  const finished = progress?.status === "success" || progress?.status === "failed";
  const recovery = progress?.status === "recovery_required";

  return <div className={styles.gate} role="alert" aria-live="assertive">
    <div className={styles.frame}>
      <header><span>{c.eyebrow}</span><strong>TOP GSM / {phase.toUpperCase()}</strong></header>
      <main>
        <div className={styles.marker} aria-hidden="true"><i /><i /><i /></div>
        <p className={styles.kicker}>{progress?.status ?? "maintenance"}</p>
        <h1>{recovery ? c.recovery : c.title}</h1>
        <p>{recovery ? c.recoveryHint : monitor ? c.privateMessage : c.publicMessage}</p>
        <div className={styles.progress}><span style={{ inlineSize: progress?.status === "success" ? "100%" : `${Math.max(10, (["validating", "safety_backup", "database", "migrations", "uploads", "sessions", "complete"].indexOf(phase) + 1) * 14)}%` }} /></div>
        <dl><div><dt>{locale === "en" ? "Phase" : locale === "fa" ? "مرحله" : "المرحلة"}</dt><dd>{phase}</dd></div><div><dt>{locale === "en" ? "Status" : locale === "fa" ? "وضعیت" : "الحالة"}</dt><dd>{progress?.message ?? c.waiting}</dd></div></dl>
        {finished ? <button type="button" onClick={() => { localStorage.removeItem("topgsm-restore-monitor"); window.location.reload(); }}>{c.reload}</button> : null}
      </main>
      <footer><span>{status?.restoreId ?? progress?.id ?? "RESTORE"}</span><span>{status?.updatedAt ? new Date(status.updatedAt).toLocaleTimeString(locale) : "—"}</span></footer>
    </div>
  </div>;
}
