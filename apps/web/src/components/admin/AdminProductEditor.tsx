"use client";
import { ProductAiPanel } from "@/components/ai/ProductAiPanel";
import { splitDownloadUrls, validDownloadUrls } from "../../lib/download-urls";

import type {
  AdminProductDetails,
  AdminProductSummary,
  ProductStatus,
  SellerListingStatus,
  SellerProductOffer,
  Vendor
} from "@topgsm/shared-types";
import type { Route } from "next";
import Link from "next/link";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { productPublicPath } from "@/components/product/ProductPublicUrl";
import { ProductSlugEditor } from "@/components/product/ProductSlugEditor";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import { ProductTranslations } from "./ProductTranslations";
import { ProductDescriptionEditor } from "@/components/product/ProductDescriptionEditor";
import { mergeProductAiDescription, productDescriptionText } from "@/lib/product-description";
import { ProductChangesWorkspace } from "./ProductChangesWorkspace";
import styles from "./AdminProductEditor.module.css";

const COPY = {
  en: {
    back: "Product catalog", title: "Edit product", intro: "Manage the complete catalog record and every seller offer from one workspace.", loadMore: "Load more sellers",
    catalog: "Catalog details", catalogHint: "These fields are shared by every seller listing.", productTitle: "Product title", slug: "Public slug", category: "Category", description: "Description", status: "Publication state", save: "Save catalog", saving: "Saving…", loading: "Loading product…", saved: "Catalog saved.", loadError: "The product could not be loaded.", saveError: "The product could not be saved.", retry: "Try again", publicPage: "Open public page", structure: "Product structure", kind: "Kind", type: "Type", owner: "Created by", variants: "Variants", immutable: "Type and kind are structural. Create a replacement product if the fulfillment model must change.", sellers: "Seller listings", sellersHint: "Edit listing visibility, pricing, SKU, and fulfillment values.", noListings: "No seller listings are attached to this product.", listingStatus: "Listing state", offer: "Offer", price: "Price", currency: "Currency", sku: "Seller SKU", offerStatus: "Offer state", saveOffer: "Save offer", offerSaved: "Offer saved.", listingSaved: "Listing state saved.", fileReference: "Download URLs (one per line, up to 50)", downloads: "Maximum downloads per file", stock: "Stock", weight: "Weight (grams)", serviceType: "Service type", hours: "Estimated hours", instructions: "Instructions", draft: "Draft", active: "Published", pending_review: "Pending review", archived: "Archived", trashed: "Trash", simple: "Simple", variable: "Variable"
  },
  fa: {
    back: "کاتالوگ محصولات", title: "ویرایش محصول", intro: "اطلاعات کامل کاتالوگ و پیشنهادهای همه فروشنده‌ها را در یک صفحه مدیریت کنید.", loadMore: "فروشنده‌های بیشتر",
    catalog: "اطلاعات کاتالوگ", catalogHint: "این اطلاعات میان همه فروشنده‌های محصول مشترک است.", productTitle: "عنوان محصول", slug: "نامک عمومی", category: "دسته‌بندی", description: "توضیحات", status: "وضعیت انتشار", save: "ذخیره کاتالوگ", saving: "در حال ذخیره…", loading: "در حال بارگذاری محصول…", saved: "اطلاعات کاتالوگ ذخیره شد.", loadError: "بارگذاری محصول ممکن نبود.", saveError: "ذخیره محصول ممکن نبود.", retry: "تلاش دوباره", publicPage: "مشاهده صفحه عمومی", structure: "ساختار محصول", kind: "ساختار", type: "نوع", owner: "سازنده", variants: "گونه‌ها", immutable: "نوع و ساختار محصول بنیادی هستند. برای تغییر مدل تحویل، محصول جایگزین بسازید.", sellers: "فهرست فروشنده‌ها", sellersHint: "نمایش فهرست، قیمت، شناسه کالا و اطلاعات تحویل را ویرایش کنید.", noListings: "فروشنده‌ای به این محصول متصل نیست.", listingStatus: "وضعیت فهرست", offer: "پیشنهاد", price: "قیمت", currency: "ارز", sku: "شناسه فروشنده", offerStatus: "وضعیت پیشنهاد", saveOffer: "ذخیره پیشنهاد", offerSaved: "پیشنهاد ذخیره شد.", listingSaved: "وضعیت فهرست ذخیره شد.", fileReference: "لینک‌های دانلود (هر خط یک لینک، حداکثر ۵۰)", downloads: "حداکثر دانلود هر فایل", stock: "موجودی", weight: "وزن (گرم)", serviceType: "نوع خدمت", hours: "ساعت تقریبی", instructions: "دستورالعمل", draft: "پیش‌نویس", active: "منتشرشده", pending_review: "در انتظار بررسی", archived: "بایگانی‌شده", trashed: "زباله‌دان", simple: "ساده", variable: "متغیر"
  },
  ar: {
    back: "كتالوج المنتجات", title: "تعديل المنتج", intro: "أدر سجل الكتالوج الكامل وعروض جميع البائعين من مساحة واحدة.", loadMore: "تحميل بائعين إضافيين",
    catalog: "بيانات الكتالوج", catalogHint: "هذه البيانات مشتركة بين جميع قوائم البائعين.", productTitle: "اسم المنتج", slug: "المعرّف العام", category: "الفئة", description: "الوصف", status: "حالة النشر", save: "حفظ الكتالوج", saving: "جارٍ الحفظ…", loading: "جارٍ تحميل المنتج…", saved: "تم حفظ الكتالوج.", loadError: "تعذر تحميل المنتج.", saveError: "تعذر حفظ المنتج.", retry: "إعادة المحاولة", publicPage: "فتح الصفحة العامة", structure: "بنية المنتج", kind: "البنية", type: "النوع", owner: "أنشأه", variants: "المتغيرات", immutable: "النوع والبنية خصائص أساسية. أنشئ منتجاً بديلاً إذا لزم تغيير نموذج التنفيذ.", sellers: "قوائم البائعين", sellersHint: "عدّل ظهور القائمة والسعر ورمز البائع وبيانات التنفيذ.", noListings: "لا توجد قوائم بائعين مرتبطة بهذا المنتج.", listingStatus: "حالة القائمة", offer: "العرض", price: "السعر", currency: "العملة", sku: "رمز البائع", offerStatus: "حالة العرض", saveOffer: "حفظ العرض", offerSaved: "تم حفظ العرض.", listingSaved: "تم حفظ حالة القائمة.", fileReference: "روابط التنزيل (رابط لكل سطر، حتى ٥٠)", downloads: "الحد الأقصى للتنزيل لكل ملف", stock: "المخزون", weight: "الوزن (غرام)", serviceType: "نوع الخدمة", hours: "الساعات المقدرة", instructions: "التعليمات", draft: "مسودة", active: "منشور", pending_review: "قيد المراجعة", archived: "مؤرشف", trashed: "المهملات", simple: "بسيط", variable: "متغير"
  }
} as const;

const IMAGE_COPY = {
  en: { title: "Product image", hint: "JPEG, PNG, or WebP · up to 8 MiB", choose: "Choose image", replace: "Replace image", remove: "Remove", saved: "Product image saved.", removed: "Product image removed.", error: "The product image could not be updated." },
  fa: { title: "تصویر محصول", hint: "JPEG، PNG یا WebP · حداکثر ۸ مگابایت", choose: "انتخاب تصویر", replace: "تغییر تصویر", remove: "حذف", saved: "تصویر محصول ذخیره شد.", removed: "تصویر محصول حذف شد.", error: "به‌روزرسانی تصویر محصول انجام نشد." },
  ar: { title: "صورة المنتج", hint: "JPEG أو PNG أو WebP · حتى 8 ميغابايت", choose: "اختيار صورة", replace: "تغيير الصورة", remove: "حذف", saved: "تم حفظ صورة المنتج.", removed: "تم حذف صورة المنتج.", error: "تعذر تحديث صورة المنتج." }
} as const;

const TYPE_COPY = {
  en: { digital: "Digital", physical: "Physical", service: "Service", bridge: "Bridge" },
  fa: { digital: "دیجیتال", physical: "فیزیکی", service: "خدمت", bridge: "واسط" },
  ar: { digital: "رقمي", physical: "مادي", service: "خدمة", bridge: "وسيط" }
} as const;

const TRANSFER_COPY = {
  en: { title: "Product seller", current: "Current seller", choose: "Transfer to", placeholder: "Choose a seller", review: "Review transfer", confirm: "Confirm transfer", cancel: "Cancel", hint: "The new seller receives product ownership and its unsold listing. Transfers with sales, reservations, or Bridge bindings are blocked.", question: "Transfer this product to", saved: "Product seller changed and recorded.", error: "The seller could not be changed.", loadError: "Seller choices could not be loaded." },
  fa: { title: "فروشنده محصول", current: "فروشنده فعلی", choose: "واگذاری به", placeholder: "فروشنده را انتخاب کنید", review: "بررسی واگذاری", confirm: "تأیید واگذاری", cancel: "انصراف", hint: "مالکیت محصول و فهرست بدون فروش به فروشنده جدید منتقل می‌شود. محصول دارای فروش، رزرو یا اتصال Bridge قابل واگذاری نیست.", question: "واگذاری این محصول به", saved: "فروشنده محصول تغییر کرد و ثبت شد.", error: "تغییر فروشنده ممکن نبود.", loadError: "فهرست فروشندگان بارگذاری نشد." },
  ar: { title: "بائع المنتج", current: "البائع الحالي", choose: "نقل إلى", placeholder: "اختر بائعاً", review: "مراجعة النقل", confirm: "تأكيد النقل", cancel: "إلغاء", hint: "تنتقل ملكية المنتج وقائمته غير المباعة إلى البائع الجديد. لا يمكن نقل منتج له مبيعات أو حجوزات أو ربط Bridge.", question: "نقل هذا المنتج إلى", saved: "تم تغيير بائع المنتج وتسجيله.", error: "تعذر تغيير البائع.", loadError: "تعذر تحميل خيارات البائعين." }
} as const;

type CoreDraft = Pick<AdminProductDetails, "title" | "slug" | "status"> & {
  category: string;
  description: string;
};

type OfferDraft = {
  price: string;
  currency: string;
  sellerSku: string;
  status: SellerListingStatus;
  fileReference: string;
  maxDownloads: string;
  stock: string;
  weightGrams: string;
  serviceType: string;
  estimatedHours: string;
  instructions: string;
};

function coreDraft(product: AdminProductDetails): CoreDraft {
  return { title: product.title, slug: product.slug, category: product.category ?? "", description: product.description ?? "", status: product.status };
}

function offerDraft(offer: SellerProductOffer): OfferDraft {
  return {
    price: offer.price, currency: offer.currency, sellerSku: offer.sellerSku ?? "", status: offer.status,
    fileReference: (offer.digital?.fileReferences ?? (offer.digital ? [offer.digital.fileReference] : [])).join("\n"), maxDownloads: String(offer.digital?.maxDownloads ?? 0),
    stock: String(offer.physical?.stock ?? 0), weightGrams: String(offer.physical?.weightGrams ?? 0),
    serviceType: offer.service?.serviceType ?? "", estimatedHours: String(offer.service?.estimatedHours ?? 1), instructions: offer.service?.instructions ?? ""
  };
}

function requestMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string") return message;
  }
  return fallback;
}

export function AdminProductEditor({ locale, productId }: { locale: Locale; productId: string }) {
  const c = COPY[locale];
  const imageCopy = IMAGE_COPY[locale];
  const transferCopy = TRANSFER_COPY[locale];
  const [product, setProduct] = useState<AdminProductDetails | null>(null);
  const [draft, setDraft] = useState<CoreDraft | null>(null);
  const [offers, setOffers] = useState<Record<string, OfferDraft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [confirmSellerId, setConfirmSellerId] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    void api.get<Vendor[]>("/seller/vendors").then((response) => setVendors(response.data)).catch(() => setError(transferCopy.loadError));
  }, [transferCopy.loadError]);

  const load = useCallback(async (cursor?: string) => {
    setLoading(true); setError("");
    try {
      const response = await api.get<AdminProductDetails>(`/products/admin/${productId}`, { params: { limit: 20, ...(cursor ? { cursor } : {}) } });
      setProduct((current) => cursor && current ? { ...response.data, listings: [...current.listings, ...response.data.listings] } : response.data);
      if (!cursor) setDraft(coreDraft(response.data));
      setOffers((current) => ({ ...(cursor ? current : {}), ...Object.fromEntries(response.data.listings.flatMap((listing) => listing.offers.map((offer) => [offer.id, offerDraft(offer)]))) }));
    } catch (requestError) {
      setError(requestMessage(requestError, c.loadError));
    } finally { setLoading(false); }
  }, [c.loadError, productId]);

  useEffect(() => { void load(); }, [load]);

  async function saveCore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy("core"); setError(""); setMessage("");
    try {
      const response = await api.patch<AdminProductSummary>(`/products/admin/${productId}`, {
        title: draft.title.trim(), slug: draft.slug.trim(), category: draft.category.trim() || null,
        description: draft.description.trim() || null, status: draft.status
      });
      setProduct((current) => current ? { ...current, ...response.data } : current);
      setDraft((current) => current ? { ...current, title: response.data.title, slug: response.data.slug, category: response.data.category ?? "", description: response.data.description ?? "", status: response.data.status } : current);
      setMessage(c.saved);
    } catch (requestError) { setError(requestMessage(requestError, c.saveError)); }
    finally { setBusy(null); }
  }

  async function saveListing(listingId: string, status: SellerListingStatus) {
    if (busy) return;
    setBusy(`listing:${listingId}`); setError(""); setMessage("");
    try {
      await api.patch(`/products/admin/listings/${listingId}`, { status });
      setProduct((current) => current ? { ...current, listings: current.listings.map((listing) => listing.id === listingId ? { ...listing, status } : listing) } : current);
      setMessage(c.listingSaved);
    } catch (requestError) { setError(requestMessage(requestError, c.saveError)); }
    finally { setBusy(null); }
  }

  async function transferSeller() {
    if (!sellerId || sellerId !== confirmSellerId || busy) return;
    setBusy("transfer"); setError(""); setMessage("");
    try {
      const response = await api.post<AdminProductDetails>(`/products/admin/${productId}/transfer`, { sellerId });
      setProduct(response.data);
      setSellerId(""); setConfirmSellerId("");
      setHistoryVersion((version) => version + 1);
      setMessage(transferCopy.saved);
    } catch (requestError) { setError(requestMessage(requestError, transferCopy.error)); }
    finally { setBusy(null); }
  }

  async function uploadImage(file: File) {
    if (busy) return;
    const body = new FormData();
    body.append("file", file);
    setBusy("image"); setError(""); setMessage("");
    try {
      const response = await api.post<NonNullable<AdminProductDetails["image"]>>(`/products/admin/${productId}/image`, body);
      setProduct((current) => current ? { ...current, image: response.data } : current);
      setMessage(imageCopy.saved);
    } catch (requestError) { setError(requestMessage(requestError, imageCopy.error)); }
    finally { setBusy(null); }
  }

  async function removeImage() {
    if (busy || !product?.image) return;
    setBusy("image"); setError(""); setMessage("");
    try {
      await api.delete(`/products/admin/${productId}/image`);
      setProduct((current) => current ? { ...current, image: null } : current);
      setMessage(imageCopy.removed);
    } catch (requestError) { setError(requestMessage(requestError, imageCopy.error)); }
    finally { setBusy(null); }
  }

  async function saveOffer(event: FormEvent<HTMLFormElement>, offer: SellerProductOffer) {
    event.preventDefault();
    const current = offers[offer.id];
    if (!current || busy) return;
    if (offer.digital && !validDownloadUrls(current.fileReference)) { setError(c.fileReference); return; }
    setBusy(`offer:${offer.id}`); setError(""); setMessage("");
    const payload = {
      price: current.price, currency: current.currency.trim().toUpperCase(),
      sellerSku: current.sellerSku.trim() || null, status: current.status,
      ...(offer.digital ? { digital: { fileReferences: splitDownloadUrls(current.fileReference), maxDownloads: Number(current.maxDownloads) } } : {}),
      ...(offer.physical ? { physical: { stock: Number(current.stock), weightGrams: Number(current.weightGrams) } } : {}),
      ...(offer.service ? { service: { serviceType: current.serviceType.trim(), estimatedHours: Number(current.estimatedHours), instructions: current.instructions.trim() } } : {})
    };
    try {
      const response = await api.patch<SellerProductOffer>(`/products/admin/offers/${offer.id}`, payload);
      setProduct((value) => value ? { ...value, listings: value.listings.map((listing) => ({ ...listing, offers: listing.offers.map((item) => item.id === offer.id ? response.data : item) })) } : value);
      setOffers((value) => ({ ...value, [offer.id]: offerDraft(response.data) }));
      setMessage(c.offerSaved);
    } catch (requestError) { setError(requestMessage(requestError, c.saveError)); }
    finally { setBusy(null); }
  }

  if (loading && !product) return <main className={styles.state}><p>{c.loading}</p></main>;
  if (!product || !draft) return <main className={styles.state}><p role="alert">{error || c.loadError}</p><button type="button" onClick={() => void load()}>{c.retry}</button></main>;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.breadcrumb}><Link href={`/${locale}/admin/products` as Route}>{c.back}</Link><span aria-hidden="true">/</span><span>{c.title}</span></div>
          <h1>{product.title}</h1>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.statusBadge}>{c[product.status]}</span>
          <Link className={styles.publicLink} href={productPublicPath(locale, product.slug) as Route} target="_blank" rel="noopener noreferrer">{c.publicPage}</Link>
        </div>
      </header>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {message ? <p className={styles.message} role="status">{message}</p> : null}

      <div className={styles.layout}>
        <div className={styles.primary}>
          <form className={styles.panel} onSubmit={saveCore} aria-busy={busy === "core"}>
            <header className={styles.panelHeader}><h2>{c.catalog}</h2><p>{c.catalogHint}</p></header>
            <div className={styles.formGrid}>
              <label className={styles.titleField}><span>{c.productTitle}</span><input required minLength={2} maxLength={200} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
              <ProductSlugEditor className={styles.slugField} locale={locale} mode="admin" currentProductId={productId} slug={draft.slug} onChange={(slug) => setDraft((current) => current ? { ...current, slug } : current)} />
              <label><span>{c.category}</span><input maxLength={100} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
              <label><span>{c.status}</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ProductStatus })}><option value="draft">{c.draft}</option><option value="pending_review">{c.pending_review}</option><option value="active">{c.active}</option><option value="archived">{c.archived}</option></select></label>
              <div className={styles.wide}><span>{c.description}</span><ProductDescriptionEditor locale={locale} label={c.description} value={draft.description} onChange={(description) => setDraft((current) => current ? { ...current, description } : current)} disabled={Boolean(busy)} /></div>
            </div>
            <footer><button className={styles.primaryButton} type="submit" disabled={Boolean(busy)}>{busy === "core" ? c.saving : c.save}</button></footer>
          </form>
          <section className={styles.sellers} aria-labelledby="seller-listings-title">
            <header><h2 id="seller-listings-title">{c.sellers}</h2><p>{c.sellersHint}</p></header>
            {!product.listings.length ? <p className={styles.empty}>{c.noListings}</p> : null}
            {product.listings.map((listing) => (
              <article className={styles.listing} key={listing.id}>
                <header>
                  <div><h3>{listing.seller.shopName}</h3><span>{listing.offers.length} {c.offer}</span></div>
                  <label className={styles.inlineField}><span>{c.listingStatus}</span><select value={listing.status} disabled={Boolean(busy)} onChange={(event) => void saveListing(listing.id, event.target.value as SellerListingStatus)}><option value="draft">{c.draft}</option><option value="active">{c.active}</option><option value="archived">{c.archived}</option></select></label>
                </header>
                <div className={styles.offerList}>
                  {listing.offers.map((offer) => {
                    const value = offers[offer.id];
                    if (!value) return null;
                    const update = (field: keyof OfferDraft, next: string) => setOffers((current) => ({ ...current, [offer.id]: { ...current[offer.id], [field]: next } }));
                    return <form className={styles.offer} key={offer.id} onSubmit={(event) => void saveOffer(event, offer)}>
                      <header><div><h4>{offer.variant.name || product.title}</h4><p>{offer.variant.options.map((option) => `${option.name}: ${option.value}`).join(" · ")}</p></div><span>{c.offer}</span></header>
                      <div className={styles.formGrid}>
                        <label><span>{c.price}</span><input required inputMode="decimal" pattern={value.currency === "TOMAN" ? "(?:0|[1-9][0-9]{0,15})" : "(?:0|[1-9][0-9]{0,15})(?:\\.[0-9]{1,4})?"} value={value.price} onChange={(event) => update("price", event.target.value)} /></label>
                        <label><span>{c.currency} ({product.currency})</span><select required value={value.currency} disabled={offer.currency === product.currency} onChange={(event) => update("currency", event.target.value)}><option value="USD">USD</option><option value="TOMAN">تومان</option></select></label>
                        <label><span>{c.sku}</span><input dir="ltr" maxLength={100} value={value.sellerSku} onChange={(event) => update("sellerSku", event.target.value)} /></label>
                        <label><span>{c.offerStatus}</span><select value={value.status} onChange={(event) => update("status", event.target.value)}><option value="draft">{c.draft}</option><option value="active">{c.active}</option><option value="archived">{c.archived}</option></select></label>
                        {offer.digital ? <><label><span>{c.fileReference}</span><textarea required dir="ltr" rows={4} maxLength={102449} value={value.fileReference} onChange={(event) => update("fileReference", event.target.value)} /></label><label><span>{c.downloads}</span><input required type="number" min={0} max={2147483647} value={value.maxDownloads} onChange={(event) => update("maxDownloads", event.target.value)} /></label></> : null}
                        {offer.physical ? <><label><span>{c.stock}</span><input required type="number" min={0} max={2147483647} value={value.stock} onChange={(event) => update("stock", event.target.value)} /></label><label><span>{c.weight}</span><input required type="number" min={0} max={2147483647} value={value.weightGrams} onChange={(event) => update("weightGrams", event.target.value)} /></label></> : null}
                        {offer.service ? <><label><span>{c.serviceType}</span><input required maxLength={100} value={value.serviceType} onChange={(event) => update("serviceType", event.target.value)} /></label><label><span>{c.hours}</span><input required type="number" min={1} max={10000} value={value.estimatedHours} onChange={(event) => update("estimatedHours", event.target.value)} /></label><label className={styles.wide}><span>{c.instructions}</span><textarea maxLength={5000} value={value.instructions} onChange={(event) => update("instructions", event.target.value)} /></label></> : null}
                      </div>
                      <footer><button className={styles.secondaryButton} type="submit" disabled={Boolean(busy)}>{busy === `offer:${offer.id}` ? c.saving : c.saveOffer}</button></footer>
                    </form>;
                  })}
                </div>
              </article>
            ))}
            {product.nextListingCursor ? <button className={styles.loadMore} type="button" disabled={loading} onClick={() => void load(product.nextListingCursor!)}>{c.loadMore}</button> : null}
          </section>
          <ProductAiPanel key={productId} locale={locale} disabled={Boolean(busy)} value={{ title: draft.title, description: productDescriptionText(draft.description), category: draft.category, slug: draft.slug }} onChange={(value) => setDraft((current) => current ? mergeProductAiDescription(current, value) : current)} />
        </div>

        <aside className={styles.sidebar}>
          <section className={`${styles.panel} ${styles.imagePanel}`} aria-busy={busy === "image"}>
            <header><h2>{imageCopy.title}</h2><p>{imageCopy.hint}</p></header>
            <div className={styles.imageContent}>{product.image ? (() => {
              const variant = product.image.variants.find((item) => item.name === "thumb") ?? product.image.variants[0];
              return variant ? <Image className={styles.productImage} unoptimized src={variant.url} alt={product.title} width={variant.width} height={variant.height} /> : null;
            })() : <div className={styles.imagePlaceholder}><span aria-hidden="true">＋</span></div>}
            <div className={styles.imageActions}>
              <label className={styles.secondaryButton}>{product.image ? imageCopy.replace : imageCopy.choose}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.currentTarget.value = ""; }} /></label>
              {product.image ? <button className={styles.secondaryButton} type="button" disabled={Boolean(busy)} onClick={() => void removeImage()}>{imageCopy.remove}</button> : null}
            </div></div>
          </section>
          <section className={styles.panel}>
            <header><h2>{c.structure}</h2><p>{c.immutable}</p></header>
            <dl className={styles.facts}><div><dt>{c.kind}</dt><dd>{c[product.kind]}</dd></div><div><dt>{c.type}</dt><dd>{TYPE_COPY[locale][product.type]}</dd></div><div><dt>{c.owner}</dt><dd>{product.createdBy.shopName}</dd></div><div><dt>{c.variants}</dt><dd>{product.variants.length}</dd></div></dl>
            {product.options.map((option) => <div className={styles.option} key={option.id}><strong>{option.name}</strong><p>{option.values.map((value) => value.value).join(" · ")}</p></div>)}
          </section>
          <section className={styles.panel} aria-labelledby="product-seller-title">
            <header><h2 id="product-seller-title">{transferCopy.title}</h2><p>{transferCopy.hint}</p></header>
            <div className={styles.transferFields}>
              <p>{transferCopy.current}: <strong>{product.seller.shopName}</strong></p>
              <label><span>{transferCopy.choose}</span><select value={sellerId} disabled={Boolean(busy) || product.type === "bridge" || product.status === "trashed"} onChange={(event) => { setSellerId(event.target.value); setConfirmSellerId(""); }}><option value="">{transferCopy.placeholder}</option>{vendors.filter((vendor) => vendor.id !== product.seller.id && vendor.status === "active" && vendor.permissions.includes(product.type === "physical" ? "physical_products_manage" : "products_manage")).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.shopName}</option>)}</select></label>
              {confirmSellerId === sellerId && sellerId ? <><p role="status">{transferCopy.question} <strong>{vendors.find((vendor) => vendor.id === sellerId)?.shopName}</strong>؟</p><div className={styles.transferActions}><button className={styles.primaryButton} type="button" disabled={Boolean(busy)} onClick={() => void transferSeller()}>{transferCopy.confirm}</button><button className={styles.secondaryButton} type="button" disabled={Boolean(busy)} onClick={() => setConfirmSellerId("")}>{transferCopy.cancel}</button></div></> : <button className={styles.secondaryButton} type="button" disabled={Boolean(busy) || !sellerId} onClick={() => setConfirmSellerId(sellerId)}>{transferCopy.review}</button>}
            </div>
          </section>
          <ProductChangesWorkspace key={historyVersion} locale={locale} productId={product.id} compact onRestored={() => void load()} />
        </aside>
      </div>
      <div className={styles.translations}><ProductTranslations locale={locale} productId={productId} /></div>
    </main>
  );
}
