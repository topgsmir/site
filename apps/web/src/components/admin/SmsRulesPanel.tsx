"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminSmsDeliveryPage, AdminSmsRule, SmsEventKey, SmsProductType, SmsRecipientKind } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./SmsRulesPanel.module.css";

const events: SmsEventKey[] = ["login_otp", "guest_comment_verification", "pending_product", "product_sold", "physical_order_shipped", "search_empty", "bridge_success", "bridge_failure"];
const productTypes: SmsProductType[] = ["any", "digital", "physical", "service", "bridge"];
const recipientKinds: SmsRecipientKind[] = ["requester", "buyer", "seller", "phone", "role", "all"];
const roles = ["platform_admin", "platform_staff", "seller_admin", "seller_staff", "buyer"];
const roleNames: Record<Locale, Record<string, string>> = {
  en: { platform_admin: "Platform admin", platform_staff: "Platform staff", seller_admin: "Seller admin", seller_staff: "Seller staff", buyer: "Buyer" },
  fa: { platform_admin: "مدیر پلتفرم", platform_staff: "کارمند پلتفرم", seller_admin: "مدیر فروشنده", seller_staff: "کارمند فروشنده", buyer: "خریدار" },
  ar: { platform_admin: "مدير المنصة", platform_staff: "موظف المنصة", seller_admin: "مدير البائع", seller_staff: "موظف البائع", buyer: "المشتري" }
};

const labels = {
  en: {
    events: { login_otp: "Login code", guest_comment_verification: "Guest comment code", pending_product: "Pending product", product_sold: "Product sold", physical_order_shipped: "Physical order shipped", search_empty: "Search without results", bridge_success: "Bridge fulfilled", bridge_failure: "Bridge failed" },
    kinds: { requester: "Requester", buyer: "Buyer", seller: "Seller", phone: "Specific number", role: "User role", all: "All users" },
    types: { any: "All types", digital: "Digital", physical: "Physical", service: "Service", bridge: "Bridge" },
    results: { pending: "Queued", sending: "Sending", sent: "Sent", failed: "Failed", test: "Test mode" },
    title: "SMS scenarios", intro: "Set the recipient and message for each event.", notes: "Delivery timing", timing: "Pending product alerts run periodically. Empty-search alerts are limited to one every 10 minutes.", add: "Add recipient rule", event: "Event", type: "Product type", recipient: "Recipient", phone: "Mobile number", role: "User role", status: "Sending", on: "On", off: "Off", content: "Message", template: "SMS.ir template ID", text: "Message text", default: "Provider default template", save: "Save rule", saving: "Saving…", edit: "Edit", remove: "Delete", cancel: "Cancel", error: "Could not save the rule. Check the fields and provider configuration.", loadError: "SMS rules could not be loaded.", empty: "No rules for this event.", allEvents: "All events", codeHint: "Security codes can only be sent to the requester with an SMS.ir template.", textHint: "Use {orderId}, {productType}, {query}, or {pendingCount} where relevant. A sender line is required for plain text.", confirm: "Delete this SMS recipient rule?", deliveries: "Delivery log", refresh: "Refresh", date: "Time", result: "Result", attempts: "Attempts", failure: "Error", more: "Show more", logEmpty: "No delivery records yet.", loading: "Loading…"
  },
  fa: {
    events: { login_otp: "کد ورود", guest_comment_verification: "کد تأیید دیدگاه مهمان", pending_product: "محصول در انتظار", product_sold: "فروش محصول", physical_order_shipped: "ارسال محصول فیزیکی", search_empty: "جست‌وجوی بی‌نتیجه", bridge_success: "تکمیل خرید واسطه‌ای", bridge_failure: "خطای خرید واسطه‌ای" },
    kinds: { requester: "درخواست‌کننده", buyer: "خریدار", seller: "فروشنده", phone: "شماره مشخص", role: "نقش کاربری", all: "همه کاربران" },
    types: { any: "همه نوع‌ها", digital: "دانلودی", physical: "فیزیکی", service: "خدمات", bridge: "واسطه‌ای" },
    results: { pending: "در صف", sending: "در حال ارسال", sent: "ارسال‌شده", failed: "ناموفق", test: "حالت آزمایشی" },
    title: "سناریوهای پیامک", intro: "گیرنده و محتوای پیام هر رویداد را تعیین کنید.", notes: "زمان‌بندی ارسال", timing: "هشدار محصولات در انتظار دوره‌ای است. هشدار جست‌وجوی بی‌نتیجه حداکثر هر ۱۰ دقیقه یک‌بار ارسال می‌شود.", add: "افزودن قانون گیرنده", event: "رویداد", type: "نوع محصول", recipient: "گیرنده", phone: "شماره موبایل", role: "نقش کاربری", status: "ارسال", on: "روشن", off: "خاموش", content: "محتوای پیام", template: "شناسه قالب SMS.ir", text: "متن پیام", default: "قالب پیش‌فرض سرویس", save: "ذخیره قانون", saving: "در حال ذخیره…", edit: "ویرایش", remove: "حذف", cancel: "انصراف", error: "قانون ذخیره نشد. فیلدها و تنظیمات سرویس را بررسی کنید.", loadError: "قوانین پیامک دریافت نشدند.", empty: "برای این رویداد قانونی وجود ندارد.", allEvents: "همه رویدادها", codeHint: "کدهای امنیتی فقط با قالب SMS.ir برای شماره درخواست‌کننده ارسال می‌شوند.", textHint: "در صورت نیاز از {orderId}، {productType}، {query} یا {pendingCount} استفاده کنید. متن آزاد به خط ارسال نیاز دارد.", confirm: "این قانون گیرنده پیامک حذف شود؟", deliveries: "گزارش ارسال", refresh: "بازخوانی", date: "زمان", result: "نتیجه", attempts: "تلاش", failure: "خطا", more: "نمایش بیشتر", logEmpty: "هنوز گزارشی ثبت نشده است.", loading: "در حال بارگذاری…"
  },
  ar: {
    events: { login_otp: "رمز الدخول", guest_comment_verification: "رمز تعليق الضيف", pending_product: "منتج معلّق", product_sold: "بيع المنتج", physical_order_shipped: "شحن المنتج المادي", search_empty: "بحث بلا نتائج", bridge_success: "اكتمال شراء الوساطة", bridge_failure: "فشل شراء الوساطة" },
    kinds: { requester: "صاحب الطلب", buyer: "المشتري", seller: "البائع", phone: "رقم محدد", role: "دور المستخدم", all: "جميع المستخدمين" },
    types: { any: "كل الأنواع", digital: "رقمي", physical: "مادي", service: "خدمة", bridge: "وساطة" },
    results: { pending: "في الانتظار", sending: "جار الإرسال", sent: "أُرسلت", failed: "فشلت", test: "وضع الاختبار" },
    title: "سيناريوهات الرسائل", intro: "حدد المستلم ومحتوى الرسالة لكل حدث.", notes: "توقيت الإرسال", timing: "تُرسل تنبيهات المنتجات المعلقة دورياً. يقتصر تنبيه البحث بلا نتائج على مرة كل ١٠ دقائق.", add: "إضافة قاعدة مستلم", event: "الحدث", type: "نوع المنتج", recipient: "المستلم", phone: "رقم الهاتف", role: "دور المستخدم", status: "الإرسال", on: "مفعّل", off: "معطّل", content: "محتوى الرسالة", template: "معرّف قالب SMS.ir", text: "نص الرسالة", default: "القالب الافتراضي", save: "حفظ القاعدة", saving: "جار الحفظ…", edit: "تعديل", remove: "حذف", cancel: "إلغاء", error: "تعذر حفظ القاعدة. تحقق من الحقول وإعدادات المزود.", loadError: "تعذر تحميل قواعد الرسائل.", empty: "لا توجد قواعد لهذا الحدث.", allEvents: "كل الأحداث", codeHint: "تُرسل رموز الأمان إلى صاحب الطلب فقط عبر قالب SMS.ir.", textHint: "يمكن استخدام {orderId} أو {productType} أو {query} أو {pendingCount}. يحتاج النص إلى خط إرسال.", confirm: "حذف قاعدة مستلم الرسالة؟", deliveries: "سجل الإرسال", refresh: "تحديث", date: "الوقت", result: "النتيجة", attempts: "محاولات", failure: "خطأ", more: "عرض المزيد", logEmpty: "لا توجد سجلات إرسال بعد.", loading: "جار التحميل…"
  }
} as const;

type Draft = Omit<AdminSmsRule, "id" | "updatedAt">;
const fresh: Draft = { eventKey: "product_sold", productType: "any", recipientKind: "seller", recipientRole: null, phoneNumber: null, enabled: false, templateId: null, messageText: null };
const codeEvent = (value: SmsEventKey) => value === "login_otp" || value === "guest_comment_verification";
const productEvent = (value: SmsEventKey) => ["product_sold", "physical_order_shipped", "bridge_success", "bridge_failure"].includes(value);

export function SmsRulesPanel({ locale }: { locale: Locale }) {
  const c = labels[locale];
  const [rules, setRules] = useState<AdminSmsRule[]>([]);
  const [log, setLog] = useState<AdminSmsDeliveryPage>({ items: [], nextCursor: null });
  const [filter, setFilter] = useState<SmsEventKey | "all">("all");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(fresh);
  const [mode, setMode] = useState<"default" | "template" | "text">("default");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [rulesResponse, logResponse] = await Promise.all([
        api.get<AdminSmsRule[]>("/admin/settings/sms/rules"),
        api.get<AdminSmsDeliveryPage>("/admin/settings/sms/deliveries")
      ]);
      setRules(rulesResponse.data); setLog(logResponse.data);
    } catch { setError(c.loadError); }
    finally { setLoading(false); }
  }, [c.loadError]);

  useEffect(() => { const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [reload]);

  function open(rule?: AdminSmsRule) {
    setEditing(rule?.id ?? "new");
    setDraft(rule ? { eventKey: rule.eventKey, productType: rule.productType, recipientKind: rule.recipientKind, recipientRole: rule.recipientRole, phoneNumber: rule.phoneNumber, enabled: rule.enabled, templateId: rule.templateId, messageText: rule.messageText } : { ...fresh, eventKey: filter === "all" ? fresh.eventKey : filter });
    setMode(rule?.messageText ? "text" : rule?.templateId ? "template" : "default");
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const body = {
      ...draft,
      recipientRole: draft.recipientKind === "role" ? draft.recipientRole : null,
      phoneNumber: draft.recipientKind === "phone" ? draft.phoneNumber : null,
      templateId: mode === "template" ? draft.templateId : null,
      messageText: mode === "text" ? draft.messageText : null
    };
    try {
      if (editing === "new") await api.post("/admin/settings/sms/rules", body);
      else await api.patch(`/admin/settings/sms/rules/${editing}`, body);
      setEditing(null); await reload();
    } catch { setError(c.error); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!window.confirm(c.confirm)) return;
    try { await api.delete(`/admin/settings/sms/rules/${id}`); await reload(); }
    catch { setError(c.error); }
  }

  async function more() {
    if (!log.nextCursor) return;
    try {
      const response = await api.get<AdminSmsDeliveryPage>("/admin/settings/sms/deliveries", { params: { cursor: log.nextCursor } });
      setLog((current) => ({ items: [...current.items, ...response.data.items], nextCursor: response.data.nextCursor }));
    } catch { setError(c.loadError); }
  }

  const filtered = rules.filter((rule) => filter === "all" || rule.eventKey === filter);
  const recipientLabel = (rule: AdminSmsRule) => `${c.kinds[rule.recipientKind]}${rule.recipientRole ? ` · ${roleNames[locale][rule.recipientRole] ?? rule.recipientRole.replaceAll("_", " ")}` : rule.phoneNumber ? ` · ${rule.phoneNumber}` : ""}`;
  const contentLabel = (rule: AdminSmsRule) => rule.templateId ? `${c.template} ${rule.templateId}` : rule.messageText ? c.text : c.default;
  const resultLabel = (item: AdminSmsDeliveryPage["items"][number]) => item.testMode ? c.results.test : c.results[item.status as keyof typeof c.results] ?? item.status;
  const actionLabel = (action: string, rule: AdminSmsRule) => `${action}: ${c.events[rule.eventKey]}${locale === "en" ? ", " : "، "}${recipientLabel(rule)}`;
  return <div className={styles.panel} dir={locale === "en" ? "ltr" : "rtl"}>
    <section aria-labelledby="sms-scenarios-title">
      <header className={styles.heading}><div><h2 id="sms-scenarios-title">{c.title}</h2><p>{c.intro}</p></div></header>
      <div className={styles.toolbar}>
        <label className={styles.filter}>{c.event}<select value={filter} onChange={(event) => setFilter(event.target.value as SmsEventKey | "all")}><option value="all">{c.allEvents}</option>{events.map((key) => <option value={key} key={key}>{c.events[key]}</option>)}</select></label>
        <button type="button" onClick={() => open()}>{c.add}</button>
      </div>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {editing ? <form className={styles.editor} onSubmit={(event) => void save(event)}>
        <div className={styles.fields}>
          <label>{c.event}<select value={draft.eventKey} disabled={saving} onChange={(event) => { const eventKey = event.target.value as SmsEventKey; setDraft((current) => ({ ...current, eventKey, productType: "any", recipientKind: codeEvent(eventKey) ? "requester" : "role", recipientRole: codeEvent(eventKey) ? null : "platform_admin", messageText: null })); setMode("default"); }}>{events.map((key) => <option value={key} key={key}>{c.events[key]}</option>)}</select></label>
          {productEvent(draft.eventKey) ? <label>{c.type}<select value={draft.productType} disabled={saving} onChange={(event) => setDraft((current) => ({ ...current, productType: event.target.value as SmsProductType }))}>{productTypes.filter((value) => draft.eventKey !== "physical_order_shipped" || value === "any" || value === "physical").map((value) => <option value={value} key={value}>{c.types[value]}</option>)}</select></label> : null}
          <label>{c.recipient}<select value={draft.recipientKind} disabled={saving || codeEvent(draft.eventKey)} onChange={(event) => setDraft((current) => ({ ...current, recipientKind: event.target.value as SmsRecipientKind, recipientRole: event.target.value === "role" ? current.recipientRole ?? "platform_admin" : null }))}>{recipientKinds.filter((value) => codeEvent(draft.eventKey) ? value === "requester" : value !== "requester").map((value) => <option value={value} key={value}>{c.kinds[value]}</option>)}</select></label>
          {draft.recipientKind === "phone" ? <label>{c.phone}<input required type="tel" value={draft.phoneNumber ?? ""} disabled={saving} onChange={(event) => setDraft((current) => ({ ...current, phoneNumber: event.target.value }))} /></label> : null}
          {draft.recipientKind === "role" ? <label>{c.role}<select value={draft.recipientRole ?? "platform_admin"} disabled={saving} onChange={(event) => setDraft((current) => ({ ...current, recipientRole: event.target.value }))}>{roles.map((role) => <option value={role} key={role}>{roleNames[locale][role]}</option>)}</select></label> : null}
          <label className={styles.checkbox}><input type="checkbox" checked={draft.enabled} disabled={saving} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />{c.status}: {draft.enabled ? c.on : c.off}</label>
          <label>{c.content}<select value={mode} disabled={saving} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="default">{c.default}</option><option value="template">{c.template}</option>{!codeEvent(draft.eventKey) ? <option value="text">{c.text}</option> : null}</select></label>
          {mode === "template" ? <label>{c.template}<input required type="number" min={1} max={2_147_483_647} value={draft.templateId ?? ""} disabled={saving} onChange={(event) => setDraft((current) => ({ ...current, templateId: event.target.value ? Number(event.target.value) : null }))} /></label> : null}
          {mode === "text" ? <label className={styles.full}>{c.text}<textarea required maxLength={1000} value={draft.messageText ?? ""} disabled={saving} onChange={(event) => setDraft((current) => ({ ...current, messageText: event.target.value }))} /></label> : null}
        </div>
        <p className={styles.hint}>{codeEvent(draft.eventKey) ? c.codeHint : c.textHint}</p>
        <div className={styles.editorActions}><button type="button" onClick={() => setEditing(null)}>{c.cancel}</button><button type="submit" disabled={saving}>{saving ? c.saving : c.save}</button></div>
      </form> : null}
      {loading ? <p className={styles.muted}>{c.loading}</p> : filtered.length ? <>
        <div className={`${styles.tableWrap} ${styles.desktopTable}`}><table><thead><tr><th>{c.event}</th><th>{c.type}</th><th>{c.recipient}</th><th>{c.content}</th><th>{c.status}</th><th><span className={styles.visuallyHidden}>{c.edit}</span></th></tr></thead><tbody>{filtered.map((rule) => <tr key={rule.id}><td>{c.events[rule.eventKey]}</td><td>{c.types[rule.productType]}</td><td>{recipientLabel(rule)}</td><td>{contentLabel(rule)}</td><td><span data-enabled={rule.enabled}>{rule.enabled ? c.on : c.off}</span></td><td className={styles.rowActions}><button type="button" aria-label={actionLabel(c.edit, rule)} onClick={() => open(rule)}>{c.edit}</button><button type="button" aria-label={actionLabel(c.remove, rule)} onClick={() => void remove(rule.id)}>{c.remove}</button></td></tr>)}</tbody></table></div>
        <ul className={styles.mobileList}>{filtered.map((rule) => <li key={rule.id}>
          <div className={styles.mobileRowTitle}><strong>{c.events[rule.eventKey]}</strong><span data-enabled={rule.enabled}>{rule.enabled ? c.on : c.off}</span></div>
          <dl><div><dt>{c.recipient}</dt><dd>{recipientLabel(rule)}</dd></div><div><dt>{c.content}</dt><dd>{contentLabel(rule)}</dd></div>{productEvent(rule.eventKey) ? <div><dt>{c.type}</dt><dd>{c.types[rule.productType]}</dd></div> : null}</dl>
          <div className={styles.mobileActions}><button type="button" aria-label={actionLabel(c.edit, rule)} onClick={() => open(rule)}>{c.edit}</button><button type="button" aria-label={actionLabel(c.remove, rule)} onClick={() => void remove(rule.id)}>{c.remove}</button></div>
        </li>)}</ul>
      </> : <p className={styles.muted}>{c.empty}</p>}
      <details className={styles.notes}><summary>{c.notes}</summary><p>{c.timing}</p></details>
    </section>
    <section className={styles.deliveries} aria-labelledby="sms-deliveries-title"><header className={styles.heading}><h2 id="sms-deliveries-title">{c.deliveries}</h2><button type="button" onClick={() => void reload()}>{c.refresh}</button></header>
      {log.items.length ? <>
        <div className={`${styles.tableWrap} ${styles.desktopTable}`}><table><thead><tr><th>{c.date}</th><th>{c.event}</th><th>{c.recipient}</th><th>{c.result}</th><th>{c.attempts}</th><th>{c.failure}</th></tr></thead><tbody>{log.items.map((item) => <tr key={item.id}><td><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(locale)}</time></td><td>{item.eventKey ? c.events[item.eventKey] : "—"}</td><td dir="ltr">{item.recipient}</td><td>{resultLabel(item)}</td><td>{item.attempts}</td><td>{item.error ?? "—"}</td></tr>)}</tbody></table></div>
        <ul className={styles.mobileList}>{log.items.map((item) => <li key={item.id}>
          <div className={styles.mobileRowTitle}><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(locale)}</time><strong>{resultLabel(item)}</strong></div>
          <dl><div><dt>{c.event}</dt><dd>{item.eventKey ? c.events[item.eventKey] : "—"}</dd></div><div><dt>{c.recipient}</dt><dd dir="ltr">{item.recipient}</dd></div><div><dt>{c.attempts}</dt><dd>{item.attempts}</dd></div>{item.error ? <div><dt>{c.failure}</dt><dd>{item.error}</dd></div> : null}</dl>
        </li>)}</ul>
      </> : <p className={styles.muted}>{c.logEmpty}</p>}
      {log.nextCursor ? <button className={styles.more} type="button" onClick={() => void more()}>{c.more}</button> : null}
    </section>
  </div>;
}
