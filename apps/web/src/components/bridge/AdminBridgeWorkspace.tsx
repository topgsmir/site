"use client";

import type { AdminProductsPage, BridgeConnectionSummary, BridgeFieldDefinition } from "@topgsm/shared-types";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { safeApiError, type SafeApiErrorCopy } from "@/lib/api/error";
import type { Locale } from "@/lib/i18n";
import styles from "./BridgeWorkspace.module.css";

type AdminConnection = BridgeConnectionSummary & { seller: { id: string; shopName: string }; serviceCount: number };
type AdminService = { id: string; name: string; groupName: string | null; kind: string; available: boolean; fields: BridgeFieldDefinition[]; seller: { id: string; shopName: string }; connection: { id: string; name: string; provider: string; status: string }; grant: null | { id: string; status: "active" | "revoked"; linkedProductCount: number } };
type Refund = { id: string; created_at: string; order_item: { order: { id: string; total_amount: string; currency: string; seller: { shop_name: string }; payment_attempts: Array<{ id: string }> } } };

const COPY = {
  en: { brand: "Bridge governance", title: "Approve services, not credentials.", intro: "Inspect masked account health, grant individual synchronized services, and review products before they reach the storefront.", back: "Admin dashboard", filter: "Filter by seller or service", connections: "Connections", services: "Synchronized services", products: "Product review", refunds: "Refund requests", grant: "Grant access", revoke: "Revoke", archive: "Archive linked products", manual: "Keep available as manual", approve: "Approve", draft: "Return to draft", no: "Nothing needs attention here.", fields: "fields", linked: "linked products", reason: "Review reason", confirm: "Confirm revocation", cancel: "Cancel", refund: "Issue verified refund", error: "The request could not be completed." },
  fa: { brand: "مدیریت Bridge", title: "سرویس را تأیید کنید، نه اطلاعات ورود را.", intro: "سلامت حساب را به‌صورت ماسک‌شده ببینید، سرویس‌ها را جداگانه مجاز کنید و پیش از نمایش در فروشگاه محصولات را بررسی کنید.", back: "داشبورد مدیریت", filter: "جست‌وجوی فروشنده یا سرویس", connections: "اتصال‌ها", services: "سرویس‌های همگام‌شده", products: "بررسی محصولات", refunds: "درخواست‌های بازپرداخت", grant: "اعطای دسترسی", revoke: "لغو دسترسی", archive: "بایگانی محصولات متصل", manual: "فعال بماند و دستی شود", approve: "تأیید", draft: "بازگشت به پیش‌نویس", no: "موردی برای رسیدگی وجود ندارد.", fields: "فیلد", linked: "محصول متصل", reason: "دلیل بررسی", confirm: "تأیید لغو", cancel: "انصراف", refund: "انجام بازپرداخت تأییدشده", error: "انجام درخواست ممکن نبود." },
  ar: { brand: "إدارة Bridge", title: "اعتمد الخدمة، لا بيانات الدخول.", intro: "افحص صحة الحساب المقنّعة وامنح كل خدمة على حدة وراجع المنتجات قبل ظهورها في المتجر.", back: "لوحة الإدارة", filter: "ابحث بالبائع أو الخدمة", connections: "الاتصالات", services: "الخدمات المتزامنة", products: "مراجعة المنتجات", refunds: "طلبات الاسترداد", grant: "منح الوصول", revoke: "إلغاء الوصول", archive: "أرشفة المنتجات المرتبطة", manual: "إبقاؤها متاحة يدوياً", approve: "اعتماد", draft: "إعادة إلى المسودة", no: "لا يوجد ما يحتاج للمراجعة.", fields: "حقول", linked: "منتجات مرتبطة", reason: "سبب المراجعة", confirm: "تأكيد الإلغاء", cancel: "إلغاء", refund: "تنفيذ الاسترداد المعتمد", error: "تعذر إكمال الطلب." }
} as const;

const ERROR_COPY: Record<Locale, SafeApiErrorCopy> = {
  en: {
    fallback: "The request could not be completed.",
    network: "The API could not be reached. Make sure the API server is running.",
    auth: "Your session has expired. Sign in again.",
    forbidden: "You do not have permission to perform this action.",
    validation: "The request is invalid. Review the submitted information.",
    unavailable: "The service is temporarily unavailable. Check the API and database configuration.",
    rateLimited: "Too many requests were sent. Wait briefly and try again.",
    conflict: "The item changed before this action completed. Refresh and try again.",
    notFound: "The requested item no longer exists.",
    reference: "Reference"
  },
  fa: {
    fallback: "انجام درخواست ممکن نبود.",
    network: "ارتباط با API برقرار نشد. مطمئن شوید سرور API در حال اجراست.",
    auth: "نشست شما پایان یافته است. دوباره وارد شوید.",
    forbidden: "برای انجام این کار دسترسی لازم را ندارید.",
    validation: "اطلاعات درخواست معتبر نیست. ورودی‌ها را بررسی کنید.",
    unavailable: "سرویس موقتاً در دسترس نیست. تنظیمات API و پایگاه داده را بررسی کنید.",
    rateLimited: "درخواست‌های زیادی ارسال شده است. کمی صبر کنید و دوباره تلاش کنید.",
    conflict: "این مورد هم‌زمان تغییر کرده است. صفحه را تازه‌سازی و دوباره تلاش کنید.",
    notFound: "مورد درخواستی دیگر وجود ندارد.",
    reference: "شناسه پیگیری"
  },
  ar: {
    fallback: "تعذر إكمال الطلب.",
    network: "تعذر الاتصال بواجهة API. تأكد من تشغيل خادم API.",
    auth: "انتهت جلستك. سجل الدخول مرة أخرى.",
    forbidden: "ليست لديك صلاحية لتنفيذ هذا الإجراء.",
    validation: "بيانات الطلب غير صالحة. راجع المعلومات المدخلة.",
    unavailable: "الخدمة غير متاحة مؤقتاً. تحقق من إعدادات API وقاعدة البيانات.",
    rateLimited: "تم إرسال طلبات كثيرة. انتظر قليلاً ثم حاول مجدداً.",
    conflict: "تم تغيير العنصر أثناء تنفيذ الإجراء. حدّث الصفحة وحاول مجدداً.",
    notFound: "العنصر المطلوب لم يعد موجوداً.",
    reference: "رقم التتبع"
  }
};

export function AdminBridgeWorkspace({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const [connections, setConnections] = useState<AdminConnection[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [products, setProducts] = useState<AdminProductsPage["items"]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [query, setQuery] = useState("");
  const [revoke, setRevoke] = useState<AdminService | null>(null);
  const [action, setAction] = useState<"archive" | "manual">("archive");
  const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  const load = useCallback(async () => { try { const [a,b,p,r] = await Promise.all([api.get<AdminConnection[]>("/bridge/admin/connections"), api.get<AdminService[]>("/bridge/admin/services"), api.get<AdminProductsPage>("/products/admin?limit=50"), api.get<Refund[]>("/bridge/admin/refund-requests")]); setConnections(a.data); setServices(b.data); setProducts(p.data.items.filter((item) => item.status === "pending_review")); setRefunds(r.data); setError(""); } catch (requestError) { setError(safeApiError(requestError, ERROR_COPY[locale])); } }, [locale]);
  useEffect(() => {
    const loadFrame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(loadFrame);
  }, [load]);
  const visible = useMemo(() => { const n=query.trim().toLowerCase(); return n ? services.filter((s) => `${s.name} ${s.seller.shopName} ${s.connection.name}`.toLowerCase().includes(n)) : services; }, [query, services]);
  async function serviceAction(service: AdminService) { setBusy(service.id); setError(""); try { if (!service.grant || service.grant.status === "revoked") await api.post("/bridge/admin/grants", { serviceId: service.id }); else setRevoke(service); if (!service.grant || service.grant.status === "revoked") await load(); } catch (requestError) { setError(safeApiError(requestError, ERROR_COPY[locale])); } finally { setBusy(""); } }
  async function confirmRevoke() { if (!revoke?.grant) return; setBusy(revoke.id); try { await api.post(`/bridge/admin/grants/${revoke.grant.id}/revoke`, { productAction: action }); setRevoke(null); await load(); } catch (requestError) { setError(safeApiError(requestError, ERROR_COPY[locale])); } finally { setBusy(""); } }
  async function review(id: string, status: "active" | "draft") { setBusy(id); try { await api.patch(`/products/admin/${id}/review`, { status, reason: status === "draft" ? c.reason : undefined }); await load(); } catch (requestError) { setError(safeApiError(requestError, ERROR_COPY[locale])); } finally { setBusy(""); } }
  async function refund(item: Refund) { const attempt=item.order_item.order.payment_attempts[0]; if (!attempt) return; setBusy(item.id); try { await api.post(`/payments/admin/${attempt.id}/refund`, { reason: "Approved Bridge fulfillment refund request" }); await load(); } catch (requestError) { setError(safeApiError(requestError, ERROR_COPY[locale])); } finally { setBusy(""); } }

  return <div className={styles.shell}><header className={styles.header}><div><p className={styles.brand}>{c.brand}</p><h1>{c.title}</h1></div><div><p>{c.intro}</p><Link className={styles.link} href={`/${locale}/admin`}>{c.back}</Link></div></header><main className={styles.main}>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <section className={styles.section}><div className={styles.sectionHead}><h2>{c.connections}</h2></div><div className={styles.grid}>{connections.map((item) => <article className={styles.card} key={item.id}><div className={styles.cardHead}><h3>{item.seller.shopName}</h3><span className={styles.status} data-tone={item.status === "active" ? "good" : "warn"}>{item.status}</span></div><p>{item.name} · {item.provider}</p><p className={styles.muted}>{item.baseUrl} · {item.serviceCount} {c.services}</p></article>)}</div></section>
    <section className={styles.section}><div className={styles.sectionHead}><div><h2>{c.services}</h2></div><input className={styles.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.filter}/></div><div className={styles.grid}>{visible.map((item) => <article className={styles.card} key={item.id}><div className={styles.cardHead}><div><h3>{item.name}</h3><p className={styles.muted}>{item.seller.shopName} · {item.connection.provider}</p></div><span className={styles.status} data-tone={item.grant?.status === "active" ? "good" : "warn"}>{item.grant?.status ?? "ungranted"}</span></div><p>{item.fields.length} {c.fields} · {item.grant?.linkedProductCount ?? 0} {c.linked}</p><button className={item.grant?.status === "active" ? styles.buttonQuiet : styles.button} disabled={busy === item.id || !item.available || item.connection.status !== "active"} onClick={() => void serviceAction(item)}>{item.grant?.status === "active" ? c.revoke : c.grant}</button></article>)}</div></section>
    <section className={styles.section}><div className={styles.sectionHead}><h2>{c.products}</h2></div>{products.length ? <div className={styles.grid}>{products.map((item) => <article className={styles.card} key={item.id}><div className={styles.cardHead}><h3>{item.title}</h3><span className={styles.status} data-tone="warn">{item.status}</span></div><p className={styles.muted}>{item.category ?? item.type}</p><div className={styles.actions}><button className={styles.button} disabled={busy===item.id} onClick={() => void review(item.id,"active")}>{c.approve}</button><button className={styles.buttonQuiet} disabled={busy===item.id} onClick={() => void review(item.id,"draft")}>{c.draft}</button></div></article>)}</div> : <p className={styles.empty}>{c.no}</p>}</section>
    <section className={styles.section}><div className={styles.sectionHead}><h2>{c.refunds}</h2></div>{refunds.length ? <div className={styles.grid}>{refunds.map((item) => <article className={styles.card} key={item.id}><h3>#{item.order_item.order.id}</h3><p>{item.order_item.order.seller.shop_name}</p><p>{item.order_item.order.total_amount} {item.order_item.order.currency}</p><button className={styles.button} disabled={busy===item.id || !item.order_item.order.payment_attempts.length} onClick={() => void refund(item)}>{c.refund}</button></article>)}</div> : <p className={styles.empty}>{c.no}</p>}</section>
    {revoke ? <dialog open className={styles.dialog} aria-labelledby="revoke-title"><h2 id="revoke-title">{c.revoke}: {revoke.name}</h2><div className={styles.form}><label className={styles.field}><span>{c.archive}</span><input type="radio" name="revoke-action" checked={action==="archive"} onChange={() => setAction("archive")}/></label><label className={styles.field}><span>{c.manual}</span><input type="radio" name="revoke-action" checked={action==="manual"} onChange={() => setAction("manual")}/></label><div className={styles.actions}><button className={styles.button} onClick={() => void confirmRevoke()}>{c.confirm}</button><button className={styles.buttonQuiet} onClick={() => setRevoke(null)}>{c.cancel}</button></div></div></dialog> : null}
  </main></div>;
}
