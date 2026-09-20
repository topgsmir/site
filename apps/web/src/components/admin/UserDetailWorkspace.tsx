"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { AdminUserHistoryPage, AdminUserSummary } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./UsersWorkspace.module.css";

const groups = {
  commerce: ["orders", "checkouts", "payments", "entitlements"],
  account: ["comments", "communications", "sessions", "ai"],
  administration: ["seller", "activity", "profile", "related"]
} as const;
type Section = (typeof groups)[keyof typeof groups][number];

const copy = {
  en: { back: "Back to users", edit: "Edit profile", cancel: "Cancel", save: "Save changes", saving: "Saving…", saved: "Profile updated.", saveError: "Could not save. Check whether the email, username, or phone is already in use.", discard: "Discard your unsaved profile changes?", fullName: "Full name", username: "Username", email: "Email", phoneNumber: "Phone number", none: "Not provided", role: "Role", joined: "Joined", updated: "Last updated", ordersCount: "Orders", userId: "User ID", copyId: "Copy ID", copied: "ID copied", copyError: "Could not copy ID", history: "Account history", records: "records", refresh: "Refresh", loading: "Loading records…", historyError: "Records could not be loaded.", retry: "Try again", empty: "No records in this category.", details: "View details", hideDetails: "Hide details", recordId: "Record ID", previous: "Previous", next: "Next", current: "Current", page: "Page", of: "of", perPage: "Per page", groupCommerce: "Purchases", groupAccount: "Account activity", groupAdministration: "Administration", category: "History category", yes: "Yes", no: "No", orderAction: "Order action", flaggedComment: "Flagged comment", profileEdited: "Profile edited", session: "Session", smsDelivery: "SMS delivery", otpChallenge: "OTP challenge", digitalAccess: "Digital access", aiConversation: "AI conversation", sellerMembership: "Seller membership" },
  fa: { back: "بازگشت به کاربران", edit: "ویرایش اطلاعات", cancel: "انصراف", save: "ذخیره تغییرات", saving: "در حال ذخیره…", saved: "اطلاعات کاربر به‌روز شد.", saveError: "ذخیره نشد. تکراری نبودن ایمیل، نام کاربری و شماره تماس را بررسی کنید.", discard: "تغییرات ذخیره‌نشده را کنار بگذارید؟", fullName: "نام و نام خانوادگی", username: "نام کاربری", email: "ایمیل", phoneNumber: "شماره تماس", none: "ثبت نشده", role: "نقش", joined: "تاریخ عضویت", updated: "آخرین به‌روزرسانی", ordersCount: "سفارش‌ها", userId: "شناسه کاربر", copyId: "کپی شناسه", copied: "شناسه کپی شد", copyError: "شناسه کپی نشد", history: "سوابق کاربر", records: "مورد", refresh: "بارگذاری دوباره", loading: "در حال بارگذاری سوابق…", historyError: "سوابق بارگذاری نشد. دوباره تلاش کنید.", retry: "تلاش دوباره", empty: "در این بخش سابقه‌ای ثبت نشده است.", details: "مشاهده جزئیات", hideDetails: "بستن جزئیات", recordId: "شناسه سابقه", previous: "قبلی", next: "بعدی", current: "فعلی", page: "صفحه", of: "از", perPage: "در هر صفحه", groupCommerce: "خریدها", groupAccount: "فعالیت حساب", groupAdministration: "مدیریت", category: "دسته سوابق", yes: "بله", no: "خیر", orderAction: "تغییر سفارش", flaggedComment: "دیدگاه گزارش‌شده", profileEdited: "ویرایش اطلاعات", session: "نشست", smsDelivery: "ارسال پیامک", otpChallenge: "درخواست رمز یک‌بارمصرف", digitalAccess: "دسترسی دیجیتال", aiConversation: "گفت‌وگوی هوش مصنوعی", sellerMembership: "عضویت فروشنده" },
  ar: { back: "العودة إلى المستخدمين", edit: "تعديل البيانات", cancel: "إلغاء", save: "حفظ التغييرات", saving: "جارٍ الحفظ…", saved: "تم تحديث بيانات المستخدم.", saveError: "تعذر الحفظ. تحقق من أن البريد واسم المستخدم والهاتف غير مستخدمة.", discard: "هل تريد تجاهل التغييرات غير المحفوظة؟", fullName: "الاسم الكامل", username: "اسم المستخدم", email: "البريد الإلكتروني", phoneNumber: "رقم الهاتف", none: "غير مسجل", role: "الدور", joined: "تاريخ الانضمام", updated: "آخر تحديث", ordersCount: "الطلبات", userId: "معرّف المستخدم", copyId: "نسخ المعرّف", copied: "تم نسخ المعرّف", copyError: "تعذر نسخ المعرّف", history: "سجل المستخدم", records: "سجل", refresh: "تحديث", loading: "جارٍ تحميل السجلات…", historyError: "تعذر تحميل السجلات. حاول مجدداً.", retry: "حاول مجدداً", empty: "لا توجد سجلات في هذا القسم.", details: "عرض التفاصيل", hideDetails: "إخفاء التفاصيل", recordId: "معرّف السجل", previous: "السابق", next: "التالي", current: "الحالي", page: "صفحة", of: "من", perPage: "في الصفحة", groupCommerce: "المشتريات", groupAccount: "نشاط الحساب", groupAdministration: "الإدارة", category: "فئة السجل", yes: "نعم", no: "لا", orderAction: "تغيير الطلب", flaggedComment: "تعليق مبلّغ عنه", profileEdited: "تعديل البيانات", session: "جلسة", smsDelivery: "إرسال رسالة", otpChallenge: "طلب رمز تحقق", digitalAccess: "وصول رقمي", aiConversation: "محادثة ذكاء اصطناعي", sellerMembership: "عضوية بائع" }
} as const;

const sectionNames: Record<Locale, Record<Section, string>> = {
  en: { orders: "Orders", checkouts: "Checkouts", payments: "Payments", entitlements: "Digital access", comments: "Comments", communications: "SMS & OTP", sessions: "Sessions", ai: "AI conversations", seller: "Seller accounts", activity: "Actions", profile: "Profile changes", related: "Other records" },
  fa: { orders: "سفارش‌ها", checkouts: "تسویه‌ها", payments: "پرداخت‌ها", entitlements: "دسترسی دیجیتال", comments: "دیدگاه‌ها", communications: "پیامک و رمز", sessions: "نشست‌ها", ai: "گفت‌وگوهای هوش مصنوعی", seller: "فروشندگی", activity: "اقدام‌ها", profile: "تغییرات اطلاعات", related: "سایر سوابق" },
  ar: { orders: "الطلبات", checkouts: "عمليات الدفع", payments: "المدفوعات", entitlements: "الوصول الرقمي", comments: "التعليقات", communications: "الرسائل والرموز", sessions: "الجلسات", ai: "محادثات الذكاء الاصطناعي", seller: "حسابات البائع", activity: "الإجراءات", profile: "تغييرات البيانات", related: "سجلات أخرى" }
};
const roleNames: Record<Locale, Record<string, string>> = {
  en: { buyer: "Buyer", seller_admin: "Seller admin", seller_staff: "Seller staff", platform_staff: "Platform staff", platform_admin: "Platform admin" },
  fa: { buyer: "خریدار", seller_admin: "مدیر فروشنده", seller_staff: "همکار فروشنده", platform_staff: "همکار پلتفرم", platform_admin: "مدیر پلتفرم" },
  ar: { buyer: "مشترٍ", seller_admin: "مدير بائع", seller_staff: "موظف بائع", platform_staff: "موظف منصة", platform_admin: "مدير منصة" }
};
const groupNames: Record<Locale, Record<keyof typeof groups, string>> = {
  en: { commerce: copy.en.groupCommerce, account: copy.en.groupAccount, administration: copy.en.groupAdministration },
  fa: { commerce: copy.fa.groupCommerce, account: copy.fa.groupAccount, administration: copy.fa.groupAdministration },
  ar: { commerce: copy.ar.groupCommerce, account: copy.ar.groupAccount, administration: copy.ar.groupAdministration }
};

const fieldNames: Record<Locale, Record<string, string>> = {
  en: { seller: "Seller", amount: "Amount", currency: "Currency", products: "Products", payments: "Payments", statusHistory: "Status history", destination: "Destination", orderId: "Order ID", provider: "Provider", verifiedAt: "Verified", refundedAt: "Refunded", failureCode: "Failure", refund: "Refund", expiresAt: "Expires", paymentGroups: "Payment groups", product: "Product", downloads: "Downloads", maximum: "Maximum downloads", lastAccessedAt: "Last accessed", status: "Status", body: "Comment", flaggedByUser: "Flagged by user", detail: "Detail", revokedAt: "Revoked", active: "Active", shop: "Shop", role: "Role", approved: "Approved", suspendedAt: "Suspended", title: "Title", capability: "Capability", messages: "Messages", runs: "Runs", deletedAt: "Deleted", reference: "Reference", action: "Action", actorId: "Edited by", eventType: "Event", permission: "Permission", enabled: "Enabled", name: "Name", from: "Previous status", to: "New status", fullName: "Full name", username: "Username", email: "Email", phoneNumber: "Phone" },
  fa: { seller: "فروشنده", amount: "مبلغ", currency: "ارز", products: "محصولات", payments: "پرداخت‌ها", statusHistory: "تاریخچه وضعیت", destination: "مقصد", orderId: "شناسه سفارش", provider: "درگاه", verifiedAt: "تأیید", refundedAt: "بازپرداخت", failureCode: "خطا", refund: "بازپرداخت", expiresAt: "انقضا", paymentGroups: "گروه‌های پرداخت", product: "محصول", downloads: "دانلودها", maximum: "سقف دانلود", lastAccessedAt: "آخرین دسترسی", status: "وضعیت", body: "متن دیدگاه", flaggedByUser: "گزارش‌شده توسط کاربر", detail: "جزئیات", revokedAt: "لغو", active: "فعال", shop: "فروشگاه", role: "نقش", approved: "تأییدشده", suspendedAt: "تعلیق", title: "عنوان", capability: "قابلیت", messages: "پیام‌ها", runs: "اجراها", deletedAt: "حذف", reference: "ارجاع", action: "اقدام", actorId: "ویرایش‌کننده", eventType: "رویداد", permission: "دسترسی", enabled: "فعال", name: "نام", from: "وضعیت قبلی", to: "وضعیت جدید", fullName: "نام و نام خانوادگی", username: "نام کاربری", email: "ایمیل", phoneNumber: "شماره تماس" },
  ar: { seller: "البائع", amount: "المبلغ", currency: "العملة", products: "المنتجات", payments: "المدفوعات", statusHistory: "سجل الحالة", destination: "الوجهة", orderId: "معرّف الطلب", provider: "المزود", verifiedAt: "التحقق", refundedAt: "رد المبلغ", failureCode: "الخطأ", refund: "الاسترداد", expiresAt: "الانتهاء", paymentGroups: "مجموعات الدفع", product: "المنتج", downloads: "التنزيلات", maximum: "حد التنزيل", lastAccessedAt: "آخر وصول", status: "الحالة", body: "التعليق", flaggedByUser: "أبلغ عنه المستخدم", detail: "التفاصيل", revokedAt: "الإلغاء", active: "نشط", shop: "المتجر", role: "الدور", approved: "معتمد", suspendedAt: "التعليق", title: "العنوان", capability: "القدرة", messages: "الرسائل", runs: "التشغيلات", deletedAt: "الحذف", reference: "المرجع", action: "الإجراء", actorId: "المحرر", eventType: "الحدث", permission: "الصلاحية", enabled: "مفعّل", name: "الاسم", from: "الحالة السابقة", to: "الحالة الجديدة", fullName: "الاسم الكامل", username: "اسم المستخدم", email: "البريد الإلكتروني", phoneNumber: "الهاتف" }
};

type HistoryEntry = AdminUserHistoryPage["items"][number];
type DetailValue = HistoryEntry["details"][string];
const profileFields = ["fullName", "username", "email", "phoneNumber"] as const;
const dateKey = /(?:At|Date)$/;
const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
const readableKey = (key: string, locale: Locale) => fieldNames[locale][key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
const readableValue = (value: DetailValue, key: string, locale: Locale) => {
  if (value === null || value === "") return copy[locale].none;
  if (typeof value === "boolean" || value === "true" || value === "false") return (value === true || value === "true") ? copy[locale].yes : copy[locale].no;
  if (typeof value === "string" && dateKey.test(key) && isIsoDate(value)) return new Date(value).toLocaleString(locale);
  if (/(?:amount|price|fee|cost|total|balance)$/i.test(key) && /^-?\d+(?:\.\d+)?$/.test(String(value))) return `${formatCurrencyAmount(String(value), "TOMAN", locale)} ${currencyLabel("TOMAN")}`;
  if (typeof value === "string" && ["status", "action", "refund", "from", "to"].includes(key)) return value.replaceAll("_", " ");
  return String(value);
};
const initialForm = (user: AdminUserSummary) => ({ fullName: user.fullName, username: user.username ?? "", email: user.email ?? "", phoneNumber: user.phoneNumber ?? "" });

function displayTitle(entry: HistoryEntry, section: Section, locale: Locale) {
  const c = copy[locale];
  const known: Record<string, string> = {
    "Order action": c.orderAction, "Flagged comment": c.flaggedComment,
    "Profile edited": c.profileEdited, Session: c.session,
    "SMS delivery": c.smsDelivery, "OTP challenge": c.otpChallenge,
    "Digital access": c.digitalAccess, "AI conversation": c.aiConversation,
    "Seller membership": c.sellerMembership
  };
  if (known[entry.title]) return known[entry.title];
  if (section === "related") return entry.title.replaceAll("_", " ");
  if (entry.title.includes(" · ")) return `${sectionNames[locale][section]} · ${entry.title.split(" · ")[1].replaceAll("_", " ")}`;
  return sectionNames[locale][section];
}

function changedProfileFields(entry: HistoryEntry) {
  try {
    const before = JSON.parse(String(entry.details.before ?? "{}")) as Record<string, unknown>;
    const after = JSON.parse(String(entry.details.after ?? "{}")) as Record<string, unknown>;
    return profileFields.filter((field) => before[field] !== after[field]);
  } catch { return []; }
}

function ProfileChanges({ entry, locale }: { entry: HistoryEntry; locale: Locale }) {
  let before: Record<string, unknown> = {};
  let after: Record<string, unknown> = {};
  try { before = JSON.parse(String(entry.details.before ?? "{}")); after = JSON.parse(String(entry.details.after ?? "{}")); }
  catch { return null; }
  return <div className={styles.changes}><div className={styles.changeHeader}><span /><span>{copy[locale].previous}</span><span /><span>{copy[locale].current}</span></div>{changedProfileFields(entry).map((field) => <div className={styles.change} key={field}>
    <strong>{readableKey(field, locale)}</strong>
    <div className={styles.changeValue}><small>{copy[locale].previous}</small><span dir="auto">{String(before[field] || copy[locale].none)}</span></div>
    <span aria-hidden="true">→</span>
    <div className={styles.changeValue}><small>{copy[locale].current}</small><span dir="auto">{String(after[field] || copy[locale].none)}</span></div>
  </div>)}</div>;
}

function HistoryRecord({ entry, section, locale }: { entry: HistoryEntry; section: Section; locale: Locale }) {
  const c = copy[locale];
  const fields = Object.entries(entry.details).filter(([key, value]) => value !== null && value !== "" && key !== "before" && key !== "after");
  const preview = section === "profile" ? changedProfileFields(entry).map((field) => readableKey(field, locale)).join(" · ") : fields.filter(([key]) => key !== "actorId").slice(0, 2).map(([key, value]) => `${readableKey(key, locale)}: ${readableValue(value, key, locale)}`).join(" · ");
  return <details className={styles.record}>
    <summary className={styles.recordSummary}>
      <span className={styles.recordMain}><strong>{displayTitle(entry, section, locale)}</strong><span className={styles.recordPreview}>{preview}</span></span>
      <span className={styles.recordSide}><time>{entry.at ? new Date(entry.at).toLocaleString(locale) : "—"}</time><span className={styles.showDetails}>{c.details}</span><span className={styles.hideDetails}>{c.hideDetails}</span></span>
    </summary>
    <div className={styles.recordBody}>
      {section === "profile" ? <ProfileChanges entry={entry} locale={locale} /> : null}
      {fields.length ? <dl className={styles.recordFields}>{fields.map(([key, value]) => <div key={key}><dt>{readableKey(key, locale)}</dt><dd dir="auto">{readableValue(value, key, locale)}</dd></div>)}</dl> : null}
      <div className={styles.recordId}><span>{c.recordId}</span><code dir="ltr">{entry.id}</code></div>
    </div>
  </details>;
}

export function UserDetailWorkspace({ locale, user, onBack, onSaved }: { locale: Locale; user: AdminUserSummary; onBack: () => void; onSaved: (user: AdminUserSummary) => void }) {
  const c = copy[locale];
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [form, setForm] = useState(() => initialForm(user));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [section, setSection] = useState<Section>("orders");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [history, setHistory] = useState<AdminUserHistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");
  useEffect(() => { titleRef.current?.focus(); }, []);

  const dirty = form.fullName !== user.fullName || form.username !== (user.username ?? "") || form.email !== user.email || form.phoneNumber !== (user.phoneNumber ?? "");
  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setHistoryError(false); setHistory(null);
    try {
      const response = await api.get<AdminUserHistoryPage>(`/admin/users/${user.id}/history`, { params: { section, page, limit: pageSize }, signal });
      if (!signal?.aborted) {
        const lastPage = Math.max(1, Math.ceil(response.data.total / response.data.pageSize));
        if (page > lastPage) setPage(lastPage);
        else setHistory(response.data);
      }
    } catch { if (!signal?.aborted) setHistoryError(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [user.id, section, page, pageSize]);
  useEffect(() => { const controller = new AbortController(); void loadHistory(controller.signal); return () => controller.abort(); }, [loadHistory, revision]);

  function selectSection(next: Section) { setSection(next); setPage(1); }
  function cancelEdit() { setForm(initialForm(user)); setEditing(false); setSaveMessage(""); }
  function goBack() { if (editing && dirty && !window.confirm(c.discard)) return; onBack(); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true); setSaveMessage("");
    try {
      const response = await api.patch<AdminUserSummary>(`/admin/users/${user.id}`, { fullName: form.fullName, username: form.username || null, email: form.email, phoneNumber: form.phoneNumber || null });
      onSaved(response.data); setForm(initialForm(response.data)); setEditing(false); setSaveMessage(c.saved);
      if (section === "profile" || section === "related") setRevision((current) => current + 1);
    } catch { setSaveMessage(c.saveError); }
    finally { setSaving(false); }
  }
  async function copyId() {
    try { await navigator.clipboard.writeText(user.id); setCopyMessage(c.copied); }
    catch { setCopyMessage(c.copyError); }
  }

  const pageCount = Math.max(1, Math.ceil((history?.total ?? 0) / (history?.pageSize ?? pageSize)));
  const firstRecord = history?.total ? (history.page - 1) * history.pageSize + 1 : 0;
  const lastRecord = history ? Math.min(history.page * history.pageSize, history.total) : 0;
  const visiblePages = Array.from(new Set([1, page - 1, page, page + 1, pageCount])).filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  return <div className={styles.detailWorkspace}>
    <button className={styles.back} type="button" onClick={goBack}>{c.back}</button>
    <section className={styles.personCard} aria-labelledby="selected-user-name">
      <div className={styles.personHeader}><div className={styles.personIdentity}><span className={styles.avatar} aria-hidden="true">{user.fullName.trim().slice(0, 1).toLocaleUpperCase(locale)}</span><div><span className={styles.roleBadge}>{roleNames[locale][user.role] ?? user.role}</span><h2 id="selected-user-name" ref={titleRef} tabIndex={-1}>{user.fullName}</h2><p dir="ltr">{user.email}</p></div></div><button className={styles.secondaryButton} type="button" onClick={() => { if (editing) cancelEdit(); else { setEditing(true); setSaveMessage(""); } }}>{editing ? c.cancel : c.edit}</button></div>
      <dl className={styles.factGrid}>
        <div><dt>{c.phoneNumber}</dt><dd dir="ltr">{user.phoneNumber ?? c.none}</dd></div>
        <div><dt>{c.username}</dt><dd dir="ltr">{user.username ?? c.none}</dd></div>
        <div><dt>{c.ordersCount}</dt><dd>{user.orderCount.toLocaleString(locale)}</dd></div>
        <div><dt>{c.joined}</dt><dd>{new Date(user.createdAt).toLocaleDateString(locale)}</dd></div>
        <div><dt>{c.updated}</dt><dd>{new Date(user.updatedAt).toLocaleDateString(locale)}</dd></div>
        <div><dt>{c.userId}</dt><dd className={styles.idValue}><code dir="ltr">{user.id}</code><button type="button" onClick={() => void copyId()}>{c.copyId}</button></dd></div>
      </dl>
      {copyMessage ? <p className={styles.inlineStatus} role="status">{copyMessage}</p> : null}
    </section>

    {editing ? <section className={styles.editPanel} aria-labelledby="edit-user-title"><h3 id="edit-user-title">{c.edit}</h3><form onSubmit={(event) => void save(event)}><div className={styles.editFields}>
      <label>{c.fullName}<input required minLength={2} maxLength={100} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
      <label>{c.username}<input dir="ltr" minLength={3} maxLength={32} pattern="[a-z0-9_]*" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
      <label>{c.email}<input dir="ltr" required type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>{c.phoneNumber}<input dir="ltr" type="tel" inputMode="tel" pattern="\+?[0-9]{8,15}" maxLength={16} value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} /></label>
    </div><div className={styles.editActions}><button className={styles.primary} type="submit" disabled={!dirty || saving}>{saving ? c.saving : c.save}</button><button className={styles.secondaryButton} type="button" onClick={cancelEdit}>{c.cancel}</button></div></form></section> : null}
    {saveMessage ? <p className={styles.inlineStatus} role={saveMessage === c.saveError ? "alert" : "status"}>{saveMessage}</p> : null}

    <section className={styles.historySection} aria-labelledby="user-history-title"><header className={styles.historyHeader}><div><h3 id="user-history-title">{c.history}</h3><p aria-live="polite">{sectionNames[locale][section]}{history ? ` · ${history.total.toLocaleString(locale)} ${c.records}` : ""}</p></div><button className={styles.secondaryButton} type="button" onClick={() => setRevision((current) => current + 1)} disabled={loading}>{c.refresh}</button></header>
      <div className={styles.historyLayout}><nav className={styles.historyNav} aria-label={c.category}>{(Object.entries(groups) as [keyof typeof groups, readonly Section[]][]).map(([group, keys]) => <div className={styles.navGroup} key={group}><h4>{groupNames[locale][group]}</h4>{keys.map((key) => <button key={key} type="button" aria-pressed={section === key} onClick={() => selectSection(key)}>{sectionNames[locale][key]}</button>)}</div>)}</nav>
        <div className={styles.mobileCategory}><label htmlFor="user-history-category">{c.category}</label><select id="user-history-category" value={section} onChange={(event) => selectSection(event.target.value as Section)}>{(Object.entries(groups) as [keyof typeof groups, readonly Section[]][]).map(([group, keys]) => <optgroup key={group} label={groupNames[locale][group]}>{keys.map((key) => <option value={key} key={key}>{sectionNames[locale][key]}</option>)}</optgroup>)}</select></div>
        <div className={styles.historyContent} aria-busy={loading}>
          {loading ? <p className={styles.state} role="status">{c.loading}</p> : null}
          {historyError ? <div className={styles.errorState} role="alert"><p>{c.historyError}</p><button className={styles.secondaryButton} type="button" onClick={() => setRevision((current) => current + 1)}>{c.retry}</button></div> : null}
          {!loading && !historyError && history?.items.length === 0 ? <p className={styles.state}>{c.empty}</p> : null}
          {!loading && !historyError && history ? <><div className={styles.records}>{history.items.map((entry) => <HistoryRecord key={`${section}:${entry.id}`} entry={entry} section={section} locale={locale} />)}</div><div className={styles.historyPager}><span className={styles.resultRange} aria-live="polite">{firstRecord.toLocaleString(locale)}–{lastRecord.toLocaleString(locale)} {c.of} {history.total.toLocaleString(locale)} {c.records}</span><label className={styles.pageSize}>{c.perPage}<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={20}>20</option><option value={30}>30</option></select></label>{pageCount > 1 ? <nav className={styles.pagination} aria-label={c.history}><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{c.previous}</button><div className={styles.pageNumbers}>{visiblePages.map((value, index) => <span key={value}>{index > 0 && value - visiblePages[index - 1] > 1 ? <span className={styles.pageGap} aria-hidden="true">…</span> : null}<button type="button" aria-label={`${c.page} ${value}`} aria-current={page === value ? "page" : undefined} onClick={() => setPage(value)}>{value.toLocaleString(locale)}</button></span>)}</div><button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>{c.next}</button></nav> : null}</div></> : null}
        </div>
      </div>
    </section>
  </div>;
}
