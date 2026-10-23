"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "@/lib/api/client";
import { openDigitalDownload } from "@/lib/digital-download";
import type { Locale } from "@/lib/i18n";
import { RelativeOrderTime } from "@/components/orders/RelativeOrderTime";
import { remainingDownloads } from "@/components/bridge/OrderDetails.types";
import { AccountIcon } from "./AccountIcon";
import styles from "./AccountDownloads.module.css";

type DownloadItem = {
  id: string;
  orderId: string;
  orderItemId: string;
  orderStatus: string;
  productId: string;
  productTitle: string;
  shopName: string;
  createdAt: string;
  lastAccessedAt: string | null;
  remainingDays: number | null;
  file: {
    downloadUrl: string;
    destinationHost: string;
    title: string | null;
    maxDownloads: number;
    downloadCount: number;
  };
};

type DownloadPage = { items: DownloadItem[]; nextCursor: string | null };

const COPY = {
  fa: {
    title: "دانلودهای من",
    search: "جست‌وجو در فایل‌ها",
    searchHint: "نام محصول، فروشگاه یا شماره سفارش",
    empty: "هنوز فایلی برای دانلود ندارید",
    emptyHint: "پس از خرید محصولات دیجیتال، فایل‌ها اینجا جمع می‌شوند.",
    browse: "دیدن محصولات دیجیتال",
    loading: "در حال دریافت فایل‌ها…",
    error: "دریافت فایل‌ها ممکن نبود.",
    retry: "تلاش دوباره",
    more: "نمایش بیشتر",
    download: "دانلود",
    downloading: "در حال دانلود…",
    downloadError: "دانلود انجام نشد. دوباره تلاش کنید.",
    order: "سفارش",
    remaining: "باقی‌مانده",
    unlimited: "نامحدود",
    exhausted: "سهمیه تمام شده",
    locked: "فعلاً در دسترس نیست",
    downloadCount: "دانلود شده",
    noMatch: "فایلی پیدا نشد",
    noMatchHint: "عبارت دیگری جست‌وجو کنید یا فیلتر را پاک کنید.",
    clear: "پاک کردن جست‌وجو",
    loadedHint: "جست‌وجو روی فایل‌های دریافت‌شده اعمال می‌شود.",
  },
  en: {
    title: "My downloads",
    search: "Search files",
    searchHint: "Product, shop, or order number",
    empty: "No downloads yet",
    emptyHint: "Purchased digital files will appear here after checkout.",
    browse: "Browse digital products",
    loading: "Loading downloads…",
    error: "Downloads could not be loaded.",
    retry: "Try again",
    more: "Load more",
    download: "Download",
    downloading: "Downloading…",
    downloadError: "Download failed. Please try again.",
    order: "Order",
    remaining: "Remaining",
    unlimited: "Unlimited",
    exhausted: "Limit reached",
    locked: "Unavailable right now",
    downloadCount: "Downloaded",
    noMatch: "No matching files",
    noMatchHint: "Try another search or clear it.",
    clear: "Clear search",
    loadedHint: "Search applies to the files loaded below.",
  },
  ar: {
    title: "تنزيلاتي",
    search: "البحث في الملفات",
    searchHint: "المنتج أو المتجر أو رقم الطلب",
    empty: "لا توجد تنزيلات بعد",
    emptyHint: "ستظهر الملفات الرقمية المشتراة هنا بعد إتمام الدفع.",
    browse: "تصفح المنتجات الرقمية",
    loading: "جارٍ تحميل التنزيلات…",
    error: "تعذر تحميل التنزيلات.",
    retry: "حاول مجددًا",
    more: "تحميل المزيد",
    download: "تنزيل",
    downloading: "جارٍ التنزيل…",
    downloadError: "تعذر التنزيل. حاول مجددًا.",
    order: "الطلب",
    remaining: "المتبقي",
    unlimited: "غير محدود",
    exhausted: "انتهى الحد",
    locked: "غير متاح حاليًا",
    downloadCount: "تم التنزيل",
    noMatch: "لا توجد ملفات مطابقة",
    noMatchHint: "جرّب بحثًا آخر أو امسح البحث.",
    clear: "مسح البحث",
    loadedHint: "يُطبّق البحث على الملفات المحمّلة أدناه.",
  },
} as const;

function canClaim(item: DownloadItem) {
  return item.remainingDays !== 0 && ["paid", "processing", "awaiting_confirmation", "delivered"].includes(item.orderStatus)
    && (item.file.maxDownloads <= 0 || item.file.downloadCount < item.file.maxDownloads);
}

export function AccountDownloads({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const request = useRef<AbortController | null>(null);
  const failedCursor = useRef<string | undefined>(undefined);

  const load = useCallback(async (next?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (next) setLoadingMore(true); else setLoading(true);
    setError("");
    failedCursor.current = next;
    try {
      const response = await api.get<DownloadPage>("/orders/downloads", {
        signal: controller.signal,
        params: { limit: 20, ...(next ? { cursor: next } : {}) },
      });
      if (controller.signal.aborted) return;
      setItems((current) => next
        ? [...current, ...response.data.items.filter((item) => !current.some((existing) => existing.id === item.id))]
        : response.data.items);
      setCursor(response.data.nextCursor);
    } catch {
      if (!controller.signal.aborted) setError(c.error);
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setLoadingMore(false); }
    }
  }, [c.error]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => { cancelAnimationFrame(frame); request.current?.abort(); };
  }, [load]);

  async function download(item: DownloadItem) {
    if (busyId || !canClaim(item)) return;
    setBusyId(item.id);
    setActionError("");
    try {
      await openDigitalDownload(item.file.downloadUrl);
      setItems((current) => current.map((row) => row.id === item.id
        ? { ...row, file: { ...row.file, downloadCount: row.file.downloadCount + 1 }, lastAccessedAt: new Date().toISOString() }
        : row));
    } catch {
      setActionError(c.downloadError);
    } finally {
      setBusyId(null);
    }
  }

  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const visible = items.filter((item) => {
    if (!normalizedQuery) return true;
    return `${item.productTitle} ${item.shopName} ${item.orderId} ${item.file.title ?? ""} ${item.file.destinationHost}`
      .toLocaleLowerCase(locale)
      .includes(normalizedQuery);
  });

  return <section className={styles.panel} aria-labelledby="account-downloads" aria-busy={loading || loadingMore}>
    <header className={styles.heading}>
      <div><span className={styles.headingIcon}><AccountIcon name="download" /></span><h2 id="account-downloads">{c.title}</h2></div>
    </header>
    <div className={styles.controls}>
      <label className={styles.search}>
        <AccountIcon name="search" />
        <span className="sr-only">{c.search}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.searchHint} aria-describedby="download-filter-hint" />
      </label>
      <p id="download-filter-hint" className={styles.filterHint}>{c.loadedHint}</p>
    </div>
    {loading && !items.length ? <div className={styles.skeletons} role="status"><span className="sr-only">{c.loading}</span>{[0, 1, 2].map((item) => <div className={styles.skeleton} key={item} aria-hidden="true"><span /><div><span /><span /></div><span /></div>)}</div> : null}
    {error ? <div className={styles.notice} role="alert"><p>{error}</p><button type="button" disabled={loading || loadingMore} onClick={() => void load(failedCursor.current)}>{c.retry}</button></div> : null}
    {actionError ? <div className={styles.notice} role="alert"><p>{actionError}</p></div> : null}
    {!loading && !error && !items.length ? <div className={styles.empty}><span className={styles.emptyIcon}><AccountIcon name="download" /></span><h3>{c.empty}</h3><p>{c.emptyHint}</p><Link href={`/${locale}/products?type=digital` as Route}>{c.browse}<AccountIcon name="arrow" /></Link></div> : null}
    {!loading && items.length > 0 && !visible.length ? <div className={styles.empty}><span className={styles.emptyIcon}><AccountIcon name="search" /></span><h3>{c.noMatch}</h3><p>{c.noMatchHint}</p><button type="button" onClick={() => setQuery("")}>{c.clear}</button></div> : null}
    {visible.length > 0 ? <ul className={styles.list}>
      {visible.map((item, index) => {
        const remaining = remainingDownloads(item.file);
        const available = canClaim(item);
        const exhausted = item.file.maxDownloads > 0 && item.file.downloadCount >= item.file.maxDownloads;
        return <li className={styles.row} key={item.id} style={{ "--enter-index": index } as CSSProperties}>
          <div className={styles.product}>
            <span className={styles.fileIcon}><AccountIcon name="file" /></span>
            <div>
              <h3>{item.productId ? <Link href={`/${locale}/products/${item.productId}` as Route}>{item.productTitle}</Link> : item.productTitle}</h3>
              <p>
                <bdi>{item.file.title || item.file.destinationHost}</bdi>
                <span aria-hidden="true"> · </span>
                <bdi>{item.shopName}</bdi>
                <span aria-hidden="true"> · </span>
                <RelativeOrderTime value={item.createdAt} locale={locale} />
              </p>
              <p className={styles.meta}>
                {c.downloadCount}: {item.file.downloadCount.toLocaleString(locale)}
                <span aria-hidden="true"> · </span>
                {remaining === null ? c.unlimited : `${c.remaining}: ${remaining.toLocaleString(locale)}`}
                <span aria-hidden="true"> · </span>
                <span className={styles.remainingDays}>{locale === "fa" ? "روزهای باقی مانده" : locale === "ar" ? "الأيام المتبقية" : "Days remaining"}: {item.remainingDays == null ? c.unlimited : item.remainingDays.toLocaleString(locale)}</span>
                <span aria-hidden="true"> · </span>
                <Link href={`/${locale}/orders/${item.orderId}` as Route}>{c.order} #{item.orderId}</Link>
              </p>
            </div>
          </div>
          <div className={styles.actions}>
            {available ? (
              <button type="button" className={styles.download} disabled={busyId !== null} onClick={() => void download(item)}>
                <AccountIcon name="download" />
                {busyId === item.id ? c.downloading : c.download}
              </button>
            ) : <span className={styles.locked}>{exhausted ? c.exhausted : c.locked}</span>}
          </div>
        </li>;
      })}
    </ul> : null}
    {cursor && !loading ? <div className={styles.loadMore}><button type="button" disabled={loadingMore} onClick={() => void load(cursor)}>{loadingMore ? c.loading : c.more}<AccountIcon name="chevron" /></button></div> : null}
  </section>;
}
