"use client";

import type {
  AdminBackupDestination,
  AdminBackupOverview,
  AdminRemoteBackupArchive,
  AdminBackupRun,
  AdminBackupRunPage,
  AdminBackupSettings,
  BackupComponent,
  BackupProtocol,
  BackupRestorePreflight,
  BackupRestoreProgress
} from "@topgsm/shared-types";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./BackupRestoreWorkspace.module.css";

const copy = {
  en: {
    eyebrow: "Resilience",
    title: "Backup & Restore",
    intro: "Create encrypted database and upload archives, deliver them off-site, and restore the platform through a protected maintenance workflow.",
    lastRun: "Last run", nextRun: "Next scheduled run", localStorage: "Local storage", failures: "Recent failures",
    never: "Never", notScheduled: "Not scheduled", noFailures: "None", loading: "Loading backup controls…",
    loadError: "Backup settings could not be loaded.", retry: "Try again", save: "Save schedule", saving: "Saving…", saved: "Backup settings saved.",
    manual: "Manual backup", manualHint: "The job runs in the background. You can safely leave this page after it is queued.",
    database: "Database", uploads: "Uploads", runNow: "Run backup now", queueing: "Queueing…", queued: "Backup queued.",
    schedule: "Schedule & local retention", automatic: "Automatic backups", frequency: "Frequency", daily: "Daily", weekly: "Weekly",
    time: "Local start time", timezone: "IANA timezone", weekdays: "Weekdays", retention: "Local archives to retain",
    destinations: "Remote destinations", destinationsHint: "A destination must pass a write/delete probe before it can be enabled.",
    addDestination: "Add destination", editDestination: "Edit destination", name: "Name", protocol: "Protocol", host: "Host",
    port: "Port", username: "Username", remotePath: "Remote directory", remoteRetention: "Remote archives to retain",
    password: "Password", privateKey: "Private key", passphrase: "Key passphrase", fingerprint: "Pinned SHA-256 host key",
    insecure: "I understand that plain FTP sends credentials and backup data without transport encryption.",
    destinationSave: "Save destination", cancel: "Cancel", test: "Test connection", testing: "Testing…", enable: "Enable", disable: "Disable",
    edit: "Edit", remove: "Remove", refreshRemote: "Refresh catalog", verified: "Verified", unverified: "Not verified", credentialsConfigured: "Credential configured",
    plainWarning: "Plain FTP is insecure. Prefer SFTP or explicit FTPS.", noDestinations: "No remote destinations have been configured.",
    history: "Backup history", historyHint: "Local success and each remote delivery are tracked independently.", loadMore: "Load more",
    status: "Status", source: "Source", created: "Created", size: "Size", delivery: "Delivery", actions: "Actions", download: "Download", retryDelivery: "Retry delivery",
    restore: "Restore", noRuns: "No backups have been created yet.", manualTrigger: "Manual", scheduledTrigger: "Scheduled", safetyTrigger: "Safety",
    restoreTitle: "Restore a backup", restoreHint: "Preflight validates and stages the encrypted package before any maintenance begins.",
    restoreHistory: "Restore audit history",
    catalog: "Catalog backup", uploadPackage: "Upload package", chooseRun: "Choose a backup", chooseFile: "Choose .topgsm-backup file",
    preflight: "Run preflight", preflighting: "Validating…", manifest: "Validated package", expires: "Confirmation expires",
    safety: "A new encrypted full safety backup will be retained before replacement begins.", confirmation: "Restore confirmation",
    ownerPassword: "Current owner password", phrase: "Type the generated phrase", confirmRestore: "Enter maintenance and restore",
    confirming: "Confirming…", maintenance: "Maintenance is starting. Keep this page open to monitor progress.",
    newerWarning: "Restores replace platform data and revoke every active session. They cannot be undone without the safety archive.",
    selectSource: "Select a catalog backup or upload a package first.", requestError: "The request could not be completed.",
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  },
  fa: {
    eyebrow: "تاب‌آوری",
    title: "پشتیبان‌گیری و بازیابی",
    intro: "از پایگاه داده و فایل‌ها نسخهٔ رمزگذاری‌شده بسازید، آن را خارج از سرور نگه دارید و با فرایند امن نگه‌داری بازیابی کنید.",
    lastRun: "آخرین اجرا", nextRun: "اجرای زمان‌بندی‌شده بعدی", localStorage: "فضای محلی", failures: "خطاهای اخیر",
    never: "هرگز", notScheduled: "زمان‌بندی نشده", noFailures: "بدون خطا", loading: "در حال بارگذاری…",
    loadError: "تنظیمات پشتیبان بارگذاری نشد.", retry: "تلاش دوباره", save: "ذخیره زمان‌بندی", saving: "در حال ذخیره…", saved: "تنظیمات ذخیره شد.",
    manual: "پشتیبان‌گیری دستی", manualHint: "کار در پس‌زمینه اجرا می‌شود و پس از قرار گرفتن در صف می‌توانید این صفحه را ببندید.",
    database: "پایگاه داده", uploads: "فایل‌های بارگذاری‌شده", runNow: "اجرای پشتیبان", queueing: "در حال ثبت…", queued: "پشتیبان در صف قرار گرفت.",
    schedule: "زمان‌بندی و نگه‌داری محلی", automatic: "پشتیبان‌گیری خودکار", frequency: "تناوب", daily: "روزانه", weekly: "هفتگی",
    time: "زمان محلی", timezone: "منطقه زمانی IANA", weekdays: "روزهای هفته", retention: "تعداد نسخه‌های محلی",
    destinations: "مقصدهای راه دور", destinationsHint: "هر مقصد پیش از فعال شدن باید آزمون نوشتن و حذف را با موفقیت بگذراند.",
    addDestination: "افزودن مقصد", editDestination: "ویرایش مقصد", name: "نام", protocol: "پروتکل", host: "میزبان",
    port: "درگاه", username: "نام کاربری", remotePath: "پوشه راه دور", remoteRetention: "تعداد نسخه‌های راه دور",
    password: "رمز عبور", privateKey: "کلید خصوصی", passphrase: "عبارت کلید", fingerprint: "اثر انگشت SHA-256 میزبان",
    insecure: "می‌دانم FTP ساده اطلاعات ورود و پشتیبان را بدون رمزگذاری انتقال می‌دهد.",
    destinationSave: "ذخیره مقصد", cancel: "انصراف", test: "آزمون اتصال", testing: "در حال آزمون…", enable: "فعال‌سازی", disable: "غیرفعال‌سازی",
    edit: "ویرایش", remove: "حذف", refreshRemote: "به‌روزرسانی فهرست", verified: "تأیید شده", unverified: "تأیید نشده", credentialsConfigured: "اطلاعات ورود ثبت شده",
    plainWarning: "FTP ساده ناامن است؛ SFTP یا FTPS صریح را ترجیح دهید.", noDestinations: "هنوز مقصد راه دوری ثبت نشده است.",
    history: "تاریخچه پشتیبان", historyHint: "موفقیت محلی و تحویل به هر مقصد جداگانه ثبت می‌شود.", loadMore: "نمایش بیشتر",
    status: "وضعیت", source: "منبع", created: "زمان ایجاد", size: "حجم", delivery: "تحویل", actions: "عملیات", download: "دانلود", retryDelivery: "تلاش دوباره تحویل",
    restore: "بازیابی", noRuns: "هنوز پشتیبانی ساخته نشده است.", manualTrigger: "دستی", scheduledTrigger: "زمان‌بندی", safetyTrigger: "ایمنی",
    restoreTitle: "بازیابی پشتیبان", restoreHint: "پیش‌بررسی، بسته رمزگذاری‌شده را پیش از شروع نگه‌داری اعتبارسنجی و آماده می‌کند.",
    restoreHistory: "تاریخچه ممیزی بازیابی",
    catalog: "پشتیبان فهرست", uploadPackage: "بارگذاری بسته", chooseRun: "یک پشتیبان انتخاب کنید", chooseFile: "فایل .topgsm-backup را انتخاب کنید",
    preflight: "اجرای پیش‌بررسی", preflighting: "در حال اعتبارسنجی…", manifest: "بسته معتبر", expires: "پایان اعتبار تأیید",
    safety: "پیش از جایگزینی، یک پشتیبان کامل و رمزگذاری‌شدهٔ ایمنی نگه‌داری می‌شود.", confirmation: "تأیید بازیابی",
    ownerPassword: "رمز فعلی مالک", phrase: "عبارت تولیدشده را وارد کنید", confirmRestore: "ورود به نگه‌داری و بازیابی",
    confirming: "در حال تأیید…", maintenance: "حالت نگه‌داری در حال شروع است. برای مشاهده پیشرفت صفحه را باز نگه دارید.",
    newerWarning: "بازیابی داده‌های پلتفرم را جایگزین و همه نشست‌ها را لغو می‌کند. بدون پشتیبان ایمنی قابل بازگشت نیست.",
    selectSource: "ابتدا یک پشتیبان فهرست را انتخاب یا بسته‌ای بارگذاری کنید.", requestError: "درخواست انجام نشد.",
    days: ["یک", "دو", "سه", "چهار", "پنج", "جمعه", "شنبه"]
  },
  ar: {
    eyebrow: "المرونة",
    title: "النسخ الاحتياطي والاستعادة",
    intro: "أنشئ حزمًا مشفرة لقاعدة البيانات والملفات، وانقلها خارج الخادم، واستعد المنصة عبر وضع صيانة محمي.",
    lastRun: "آخر تشغيل", nextRun: "التشغيل المجدول التالي", localStorage: "التخزين المحلي", failures: "الإخفاقات الأخيرة",
    never: "أبدًا", notScheduled: "غير مجدول", noFailures: "لا يوجد", loading: "جارٍ التحميل…",
    loadError: "تعذر تحميل إعدادات النسخ.", retry: "إعادة المحاولة", save: "حفظ الجدول", saving: "جارٍ الحفظ…", saved: "تم حفظ الإعدادات.",
    manual: "نسخ احتياطي يدوي", manualHint: "تعمل المهمة في الخلفية ويمكنك مغادرة الصفحة بعد إضافتها إلى قائمة الانتظار.",
    database: "قاعدة البيانات", uploads: "الملفات المرفوعة", runNow: "تشغيل النسخ الآن", queueing: "جارٍ الإضافة…", queued: "تمت إضافة النسخ إلى الانتظار.",
    schedule: "الجدولة والاحتفاظ المحلي", automatic: "النسخ التلقائي", frequency: "التكرار", daily: "يومي", weekly: "أسبوعي",
    time: "وقت البدء المحلي", timezone: "منطقة IANA الزمنية", weekdays: "أيام الأسبوع", retention: "عدد النسخ المحلية",
    destinations: "الوجهات البعيدة", destinationsHint: "يجب نجاح اختبار الكتابة والحذف قبل تمكين الوجهة.",
    addDestination: "إضافة وجهة", editDestination: "تعديل الوجهة", name: "الاسم", protocol: "البروتوكول", host: "المضيف",
    port: "المنفذ", username: "اسم المستخدم", remotePath: "المجلد البعيد", remoteRetention: "عدد النسخ البعيدة",
    password: "كلمة المرور", privateKey: "المفتاح الخاص", passphrase: "عبارة المفتاح", fingerprint: "بصمة مضيف SHA-256 المثبتة",
    insecure: "أفهم أن FTP العادي ينقل بيانات الدخول والنسخة دون تشفير النقل.",
    destinationSave: "حفظ الوجهة", cancel: "إلغاء", test: "اختبار الاتصال", testing: "جارٍ الاختبار…", enable: "تمكين", disable: "تعطيل",
    edit: "تعديل", remove: "حذف", refreshRemote: "تحديث السجل", verified: "تم التحقق", unverified: "غير متحقق", credentialsConfigured: "بيانات الدخول مضبوطة",
    plainWarning: "FTP العادي غير آمن. استخدم SFTP أو FTPS الصريح.", noDestinations: "لم تُضف وجهات بعيدة بعد.",
    history: "سجل النسخ", historyHint: "تُسجل النسخة المحلية وتسليم كل وجهة بصورة مستقلة.", loadMore: "تحميل المزيد",
    status: "الحالة", source: "المصدر", created: "الإنشاء", size: "الحجم", delivery: "التسليم", actions: "الإجراءات", download: "تنزيل", retryDelivery: "إعادة التسليم",
    restore: "استعادة", noRuns: "لم تُنشأ نسخ احتياطية بعد.", manualTrigger: "يدوي", scheduledTrigger: "مجدول", safetyTrigger: "أمان",
    restoreTitle: "استعادة نسخة", restoreHint: "يفحص التحقق المسبق الحزمة المشفرة ويجهزها قبل بدء الصيانة.",
    restoreHistory: "سجل تدقيق الاستعادة",
    catalog: "نسخة من السجل", uploadPackage: "رفع حزمة", chooseRun: "اختر نسخة", chooseFile: "اختر ملف .topgsm-backup",
    preflight: "بدء التحقق", preflighting: "جارٍ التحقق…", manifest: "حزمة متحققة", expires: "انتهاء التأكيد",
    safety: "سيُحتفظ بنسخة أمان كاملة ومشفرة قبل بدء الاستبدال.", confirmation: "تأكيد الاستعادة",
    ownerPassword: "كلمة مرور المالك الحالية", phrase: "اكتب العبارة المنشأة", confirmRestore: "بدء الصيانة والاستعادة",
    confirming: "جارٍ التأكيد…", maintenance: "وضع الصيانة قيد البدء. أبقِ الصفحة مفتوحة لمتابعة التقدم.",
    newerWarning: "تستبدل الاستعادة بيانات المنصة وتلغي كل الجلسات النشطة. لا يمكن التراجع دون نسخة الأمان.",
    selectSource: "اختر نسخة من السجل أو ارفع حزمة أولًا.", requestError: "تعذر إكمال الطلب.",
    days: ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
  }
} as const;

type DestinationDraft = {
  name: string; protocol: BackupProtocol; host: string; port: number; username: string; remotePath: string;
  retentionCount: number; password: string; privateKey: string; privateKeyPassphrase: string;
  hostKeyFingerprint: string; allowInsecure: boolean;
};

const emptyDestination = (): DestinationDraft => ({
  name: "", protocol: "sftp", host: "", port: 22, username: "", remotePath: "/topgsm-backups",
  retentionCount: 30, password: "", privateKey: "", privateKeyPassphrase: "", hostKeyFingerprint: "", allowInsecure: false
});

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "response" in error) {
    const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string") return message;
  }
  return fallback;
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) { value /= 1024; unit = units[index]; }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function formatDate(value: string | null, locale: Locale, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function BackupRestoreWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [overview, setOverview] = useState<AdminBackupOverview | null>(null);
  const [runs, setRuns] = useState<AdminBackupRun[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [settings, setSettings] = useState<AdminBackupSettings | null>(null);
  const [manualComponents, setManualComponents] = useState<BackupComponent[]>(["database", "uploads"]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingDestination, setEditingDestination] = useState<string | null>(null);
  const [destinationDraft, setDestinationDraft] = useState<DestinationDraft>(emptyDestination);
  const [showDestinationForm, setShowDestinationForm] = useState(false);
  const [restoreMode, setRestoreMode] = useState<"catalog" | "upload">("catalog");
  const [restoreRunId, setRestoreRunId] = useState("");
  const [remoteArchives, setRemoteArchives] = useState<AdminRemoteBackupArchive[]>([]);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [preflight, setPreflight] = useState<BackupRestorePreflight | null>(null);
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [progress, setProgress] = useState<BackupRestoreProgress | null>(null);

  const load = useCallback(async (cursor?: string) => {
    if (!cursor) setError("");
    try {
      const [overviewResponse, runsResponse] = await Promise.all([
        api.get<AdminBackupOverview>("/admin/backups/overview"),
        api.get<AdminBackupRunPage>("/admin/backups/runs", { params: { limit: 20, ...(cursor ? { cursor } : {}) } })
      ]);
      setOverview(overviewResponse.data);
      setSettings(overviewResponse.data.settings);
      setRuns((current) => cursor ? [...current, ...runsResponse.data.items] : runsResponse.data.items);
      setNextCursor(runsResponse.data.nextCursor);
    } catch (requestError) { setError(errorMessage(requestError, c.loadError)); }
  }, [c.loadError]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!overview?.activeRunId) return;
    const timer = window.setInterval(() => void load(), 6_000);
    return () => window.clearInterval(timer);
  }, [overview?.activeRunId, load]);

  const failures = useMemo(() => runs.filter((run) => run.status === "failed").length, [runs]);
  const lastRun = runs[0] ?? overview?.recentRuns[0];
  const restorableRuns = useMemo(() => runs.filter((run) => ["success", "partial"].includes(run.status) && run.archiveName), [runs]);

  const updateSetting = <K extends keyof AdminBackupSettings>(key: K, value: AdminBackupSettings[K]) => {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  };

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setBusy("settings"); setError(""); setMessage("");
    try {
      const payload = {
        automationEnabled: settings.automationEnabled, frequency: settings.frequency === "disabled" ? "daily" : settings.frequency,
        weekdays: settings.weekdays, localTime: settings.localTime, timezone: settings.timezone,
        includeDatabase: settings.includeDatabase, includeUploads: settings.includeUploads, localRetentionCount: settings.localRetentionCount
      };
      const { data } = await api.patch<AdminBackupSettings>("/admin/backups/settings", payload);
      setSettings(data); setMessage(c.saved); await load();
    } catch (requestError) { setError(errorMessage(requestError, c.requestError)); }
    finally { setBusy(null); }
  }

  async function queueBackup() {
    if (!manualComponents.length) return;
    setBusy("manual"); setError(""); setMessage("");
    try { await api.post("/admin/backups/runs", { components: manualComponents }); setMessage(c.queued); await load(); }
    catch (requestError) { setError(errorMessage(requestError, c.requestError)); }
    finally { setBusy(null); }
  }

  function beginDestinationEdit(destination?: AdminBackupDestination) {
    setEditingDestination(destination?.id ?? null);
    setDestinationDraft(destination ? {
      name: destination.name, protocol: destination.protocol, host: destination.host, port: destination.port,
      username: destination.username, remotePath: destination.remotePath, retentionCount: destination.retentionCount,
      password: "", privateKey: "", privateKeyPassphrase: "", hostKeyFingerprint: destination.hostKeyFingerprint ?? "",
      allowInsecure: destination.allowInsecure
    } : emptyDestination());
    setShowDestinationForm(true);
  }

  async function saveDestination(event: FormEvent) {
    event.preventDefault(); setBusy("destination"); setError(""); setMessage("");
    const payload = Object.fromEntries(Object.entries(destinationDraft).filter(([key, value]) => !(["password", "privateKey", "privateKeyPassphrase"].includes(key) && !value)));
    try {
      if (editingDestination) await api.patch(`/admin/backups/destinations/${editingDestination}`, payload);
      else await api.post("/admin/backups/destinations", payload);
      setShowDestinationForm(false); setEditingDestination(null); setDestinationDraft(emptyDestination()); await load();
    } catch (requestError) { setError(errorMessage(requestError, c.requestError)); }
    finally { setBusy(null); }
  }

  async function destinationAction(id: string, action: "test" | "toggle" | "remove", enabled = false) {
    setBusy(`${action}:${id}`); setError("");
    try {
      if (action === "test") await api.post(`/admin/backups/destinations/${id}/test`);
      if (action === "toggle") await api.patch(`/admin/backups/destinations/${id}`, { enabled: !enabled });
      if (action === "remove") await api.delete(`/admin/backups/destinations/${id}`);
      await load();
    } catch (requestError) { setError(errorMessage(requestError, c.requestError)); }
    finally { setBusy(null); }
  }

  async function refreshRemoteCatalog(id: string) {
    setBusy(`refresh:${id}`); setError("");
    try {
      const { data } = await api.post<AdminRemoteBackupArchive[]>("/admin/backups/runs/remote-refresh", { destinationId: id });
      setRemoteArchives((current) => [...current.filter((item) => item.destinationId !== id), ...data]);
    } catch (requestError) { setError(errorMessage(requestError, c.requestError)); }
    finally { setBusy(null); }
  }

  async function downloadRun(run: AdminBackupRun) {
    setBusy(`download:${run.id}`); setError("");
    try {
      const response = await api.get<Blob>(`/admin/backups/runs/${run.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = run.archiveName ?? "topgsm-backup.topgsm-backup"; anchor.click(); URL.revokeObjectURL(url);
    } catch (requestError) { setError(errorMessage(requestError, c.requestError)); }
    finally { setBusy(null); }
  }

  async function retryDeliveries(run: AdminBackupRun) {
    setBusy(`retry:${run.id}`); setError("");
    try { await api.post(`/admin/backups/runs/${run.id}/retry-deliveries`); await load(); }
    catch (requestError) { setError(errorMessage(requestError, c.requestError)); }
    finally { setBusy(null); }
  }

  async function runPreflight() {
    setBusy("preflight"); setError(""); setMessage(""); setPreflight(null);
    try {
      let source: { runId: string } | { uploadId: string } | { destinationId: string; remoteName: string };
      if (restoreMode === "catalog") {
        if (!restoreRunId) throw new Error(c.selectSource);
        if (restoreRunId.startsWith("remote:")) {
          const [, destinationId, remoteName] = restoreRunId.split(":", 3);
          if (!destinationId || !remoteName) throw new Error(c.selectSource);
          source = { destinationId, remoteName };
        } else source = { runId: restoreRunId };
      } else {
        if (!restoreFile) throw new Error(c.selectSource);
        const form = new FormData(); form.append("file", restoreFile);
        const uploaded = await api.post<{ uploadId: string }>("/admin/backups/restore-uploads", form);
        source = { uploadId: uploaded.data.uploadId };
      }
      const response = await api.post<BackupRestorePreflight>("/admin/backups/restores/preflight", source);
      setPreflight(response.data); setPhrase(""); setPassword("");
    } catch (requestError) { setError(requestError instanceof Error && !("response" in requestError) ? requestError.message : errorMessage(requestError, c.requestError)); }
    finally { setBusy(null); }
  }

  async function confirmRestore(event: FormEvent) {
    event.preventDefault(); if (!preflight) return;
    setBusy("confirm"); setError("");
    try {
      const { data } = await api.post<{ restoreId: string; monitorToken: string }>("/admin/backups/restores/confirm", {
        challengeId: preflight.challengeId, password, phrase
      });
      localStorage.setItem("topgsm-restore-monitor", JSON.stringify({ id: data.restoreId, token: data.monitorToken, locale }));
      setMessage(c.maintenance);
      setProgress({ id: data.restoreId, status: "pending_restart", phase: "validating", message: c.maintenance, updatedAt: new Date().toISOString() });
    } catch (requestError) { setError(errorMessage(requestError, c.requestError)); }
    finally { setBusy(null); }
  }

  if (!overview || !settings) return <section className={styles.workspace}><p className={styles.loading}>{error || c.loading}</p>{error ? <button className={styles.primary} onClick={() => void load()}>{c.retry}</button> : null}</section>;

  return <section className={styles.workspace} aria-labelledby="backup-title" dir={locale === "en" ? "ltr" : "rtl"}>
    <header className={styles.header}><div><span>{c.eyebrow}</span><h1 id="backup-title">{c.title}</h1></div><p>{c.intro}</p></header>

    {(message || error) ? <div className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>{error || message}</div> : null}

    <div className={styles.summary}>
      <article><span>{c.lastRun}</span><strong>{lastRun ? formatDate(lastRun.completedAt ?? lastRun.createdAt, locale, c.never) : c.never}</strong><small data-status={lastRun?.status}>{lastRun?.status ?? "—"}</small></article>
      <article><span>{c.nextRun}</span><strong>{formatDate(settings.nextRunAt, locale, c.notScheduled)}</strong><small>{settings.timezone}</small></article>
      <article><span>{c.localStorage}</span><strong>{formatBytes(overview.localArchiveBytes)}</strong><small>{settings.localRetentionCount} {c.retention.toLocaleLowerCase()}</small></article>
      <article><span>{c.failures}</span><strong>{failures || c.noFailures}</strong><small>{runs.length} {c.history.toLocaleLowerCase()}</small></article>
    </div>

    <div className={styles.columns}>
      <section className={styles.panel}><div className={styles.sectionHeading}><div><h2>{c.manual}</h2><p>{c.manualHint}</p></div></div>
        <div className={styles.inlineControls}>
          {(["database", "uploads"] as const).map((component) => <label className={styles.check} key={component}><input type="checkbox" checked={manualComponents.includes(component)} onChange={(event) => setManualComponents((current) => event.target.checked ? [...new Set([...current, component])] : current.filter((item) => item !== component))} /><span>{component === "database" ? c.database : c.uploads}</span></label>)}
          <button className={styles.primary} type="button" disabled={!manualComponents.length || Boolean(overview.activeRunId) || busy === "manual"} onClick={() => void queueBackup()}>{busy === "manual" ? c.queueing : c.runNow}</button>
        </div>
      </section>

      <form className={styles.panel} onSubmit={saveSettings}>
        <div className={styles.sectionHeading}><div><h2>{c.schedule}</h2><p>{settings.nextRunAt ? formatDate(settings.nextRunAt, locale, c.notScheduled) : c.notScheduled}</p></div><label className={styles.switch}><span>{c.automatic}</span><input type="checkbox" checked={settings.automationEnabled} onChange={(event) => updateSetting("automationEnabled", event.target.checked)} /></label></div>
        <div className={styles.formGrid}>
          <label><span>{c.frequency}</span><select value={settings.frequency === "disabled" ? "daily" : settings.frequency} onChange={(event) => updateSetting("frequency", event.target.value as "daily" | "weekly")}><option value="daily">{c.daily}</option><option value="weekly">{c.weekly}</option></select></label>
          <label><span>{c.time}</span><input type="time" value={settings.localTime} onChange={(event) => updateSetting("localTime", event.target.value)} /></label>
          <label><span>{c.timezone}</span><input value={settings.timezone} onChange={(event) => updateSetting("timezone", event.target.value)} /></label>
          <label><span>{c.retention}</span><input type="number" min={1} max={100} value={settings.localRetentionCount} onChange={(event) => updateSetting("localRetentionCount", Number(event.target.value))} /></label>
        </div>
        {settings.frequency === "weekly" ? <fieldset className={styles.weekdays}><legend>{c.weekdays}</legend>{c.days.map((day, index) => <label key={day}><input type="checkbox" checked={settings.weekdays.includes(index)} onChange={(event) => updateSetting("weekdays", event.target.checked ? [...settings.weekdays, index].sort() : settings.weekdays.filter((value) => value !== index))} /><span>{day}</span></label>)}</fieldset> : null}
        <div className={styles.inlineControls}>{(["database", "uploads"] as const).map((component) => <label className={styles.check} key={component}><input type="checkbox" checked={component === "database" ? settings.includeDatabase : settings.includeUploads} onChange={(event) => updateSetting(component === "database" ? "includeDatabase" : "includeUploads", event.target.checked)} /><span>{component === "database" ? c.database : c.uploads}</span></label>)}<button className={styles.primary} disabled={busy === "settings" || (!settings.includeDatabase && !settings.includeUploads)}>{busy === "settings" ? c.saving : c.save}</button></div>
      </form>
    </div>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>{c.destinations}</h2><p>{c.destinationsHint}</p></div><button className={styles.secondary} type="button" onClick={() => beginDestinationEdit()}>{c.addDestination}</button></div>
      {showDestinationForm ? <form className={styles.destinationForm} onSubmit={saveDestination}>
        <h3>{editingDestination ? c.editDestination : c.addDestination}</h3>
        <div className={styles.formGrid}>
          <label><span>{c.name}</span><input required maxLength={100} value={destinationDraft.name} onChange={(event) => setDestinationDraft({ ...destinationDraft, name: event.target.value })} /></label>
          <label><span>{c.protocol}</span><select value={destinationDraft.protocol} onChange={(event) => { const protocol = event.target.value as BackupProtocol; setDestinationDraft({ ...destinationDraft, protocol, port: protocol === "sftp" ? 22 : 21, allowInsecure: protocol === "ftp" ? destinationDraft.allowInsecure : false }); }}><option value="sftp">SFTP</option><option value="ftps">FTPS</option><option value="ftp">FTP</option></select></label>
          <label><span>{c.host}</span><input required value={destinationDraft.host} onChange={(event) => setDestinationDraft({ ...destinationDraft, host: event.target.value })} /></label>
          <label><span>{c.port}</span><input required type="number" min={1} max={65535} value={destinationDraft.port} onChange={(event) => setDestinationDraft({ ...destinationDraft, port: Number(event.target.value) })} /></label>
          <label><span>{c.username}</span><input required value={destinationDraft.username} onChange={(event) => setDestinationDraft({ ...destinationDraft, username: event.target.value })} /></label>
          <label><span>{c.remotePath}</span><input required value={destinationDraft.remotePath} onChange={(event) => setDestinationDraft({ ...destinationDraft, remotePath: event.target.value })} /></label>
          <label><span>{c.remoteRetention}</span><input required type="number" min={1} max={365} value={destinationDraft.retentionCount} onChange={(event) => setDestinationDraft({ ...destinationDraft, retentionCount: Number(event.target.value) })} /></label>
          <label><span>{c.password}</span><input type="password" autoComplete="new-password" value={destinationDraft.password} onChange={(event) => setDestinationDraft({ ...destinationDraft, password: event.target.value })} /></label>
          {destinationDraft.protocol === "sftp" ? <><label className={styles.full}><span>{c.fingerprint}</span><input required placeholder="SHA256:…" value={destinationDraft.hostKeyFingerprint} onChange={(event) => setDestinationDraft({ ...destinationDraft, hostKeyFingerprint: event.target.value })} /></label><label className={styles.full}><span>{c.privateKey}</span><textarea rows={5} value={destinationDraft.privateKey} onChange={(event) => setDestinationDraft({ ...destinationDraft, privateKey: event.target.value })} /></label><label><span>{c.passphrase}</span><input type="password" value={destinationDraft.privateKeyPassphrase} onChange={(event) => setDestinationDraft({ ...destinationDraft, privateKeyPassphrase: event.target.value })} /></label></> : null}
        </div>
        {destinationDraft.protocol === "ftp" ? <label className={styles.dangerCheck}><input required type="checkbox" checked={destinationDraft.allowInsecure} onChange={(event) => setDestinationDraft({ ...destinationDraft, allowInsecure: event.target.checked })} /><span>{c.insecure}</span></label> : null}
        <div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => setShowDestinationForm(false)}>{c.cancel}</button><button className={styles.primary} disabled={busy === "destination"}>{c.destinationSave}</button></div>
      </form> : null}
      <div className={styles.destinationGrid}>{overview.destinations.length ? overview.destinations.map((destination) => <article className={styles.destinationCard} key={destination.id}>
        <div><span className={styles.protocol}>{destination.protocol.toUpperCase()}</span><span className={destination.verifiedAt ? styles.good : styles.muted}>{destination.verifiedAt ? c.verified : c.unverified}</span></div>
        <h3>{destination.name}</h3><p>{destination.username}@{destination.host}:{destination.port}</p><code>{destination.remotePath}</code>
        {destination.protocol === "ftp" ? <p className={styles.warning}>{c.plainWarning}</p> : null}
        <small>{destination.credentialConfigured || destination.privateKeyConfigured ? c.credentialsConfigured : c.unverified} · {destination.retentionCount} {c.remoteRetention.toLocaleLowerCase()}</small>
        <div className={styles.cardActions}><button type="button" onClick={() => beginDestinationEdit(destination)}>{c.edit}</button><button type="button" disabled={busy === `test:${destination.id}`} onClick={() => void destinationAction(destination.id, "test")}>{busy === `test:${destination.id}` ? c.testing : c.test}</button><button type="button" disabled={!destination.verifiedAt || busy === `toggle:${destination.id}`} onClick={() => void destinationAction(destination.id, "toggle", destination.enabled)}>{destination.enabled ? c.disable : c.enable}</button><button type="button" disabled={!destination.verifiedAt || busy === `refresh:${destination.id}`} onClick={() => void refreshRemoteCatalog(destination.id)}>{c.refreshRemote}</button><button type="button" onClick={() => void destinationAction(destination.id, "remove")}>{c.remove}</button></div>
      </article>) : <p className={styles.empty}>{c.noDestinations}</p>}</div>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>{c.history}</h2><p>{c.historyHint}</p></div></div>
      {runs.length ? <div className={styles.tableWrap}><table><thead><tr><th>{c.status}</th><th>{c.source}</th><th>{c.created}</th><th>{c.size}</th><th>{c.delivery}</th><th>{c.actions}</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td><span className={styles.status} data-status={run.status}>{run.status}</span></td><td>{run.trigger === "manual" ? c.manualTrigger : run.trigger === "scheduled" ? c.scheduledTrigger : c.safetyTrigger}<small>{run.components.map((item) => item === "database" ? c.database : c.uploads).join(" + ")}</small></td><td>{formatDate(run.createdAt, locale, c.never)}</td><td>{formatBytes(run.archiveBytes)}</td><td>{run.deliveries.length ? run.deliveries.map((delivery) => <span className={styles.delivery} data-status={delivery.status} key={delivery.id}>{delivery.destinationName}: {delivery.status}</span>) : "—"}</td><td><div className={styles.tableActions}>{run.archiveName ? <button type="button" onClick={() => void downloadRun(run)}>{c.download}</button> : null}{run.deliveries.some((delivery) => delivery.status === "failed") ? <button type="button" disabled={busy === `retry:${run.id}`} onClick={() => void retryDeliveries(run)}>{c.retryDelivery}</button> : null}{run.archiveName && ["success", "partial"].includes(run.status) ? <button type="button" onClick={() => { setRestoreMode("catalog"); setRestoreRunId(run.id); document.getElementById("restore-workspace")?.scrollIntoView({ behavior: "smooth" }); }}>{c.restore}</button> : null}</div></td></tr>)}</tbody></table></div> : <p className={styles.empty}>{c.noRuns}</p>}
      {nextCursor ? <button className={styles.loadMore} type="button" onClick={() => void load(nextCursor)}>{c.loadMore}</button> : null}
    </section>

    <section className={`${styles.section} ${styles.restoreSection}`} id="restore-workspace">
      <div className={styles.sectionHeading}><div><h2>{c.restoreTitle}</h2><p>{c.restoreHint}</p></div></div>
      <p className={styles.restoreWarning}>{c.newerWarning}</p>
      <div className={styles.modeSwitch}><button type="button" data-active={restoreMode === "catalog"} onClick={() => { setRestoreMode("catalog"); setPreflight(null); }}>{c.catalog}</button><button type="button" data-active={restoreMode === "upload"} onClick={() => { setRestoreMode("upload"); setPreflight(null); }}>{c.uploadPackage}</button></div>
      {restoreMode === "catalog" ? <label className={styles.sourceField}><span>{c.chooseRun}</span><select value={restoreRunId} onChange={(event) => { setRestoreRunId(event.target.value); setPreflight(null); }}><option value="">—</option>{restorableRuns.map((run) => <option key={run.id} value={run.id}>{formatDate(run.createdAt, locale, c.never)} · {run.components.join(" + ")} · {formatBytes(run.archiveBytes)}</option>)}{remoteArchives.map((archive) => <option key={`${archive.destinationId}:${archive.name}`} value={`remote:${archive.destinationId}:${archive.name}`}>{archive.destinationName} · {archive.name} · {formatBytes(archive.bytes)}</option>)}</select></label> : <label className={styles.sourceField}><span>{c.chooseFile}</span><input type="file" accept=".topgsm-backup,application/octet-stream" onChange={(event) => { setRestoreFile(event.target.files?.[0] ?? null); setPreflight(null); }} /></label>}
      <button className={styles.secondary} type="button" disabled={busy === "preflight"} onClick={() => void runPreflight()}>{busy === "preflight" ? c.preflighting : c.preflight}</button>
      {preflight ? <div className={styles.preflight}>
        <div><span>{c.manifest}</span><strong>{preflight.manifest.archiveId}</strong><small>{preflight.manifest.components.join(" + ")} · {formatBytes(preflight.manifest.databaseBytes + preflight.manifest.uploadsBytes)} · PostgreSQL {preflight.manifest.postgresMajor}</small></div>
        <div><span>{c.expires}</span><strong>{formatDate(preflight.expiresAt, locale, c.never)}</strong><small>{c.safety}</small></div>
        <form onSubmit={confirmRestore}><h3>{c.confirmation}</h3><label><span>{c.ownerPassword}</span><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label><span>{c.phrase}</span><code>{preflight.confirmationPhrase}</code><input required value={phrase} onChange={(event) => setPhrase(event.target.value)} /></label><button className={styles.danger} disabled={busy === "confirm"}>{busy === "confirm" ? c.confirming : c.confirmRestore}</button></form>
      </div> : null}
      {progress ? <div className={styles.progress} role="status"><span>{progress.phase}</span><strong>{progress.message}</strong></div> : null}
      {overview.recentRestores.length ? <div className={styles.audit}><h3>{c.restoreHistory}</h3>{overview.recentRestores.map((event) => <div key={event.id}><span className={styles.status} data-status={event.status}>{event.status}</span><code>{event.archiveId ?? "—"}</code><span>{event.phase}</span><time>{formatDate(event.createdAt, locale, c.never)}</time></div>)}</div> : null}
    </section>
  </section>;
}
