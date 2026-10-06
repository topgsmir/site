"use client";

import type { AdminProductsPage, ManagedBlogPost } from "@topgsm/shared-types";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import { AdminCommentsWorkspace } from "@/components/comments/AdminCommentsWorkspace";
import { UploadDeletionQueue } from "./UploadDeletionQueue";
import styles from "./AdminNotificationsWorkspace.module.css";

type BlogPage = { items: ManagedBlogPost[]; nextCursor: string | null };
type Refund = { id: string; created_at: string; order_item: { order: { id: string; total_amount: string; currency: string; seller: { shop_name: string }; payment_attempts: Array<{ id: string }> } } };
type RefundPage = { items: Refund[]; nextCursor: string | null };
type Payout = { id: string; orderId: string; seller: { id: string; shopName: string }; payableAmount: string; currency: string; status: "requested" };
type PayoutPage = { items: Payout[]; nextCursor: string | null };
type DownloadChange = { id: string; action: "edit" | "delete"; link_index: number; expected_url: string; expected_title: string; proposed_url: string | null; proposed_title: string | null; requested_by: { full_name: string }; offer: { listing: { product: { id: string; title: string }; seller: { shop_name: string } }; variant: { name: string | null } } };
export type AdminNotificationCounts = { comments: number; photos: number; products: number; articles: number; refunds: number; payouts: number; downloadLinks: number };
const downloadCopy = {
  en: { title: "Download link changes", edit: "Edit", remove: "Delete", current: "Current", proposed: "Proposed", approve: "Approve", reject: "Reject", error: "Could not load or review download link requests.", done: "Download link request reviewed.", empty: "No pending download link requests." },
  fa: { title: "تغییر لینک‌های دانلود", edit: "ویرایش", remove: "حذف", current: "لینک فعلی", proposed: "لینک پیشنهادی", approve: "تأیید", reject: "رد", error: "بارگذاری یا بررسی درخواست‌های لینک دانلود ممکن نبود.", done: "درخواست لینک دانلود بررسی شد.", empty: "درخواستی برای تغییر لینک دانلود وجود ندارد." },
  ar: { title: "تغييرات روابط التنزيل", edit: "تعديل", remove: "حذف", current: "الرابط الحالي", proposed: "الرابط المقترح", approve: "موافقة", reject: "رفض", error: "تعذر تحميل أو مراجعة طلبات روابط التنزيل.", done: "تمت مراجعة طلب رابط التنزيل.", empty: "لا توجد طلبات معلقة لروابط التنزيل." }
} as const;
type PendingDecision = { kind: "refund"; item: Refund } | { kind: "payout"; item: Payout; status: "approved" | "disputed" };
const decisionCopy = {
  en: { refresh: "Refresh queue", reviewOrder: "Open order details", seller: "Seller", order: "Order", amount: "Amount", scope: "Scope", fullOrder: "Full order payment and cancellation", payout: "Payout request", close: "Cancel", confirm: "Confirm decision" },
  fa: { refresh: "تازه‌سازی فهرست", reviewOrder: "مشاهده جزئیات سفارش", seller: "فروشنده", order: "سفارش", amount: "مبلغ", scope: "دامنه", fullOrder: "کل مبلغ سفارش و لغو سفارش", payout: "درخواست تسویه", close: "انصراف", confirm: "تأیید تصمیم" },
  ar: { refresh: "تحديث القائمة", reviewOrder: "عرض تفاصيل الطلب", seller: "البائع", order: "الطلب", amount: "المبلغ", scope: "النطاق", fullOrder: "كامل دفعة الطلب وإلغاء الطلب", payout: "طلب الصرف", close: "إلغاء", confirm: "تأكيد القرار" }
} as const;
const payoutCopy = {
  en: { title: "Payout requests", approve: "Approve payout", dispute: "Mark disputed", confirmApprove: "Approve this payout request? Check the seller, order, and payable amount.", confirmDispute: "Mark this payout as disputed?", done: "Payout request reviewed.", error: "The payout decision could not be saved." },
  fa: { title: "درخواست‌های تسویه", approve: "تأیید تسویه", dispute: "ثبت اختلاف", confirmApprove: "این درخواست تسویه تأیید شود؟ فروشنده، سفارش و مبلغ قابل پرداخت را بررسی کنید.", confirmDispute: "این تسویه به‌عنوان مورد اختلاف ثبت شود؟", done: "درخواست تسویه بررسی شد.", error: "ثبت تصمیم تسویه ممکن نبود." },
  ar: { title: "طلبات الصرف", approve: "اعتماد الصرف", dispute: "تسجيل نزاع", confirmApprove: "هل تعتمد طلب الصرف؟ تحقق من البائع والطلب والمبلغ المستحق.", confirmDispute: "هل تسجل نزاعاً على طلب الصرف؟", done: "تمت مراجعة طلب الصرف.", error: "تعذر حفظ قرار الصرف." }
} as const;
const copy = {
  en: { title: "Notifications", intro: "Review requests waiting for an admin decision.", chooseQueue: "Review queue", countsError: "Request counts could not be loaded.", products: "Product reviews", articles: "Article reviews", photos: "Photo deletion requests", comments: "Comments", refunds: "Bridge refund requests", issueRefund: "Refund full order", refundConfirm: "Refund the full payment and cancel this order? Review every order item and the order total first.", refundDone: "Refund submitted.", orderTotal: "Order total", empty: "Nothing is waiting here.", error: "Could not load this queue.", retry: "Retry", more: "Load more", open: "Review details", approve: "Approve product", reject: "Return to draft", reason: "Reason for returning to draft", cancel: "Cancel", save: "Submit decision", actionError: "The product could not be reviewed. Refresh and try again.", done: "Product reviewed.", confirm: "Publish this product?" },
  fa: { title: "اعلان‌ها", intro: "درخواست‌های منتظر تصمیم مدیر را از یک جا بررسی کنید.", chooseQueue: "نوع درخواست", countsError: "تعداد درخواست‌ها دریافت نشد.", products: "بررسی محصولات", articles: "بررسی مقاله‌ها", photos: "درخواست حذف تصویر", comments: "دیدگاه‌ها", refunds: "درخواست‌های بازپرداخت بریج", issueRefund: "بازپرداخت کل سفارش", refundConfirm: "کل مبلغ پرداخت بازگردانده و سفارش لغو شود؟ ابتدا همه اقلام و مبلغ کل سفارش را بررسی کنید.", refundDone: "بازپرداخت ثبت شد.", orderTotal: "مبلغ کل سفارش", empty: "درخواستی در انتظار بررسی نیست.", error: "بارگذاری این فهرست ممکن نبود.", retry: "تلاش دوباره", more: "نمایش بیشتر", open: "بررسی جزئیات", approve: "تأیید محصول", reject: "بازگشت به پیش‌نویس", reason: "دلیل بازگشت به پیش‌نویس", cancel: "انصراف", save: "ثبت تصمیم", actionError: "بررسی محصول انجام نشد. فهرست را تازه کنید.", done: "محصول بررسی شد.", confirm: "این محصول منتشر شود؟" },
  ar: { title: "الإشعارات", intro: "راجع الطلبات التي تنتظر قرار المدير من مكان واحد.", chooseQueue: "قائمة المراجعة", countsError: "تعذر تحميل أعداد الطلبات.", products: "مراجعة المنتجات", articles: "مراجعة المقالات", photos: "طلبات حذف الصور", comments: "التعليقات", refunds: "طلبات استرداد بريدج", issueRefund: "استرداد الطلب كاملاً", refundConfirm: "هل تسترد كامل المبلغ وتلغي الطلب؟ راجع جميع عناصر الطلب وإجماليه أولاً.", refundDone: "تم إرسال الاسترداد.", orderTotal: "إجمالي الطلب", empty: "لا توجد طلبات تنتظر المراجعة.", error: "تعذر تحميل هذه القائمة.", retry: "إعادة المحاولة", more: "عرض المزيد", open: "مراجعة التفاصيل", approve: "اعتماد المنتج", reject: "إعادته إلى المسودة", reason: "سبب العودة إلى المسودة", cancel: "إلغاء", save: "تسجيل القرار", actionError: "تعذرت مراجعة المنتج. حدّث القائمة وحاول مجدداً.", done: "تمت مراجعة المنتج.", confirm: "هل تريد نشر هذا المنتج؟" }
} as const;

const queueKeys = ["comments", "photos", "products", "articles", "refunds", "payouts", "downloadLinks"] as const;
type QueueKey = (typeof queueKeys)[number];

function queueFromHash(): QueueKey | null {
  return queueKeys.find((key) => window.location.hash === `#notification-${key}`) ?? null;
}

export function AdminNotificationsWorkspace({ locale, onCountsChange }: { locale: Locale; onCountsChange?: (counts: AdminNotificationCounts) => void }) {
  const c = copy[locale];
  const pc = payoutCopy[locale];
  const dc = decisionCopy[locale];
  const dlc = downloadCopy[locale];
  const [activeQueue, setActiveQueue] = useState<QueueKey>("comments");
  const [visitedQueues, setVisitedQueues] = useState<QueueKey[]>(["comments"]);
  const [refreshKey, setRefreshKey] = useState(0);
  const lastFocusRefresh = useRef(Date.now());
  const [counts, setCounts] = useState<AdminNotificationCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState(false);
  const countsRequest = useRef(0);
  const numberFormatter = new Intl.NumberFormat(locale);
  const countLabel = (key: QueueKey) => counts ? numberFormatter.format(counts[key]) : countsLoading ? "…" : "—";
  const tabs = [
    { id: "comments", label: c.comments },
    { id: "photos", label: c.photos },
    { id: "products", label: c.products },
    { id: "articles", label: c.articles },
    { id: "refunds", label: c.refunds },
    { id: "payouts", label: pc.title },
    { id: "downloadLinks", label: dlc.title }
  ] as const;
  const [products, setProducts] = useState<AdminProductsPage["items"]>([]);
  const productRequest = useRef(0);
  const [productCursor, setProductCursor] = useState<string | null>(null);
  const [articles, setArticles] = useState<ManagedBlogPost[]>([]);
  const articleRequest = useRef(0);
  const [articleCursor, setArticleCursor] = useState<string | null>(null);
  const [productLoading, setProductLoading] = useState(true);
  const [articleLoading, setArticleLoading] = useState(true);
  const [productError, setProductError] = useState("");
  const [productFailedCursor, setProductFailedCursor] = useState<string | null>(null);
  const [articleError, setArticleError] = useState("");
  const [articleFailedCursor, setArticleFailedCursor] = useState<string | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const refundRequest = useRef(0);
  const [refundCursor, setRefundCursor] = useState<string | null>(null);
  const [refundLoading, setRefundLoading] = useState(true);
  const [refundError, setRefundError] = useState("");
  const [refundFailedCursor, setRefundFailedCursor] = useState<string | null>(null);
  const refundKeys = useRef<Record<string, string>>({});
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [downloadChanges, setDownloadChanges] = useState<DownloadChange[]>([]);
  const [downloadError, setDownloadError] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const payoutRequest = useRef(0);
  const [payoutCursor, setPayoutCursor] = useState<string | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [payoutError, setPayoutError] = useState("");
  const [payoutFailedCursor, setPayoutFailedCursor] = useState<string | null>(null);
  const [payoutMessage, setPayoutMessage] = useState("");
  const payoutKeys = useRef<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [refundMessage, setRefundMessage] = useState("");
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const [decisionError, setDecisionError] = useState("");
  const decisionDialogRef = useRef<HTMLDialogElement>(null);

  const loadCounts = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++countsRequest.current;
    setCountsError(false);
    try {
      const { data } = await api.get<AdminNotificationCounts>("/admin/notifications/counts", { signal });
      if (!signal?.aborted && requestId === countsRequest.current) {
        setCounts(data);
        onCountsChange?.(data);
      }
    } catch {
      if (!signal?.aborted && requestId === countsRequest.current) setCountsError(true);
    } finally {
      if (!signal?.aborted && requestId === countsRequest.current) setCountsLoading(false);
    }
  }, [onCountsChange]);

  const loadProducts = useCallback(async (cursor?: string) => {
    const request = ++productRequest.current;
    setProductLoading(true); setProductError(""); setProductFailedCursor(null);
    try {
      const { data } = await api.get<AdminProductsPage>("/products/admin", { params: { status: "pending_review", limit: 20, ...(cursor ? { cursor } : {}) } });
      if (request !== productRequest.current) return;
      setProducts((previous) => cursor ? [...previous, ...data.items] : data.items);
      setProductCursor(data.nextCursor);
    } catch { if (request === productRequest.current) { setProductError(c.error); setProductFailedCursor(cursor ?? null); } }
    finally { if (request === productRequest.current) setProductLoading(false); }
  }, [c.error]);

  const loadArticles = useCallback(async (cursor?: string) => {
    const request = ++articleRequest.current;
    setArticleLoading(true); setArticleError(""); setArticleFailedCursor(null);
    try {
      const { data } = await api.get<BlogPage>("/blog/manage/posts", { params: { status: "pending_review", limit: 20, ...(cursor ? { cursor } : {}) } });
      if (request !== articleRequest.current) return;
      setArticles((previous) => cursor ? [...previous, ...data.items] : data.items);
      setArticleCursor(data.nextCursor);
    } catch { if (request === articleRequest.current) { setArticleError(c.error); setArticleFailedCursor(cursor ?? null); } }
    finally { if (request === articleRequest.current) setArticleLoading(false); }
  }, [c.error]);

  const loadRefunds = useCallback(async (cursor?: string) => {
    const request = ++refundRequest.current;
    setRefundLoading(true); setRefundError(""); setRefundFailedCursor(null);
    try {
      const { data } = await api.get<RefundPage>("/bridge/admin/refund-requests", { params: { limit: 20, ...(cursor ? { cursor } : {}) } });
      if (request !== refundRequest.current) return;
      setRefunds((previous) => cursor ? [...previous, ...data.items] : data.items);
      setRefundCursor(data.nextCursor);
    }
    catch { if (request === refundRequest.current) { setRefundError(c.error); setRefundFailedCursor(cursor ?? null); } }
    finally { if (request === refundRequest.current) setRefundLoading(false); }
  }, [c.error]);

  const loadPayouts = useCallback(async (cursor?: string) => {
    const request = ++payoutRequest.current;
    setPayoutLoading(true); setPayoutError(""); setPayoutFailedCursor(null);
    try {
      const { data } = await api.get<PayoutPage>("/payouts", { params: { status: "requested", limit: 20, ...(cursor ? { cursor } : {}) } });
      if (request !== payoutRequest.current) return;
      setPayouts((previous) => cursor ? [...previous, ...data.items] : data.items);
      setPayoutCursor(data.nextCursor);
    } catch { if (request === payoutRequest.current) { setPayoutError(c.error); setPayoutFailedCursor(cursor ?? null); } }
    finally { if (request === payoutRequest.current) setPayoutLoading(false); }
  }, [c.error]);

  const loadDownloadChanges = useCallback(async () => {
    try {
      const { data } = await api.get<DownloadChange[]>("/products/admin/download-link-requests");
      setDownloadChanges(data); setDownloadError("");
    } catch { setDownloadError(downloadCopy[locale].error); }
  }, [locale]);

  useEffect(() => {
    if (activeQueue === "products") void loadProducts();
    if (activeQueue === "articles") void loadArticles();
    if (activeQueue === "refunds") void loadRefunds();
    if (activeQueue === "payouts") void loadPayouts();
    if (activeQueue === "downloadLinks") void loadDownloadChanges();
  }, [activeQueue, refreshKey, loadArticles, loadProducts, loadRefunds, loadPayouts, loadDownloadChanges]);

  useEffect(() => {
    const controller = new AbortController();
    void loadCounts(controller.signal);
    const onFocus = () => {
      void loadCounts();
      if (Date.now() - lastFocusRefresh.current < 30_000) return;
      lastFocusRefresh.current = Date.now();
      setRefreshKey((value) => value + 1);
    };
    window.addEventListener("focus", onFocus);
    return () => { controller.abort(); window.removeEventListener("focus", onFocus); };
  }, [loadCounts]);

  useEffect(() => {
    function syncHash() {
      const queue = queueFromHash();
      if (!queue) return;
      setActiveQueue(queue);
      setVisitedQueues((previous) => previous.includes(queue) ? previous : [...previous, queue]);
      setRefreshKey((value) => value + 1);
      requestAnimationFrame(() => document.getElementById(`notification-${queue}`)?.scrollIntoView({ block: "start" }));
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  function selectQueue(queue: QueueKey) {
    setActiveQueue(queue);
    setVisitedQueues((previous) => previous.includes(queue) ? previous : [...previous, queue]);
    lastFocusRefresh.current = Date.now();
    setRefreshKey((value) => value + 1);
    window.history.replaceState(window.history.state, "", `#notification-${queue}`);
  }

  function refreshCurrentQueue() {
    lastFocusRefresh.current = Date.now();
    setRefreshKey((value) => value + 1);
    void loadCounts();
  }

  useEffect(() => {
    const dialog = decisionDialogRef.current;
    if (!dialog) return;
    if (pendingDecision && !dialog.open) dialog.showModal();
    if (!pendingDecision && dialog.open) dialog.close();
  }, [pendingDecision]);

  function openDecision(decision: PendingDecision) {
    setDecisionError("");
    setPendingDecision(decision);
  }

  async function reviewProduct(id: string, status: "active" | "draft") {
    if (status === "active" && !window.confirm(c.confirm)) return;
    setBusy(id); setProductError(""); setMessage("");
    try {
      await api.patch(`/products/admin/${id}/review`, { status, ...(status === "draft" ? { reason: reason.trim() } : {}) });
      setRejectId(null); setReason(""); setMessage(c.done); await loadProducts(); void loadCounts();
    } catch { setProductError(c.actionError); }
    finally { setBusy(null); }
  }

  async function reviewDownloadChange(id: string, status: "approved" | "rejected") {
    setBusy(id); setDownloadError(""); setDownloadMessage("");
    try {
      await api.patch(`/products/admin/download-link-requests/${id}`, { status, ...(status === "rejected" ? { reason: reason.trim() } : {}) });
      setRejectId(null); setReason(""); setDownloadMessage(dlc.done); await loadDownloadChanges(); void loadCounts();
    } catch { setDownloadError(dlc.error); }
    finally { setBusy(null); }
  }

  async function issueRefund(item: Refund) {
    const attempt = item.order_item.order.payment_attempts[0];
    if (!attempt) return;
    const idempotencyKey = refundKeys.current[attempt.id] ??= crypto.randomUUID();
    setBusy(item.id); setDecisionError(""); setRefundMessage("");
    try {
      await api.post(`/payments/admin/${attempt.id}/refund`, { reason: "Approved Bridge fulfillment refund request" }, { headers: { "Idempotency-Key": idempotencyKey } });
      delete refundKeys.current[attempt.id]; setRefundMessage(c.refundDone); setPendingDecision(null); void loadRefunds(); void loadCounts();
    } catch { setDecisionError(c.error); }
    finally { setBusy(null); }
  }

  async function reviewPayout(item: Payout, status: "approved" | "disputed") {
    const key = `${item.id}:${status}`;
    const idempotencyKey = payoutKeys.current[key] ??= crypto.randomUUID();
    setBusy(item.id); setDecisionError(""); setPayoutMessage("");
    try {
      await api.patch(`/payouts/requests/${item.id}`, { status }, { headers: { "Idempotency-Key": idempotencyKey } });
      delete payoutKeys.current[key]; setPayoutMessage(pc.done); setPendingDecision(null); void loadPayouts(); void loadCounts();
    } catch { setDecisionError(pc.error); }
    finally { setBusy(null); }
  }

  return <section className={styles.workspace} aria-labelledby="admin-notifications-title">
    <header className={styles.header}><h1 id="admin-notifications-title">{c.title}</h1><p>{c.intro}</p><button className={styles.refresh} type="button" onClick={refreshCurrentQueue}>{dc.refresh}</button></header>
    <div className={styles.layout}>
    <nav className={styles.queueNav} aria-label={c.chooseQueue}>
      <label className={styles.mobilePicker}>{c.chooseQueue}<select value={activeQueue} onChange={(event) => selectQueue(event.target.value as QueueKey)}>{tabs.map((item) => <option key={item.id} value={item.id}>{item.label} · {countLabel(item.id)}</option>)}</select></label>
      <div className={styles.tabs} role="tablist" aria-label={c.chooseQueue} aria-orientation="vertical">
        {tabs.map((item, index) => <button key={item.id} id={`notification-tab-${item.id}`} type="button" role="tab" aria-selected={activeQueue === item.id} aria-controls={`notification-${item.id}`} tabIndex={activeQueue === item.id ? 0 : -1} onClick={() => selectQueue(item.id)} onKeyDown={(event) => {
          const nextIndex = event.key === "ArrowDown" ? (index + 1) % tabs.length : event.key === "ArrowUp" ? (index - 1 + tabs.length) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
          if (nextIndex < 0) return;
          event.preventDefault();
          const next = tabs[nextIndex];
          selectQueue(next.id);
          document.getElementById(`notification-tab-${next.id}`)?.focus();
        }}><span className={styles.tabLabel}>{item.label}</span><span className={styles.countBadge} data-empty={counts?.[item.id] === 0}>{countLabel(item.id)}</span></button>)}
      </div>
      {countsError ? <p className={styles.countsError} role="alert">{c.countsError} <button type="button" onClick={() => void loadCounts()}>{c.retry}</button></p> : null}
    </nav>
    <div className={styles.panels}>
    <div id="notification-comments" className={styles.panel} role="tabpanel" aria-labelledby="notification-tab-comments" hidden={activeQueue !== "comments"}><AdminCommentsWorkspace locale={locale} view="pending" refreshKey={refreshKey} onReviewed={() => void loadCounts()} /></div>
    <div id="notification-photos" className={styles.panel} role="tabpanel" aria-labelledby="notification-tab-photos" hidden={activeQueue !== "photos"}>{visitedQueues.includes("photos") ? <UploadDeletionQueue locale={locale} refreshKey={refreshKey} onReviewed={() => void loadCounts()} /> : null}</div>
    <section id="notification-products" className={`${styles.panel} ${styles.queue}`} role="tabpanel" aria-labelledby="notification-tab-products" hidden={activeQueue !== "products"}>
      <h2 id="notification-products-title">{c.products}</h2>
      {message ? <p role="status" className={styles.message}>{message}</p> : null}
      {productError ? <p role="alert" className={styles.error}>{productError} <button type="button" onClick={() => void loadProducts(productFailedCursor ?? undefined)}>{c.retry}</button></p> : null}
      {productLoading && !products.length ? <p role="status">…</p> : null}
      {!productLoading && !products.length && !productError ? <p className={styles.empty}>{c.empty}</p> : null}
      <div className={styles.rows}>{products.map((item) => <article className={styles.row} key={item.id}>
        <div><strong>{item.title}</strong><small>{item.category ?? item.type} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Tehran" }).format(new Date(item.updatedAt))}</small></div>
        <Link href={`/${locale}/admin/products/${item.id}` as Route}>{c.open}</Link>
        <div className={styles.actions}><button type="button" disabled={busy !== null} onClick={() => void reviewProduct(item.id, "active")}>{c.approve}</button><button type="button" disabled={busy !== null} onClick={() => { setRejectId(item.id); setReason(""); }}>{c.reject}</button></div>
        {rejectId === item.id ? <form className={styles.reason} onSubmit={(event) => { event.preventDefault(); void reviewProduct(item.id, "draft"); }}><label>{c.reason}<textarea autoFocus required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button type="button" onClick={() => setRejectId(null)}>{c.cancel}</button><button type="submit" disabled={busy !== null || reason.trim().length < 3}>{c.save}</button></form> : null}
      </article>)}</div>
      {productCursor ? <button className={styles.more} type="button" disabled={productLoading} onClick={() => void loadProducts(productCursor)}>{c.more}</button> : null}
    </section>
    <section id="notification-downloadLinks" className={`${styles.panel} ${styles.queue}`} role="tabpanel" aria-labelledby="notification-tab-downloadLinks" hidden={activeQueue !== "downloadLinks"}>
      <h2>{dlc.title}</h2>
      {downloadMessage ? <p role="status" className={styles.message}>{downloadMessage}</p> : null}
      {downloadError ? <p role="alert" className={styles.error}>{downloadError} <button type="button" onClick={() => void loadDownloadChanges()}>{c.retry}</button></p> : null}
      {!downloadChanges.length && !downloadError ? <p className={styles.empty}>{dlc.empty}</p> : null}
      <div className={styles.rows}>{downloadChanges.map((item) => <article className={`${styles.row} ${styles.downloadRow}`} key={item.id}>
        <div><strong>{item.offer.listing.product.title} · {item.offer.variant.name || `${item.link_index + 1}`}</strong><small>{item.offer.listing.seller.shop_name} · {item.requested_by.full_name} · {item.action === "edit" ? dlc.edit : dlc.remove}</small></div>
        <Link href={`/${locale}/admin/products/${item.offer.listing.product.id}` as Route}>{c.open}</Link>
        <div className={styles.downloadDetails}><small>{dlc.current}: {item.expected_title}</small><p dir="ltr">{item.expected_url}</p>{item.proposed_url ? <><small>{dlc.proposed}: {item.proposed_title}</small><p dir="ltr">{item.proposed_url}</p></> : null}</div>
        <div className={styles.actions}><button type="button" disabled={busy !== null} onClick={() => void reviewDownloadChange(item.id, "approved")}>{dlc.approve}</button><button type="button" disabled={busy !== null} onClick={() => { setRejectId(`download:${item.id}`); setReason(""); }}>{dlc.reject}</button></div>
        {rejectId === `download:${item.id}` ? <form className={styles.reason} onSubmit={(event) => { event.preventDefault(); void reviewDownloadChange(item.id, "rejected"); }}><label>{c.reason}<textarea autoFocus required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button type="button" onClick={() => setRejectId(null)}>{c.cancel}</button><button type="submit" disabled={busy !== null || reason.trim().length < 3}>{c.save}</button></form> : null}
      </article>)}</div>
    </section>
    <section id="notification-articles" className={`${styles.panel} ${styles.queue}`} role="tabpanel" aria-labelledby="notification-tab-articles" hidden={activeQueue !== "articles"}>
      <h2 id="notification-articles-title">{c.articles}</h2>
      {articleError ? <p role="alert" className={styles.error}>{articleError} <button type="button" onClick={() => void loadArticles(articleFailedCursor ?? undefined)}>{c.retry}</button></p> : null}
      {articleLoading && !articles.length ? <p role="status">…</p> : null}
      {!articleLoading && !articles.length && !articleError ? <p className={styles.empty}>{c.empty}</p> : null}
      <div className={styles.rows}>{articles.map((item) => <article className={styles.row} key={item.id}><div><strong>{item.translations.find((translation) => translation.locale === locale)?.title || item.translations[0]?.title || item.id}</strong><small>{item.seller?.shopName ? `${item.seller.shopName} · ` : ""}{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Tehran" }).format(new Date(item.updatedAt))}</small></div><Link href={`/${locale}/admin/blog/${item.id}` as Route}>{c.open}</Link></article>)}</div>
      {articleCursor ? <button className={styles.more} type="button" disabled={articleLoading} onClick={() => void loadArticles(articleCursor)}>{c.more}</button> : null}
    </section>
    <section id="notification-refunds" className={`${styles.panel} ${styles.queue}`} role="tabpanel" aria-labelledby="notification-tab-refunds" hidden={activeQueue !== "refunds"}>
      <h2 id="notification-refunds-title">{c.refunds}</h2>
      {refundMessage ? <p role="status" className={styles.message}>{refundMessage}</p> : null}
      {refundError ? <p role="alert" className={styles.error}>{refundError} <button type="button" onClick={() => void loadRefunds(refundFailedCursor ?? undefined)}>{c.retry}</button></p> : null}
      {refundLoading && !refunds.length ? <p role="status">…</p> : null}
      {!refundLoading && !refunds.length && !refundError ? <p className={styles.empty}>{c.empty}</p> : null}
      <div className={styles.rows}>{refunds.map((item) => <article className={styles.row} key={item.id}><div><strong>#{item.order_item.order.id}</strong><small>{item.order_item.order.seller.shop_name} · {c.orderTotal}: {formatCurrencyAmount(item.order_item.order.total_amount, item.order_item.order.currency, locale)} {currencyLabel(item.order_item.order.currency)}</small></div><Link href={`/${locale}/admin/orders/${item.order_item.order.id}` as Route}>{c.open}</Link><button type="button" disabled={busy !== null || !item.order_item.order.payment_attempts.length} onClick={() => openDecision({ kind: "refund", item })}>{c.issueRefund}</button></article>)}</div>
      {refundCursor ? <button className={styles.more} type="button" disabled={refundLoading} onClick={() => void loadRefunds(refundCursor)}>{c.more}</button> : null}
    </section>
    <section id="notification-payouts" className={`${styles.panel} ${styles.queue}`} role="tabpanel" aria-labelledby="notification-tab-payouts" hidden={activeQueue !== "payouts"}>
      <h2 id="notification-payouts-title">{pc.title}</h2>
      {payoutMessage ? <p role="status" className={styles.message}>{payoutMessage}</p> : null}
      {payoutError ? <p role="alert" className={styles.error}>{payoutError} <button type="button" onClick={() => void loadPayouts(payoutFailedCursor ?? undefined)}>{c.retry}</button></p> : null}
      {payoutLoading && !payouts.length ? <p role="status">…</p> : null}
      {!payoutLoading && !payouts.length && !payoutError ? <p className={styles.empty}>{c.empty}</p> : null}
      <div className={styles.rows}>{payouts.map((item) => <article className={styles.row} key={item.id}><div><strong>{item.seller.shopName}</strong><small>#{item.orderId} · {formatCurrencyAmount(item.payableAmount, item.currency, locale)} {currencyLabel(item.currency)}</small></div><Link href={`/${locale}/admin/orders/${item.orderId}` as Route}>{c.open}</Link><div className={styles.actions}><button type="button" disabled={busy !== null} onClick={() => openDecision({ kind: "payout", item, status: "approved" })}>{pc.approve}</button><button type="button" disabled={busy !== null} onClick={() => openDecision({ kind: "payout", item, status: "disputed" })}>{pc.dispute}</button></div></article>)}</div>
      {payoutCursor ? <button className={styles.more} type="button" disabled={payoutLoading} onClick={() => void loadPayouts(payoutCursor)}>{c.more}</button> : null}
    </section>
    </div>
    </div>
    <dialog ref={decisionDialogRef} className={styles.decisionDialog} aria-labelledby="notification-decision-title" onCancel={(event) => { if (busy) event.preventDefault(); else setPendingDecision(null); }}>
      {pendingDecision ? <>
        <h2 id="notification-decision-title">{pendingDecision.kind === "refund" ? c.issueRefund : pendingDecision.status === "approved" ? pc.approve : pc.dispute}</h2>
        <p>{pendingDecision.kind === "refund" ? c.refundConfirm : pendingDecision.status === "approved" ? pc.confirmApprove : pc.confirmDispute}</p>
        <dl className={styles.decisionFacts}>
          <div><dt>{dc.seller}</dt><dd>{pendingDecision.kind === "refund" ? pendingDecision.item.order_item.order.seller.shop_name : pendingDecision.item.seller.shopName}</dd></div>
          <div><dt>{dc.order}</dt><dd dir="ltr">#{pendingDecision.kind === "refund" ? pendingDecision.item.order_item.order.id : pendingDecision.item.orderId}</dd></div>
          <div><dt>{dc.amount}</dt><dd>{pendingDecision.kind === "refund" ? formatCurrencyAmount(pendingDecision.item.order_item.order.total_amount, pendingDecision.item.order_item.order.currency, locale) : formatCurrencyAmount(pendingDecision.item.payableAmount, pendingDecision.item.currency, locale)} {currencyLabel(pendingDecision.kind === "refund" ? pendingDecision.item.order_item.order.currency : pendingDecision.item.currency)}</dd></div>
          <div><dt>{dc.scope}</dt><dd>{pendingDecision.kind === "refund" ? dc.fullOrder : dc.payout}</dd></div>
        </dl>
        <Link href={`/${locale}/admin/orders/${pendingDecision.kind === "refund" ? pendingDecision.item.order_item.order.id : pendingDecision.item.orderId}` as Route} target="_blank" rel="noopener noreferrer">{dc.reviewOrder}</Link>
        {decisionError ? <p className={styles.error} role="alert">{decisionError}</p> : null}
        <div className={styles.decisionActions}><button type="button" disabled={busy !== null} onClick={() => setPendingDecision(null)}>{dc.close}</button><button type="button" disabled={busy !== null} onClick={() => pendingDecision.kind === "refund" ? void issueRefund(pendingDecision.item) : void reviewPayout(pendingDecision.item, pendingDecision.status)}>{dc.confirm}</button></div>
      </> : null}
    </dialog>
  </section>;
}
