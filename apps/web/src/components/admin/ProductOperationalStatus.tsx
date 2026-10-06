"use client";

import type { AdminProductDetails, AdminShippingPolicy, ShippingPolicyRule } from "@topgsm/shared-types";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./AdminProductEditor.module.css";

const COPY = {
  en: { title: "Product status", type: "Type", structure: "Structure", owner: "Created by", stock: "Inventory", noStock: "Not tracked", inStock: "In stock", outOfStock: "Out of stock", units: "units", loaded: "shown", sales: "Sales status", activeOffers: "active offers", noActive: "No active offers", partial: "More sellers are available below", shipping: "Shipping", shippingNone: "No shipping for this type", shippingLoading: "Loading shipping rules…", shippingError: "Shipping rules unavailable", shippingReady: "Sender ready", shippingDisabled: "Sender disabled", shippingIncomplete: "Sender location incomplete", payer: "Paid by", customer: "Customer", seller: "Seller", site: "Site", defaultRule: "Default rule", sellerRule: "Seller rule", shippingRate: "Flat rate", freeAbove: "Free above", limits: "Parcel limits", attributes: "Attributes", none: "None", variants: "Variants", offers: "Seller offers", commission: "Commission", sku: "SKU", missingSku: "Not set", weight: "Weight", dimensions: "Dimensions", notSet: "Not set", grams: "g", cm: "cm", purchase: "Purchase limits", bridgeRange: "{min}–{max} units per order", standardLimit: "No product level quantity limit", stockLimit: "Limited by available stock", downloads: "Downloads per file", unlimited: "Unlimited", service: "Service", hours: "Estimated hours", more: "Load more sellers below to see all offers" },
  fa: { title: "وضعیت محصول", type: "نوع محصول", structure: "ساختار", owner: "سازنده", stock: "وضعیت انبار و موجودی", noStock: "موجودی ردیابی نمی‌شود", inStock: "موجود", outOfStock: "ناموجود", units: "عدد", loaded: "نمایش‌داده‌شده", sales: "وضعیت فروش", activeOffers: "پیشنهاد فعال", noActive: "پیشنهاد فعالی نیست", partial: "فروشنده‌های بیشتری در پایین صفحه وجود دارند", shipping: "تنظیمات حمل‌ونقل", shippingNone: "برای این نوع محصول ارسال ندارد", shippingLoading: "در حال دریافت قوانین ارسال…", shippingError: "قوانین ارسال در دسترس نیست", shippingReady: "مبدأ ارسال آماده است", shippingDisabled: "مبدأ ارسال غیرفعال است", shippingIncomplete: "موقعیت مبدأ کامل نیست", payer: "پرداخت‌کننده", customer: "خریدار", seller: "فروشنده", site: "سایت", defaultRule: "قانون پیش‌فرض", sellerRule: "قانون فروشنده", shippingRate: "هزینه ثابت", freeAbove: "ارسال رایگان از", limits: "محدودیت بسته", attributes: "ویژگی‌ها", none: "ثبت نشده", variants: "تنوع‌های محصول", offers: "پیشنهادهای فروشنده", commission: "کمیسیون", sku: "شناسه / SKU", missingSku: "ثبت نشده", weight: "وزن", dimensions: "ابعاد", notSet: "ثبت نشده", grams: "گرم", cm: "سانتی‌متر", purchase: "محدودیت خرید", bridgeRange: "{min} تا {max} عدد در هر سفارش", standardLimit: "محدودیت تعدادی برای محصول ثبت نشده", stockLimit: "تعداد قابل خرید به موجودی وابسته است", downloads: "دانلود هر فایل", unlimited: "نامحدود", service: "نوع خدمت", hours: "ساعت تقریبی", more: "برای دیدن همه پیشنهادها، فروشنده‌های بیشتر را در پایین صفحه بارگذاری کنید" },
  ar: { title: "حالة المنتج", type: "نوع المنتج", structure: "البنية", owner: "أنشأه", stock: "المخزون", noStock: "لا يُتتبّع المخزون", inStock: "متوفر", outOfStock: "غير متوفر", units: "وحدة", loaded: "معروضة", sales: "حالة البيع", activeOffers: "عروض نشطة", noActive: "لا توجد عروض نشطة", partial: "يوجد بائعون آخرون أدناه", shipping: "إعدادات الشحن", shippingNone: "لا يوجد شحن لهذا النوع", shippingLoading: "جارٍ تحميل قواعد الشحن…", shippingError: "قواعد الشحن غير متاحة", shippingReady: "عنوان الإرسال جاهز", shippingDisabled: "عنوان الإرسال معطل", shippingIncomplete: "موقع الإرسال غير مكتمل", payer: "يدفعها", customer: "المشتري", seller: "البائع", site: "الموقع", defaultRule: "القاعدة الافتراضية", sellerRule: "قاعدة البائع", shippingRate: "رسوم ثابتة", freeAbove: "مجاني فوق", limits: "حدود الطرد", attributes: "الخصائص", none: "غير مسجل", variants: "تنوعات المنتج", offers: "عروض البائعين", commission: "العمولة", sku: "SKU", missingSku: "غير مسجل", weight: "الوزن", dimensions: "الأبعاد", notSet: "غير مسجل", grams: "غ", cm: "سم", purchase: "حدود الشراء", bridgeRange: "{min}–{max} وحدات لكل طلب", standardLimit: "لا يوجد حد كمية مسجل للمنتج", stockLimit: "الكمية المتاحة مقيدة بالمخزون", downloads: "تنزيلات كل ملف", unlimited: "بلا حد", service: "نوع الخدمة", hours: "الساعات المقدرة", more: "حمّل المزيد من البائعين أدناه لرؤية كل العروض" }
} as const;

const TYPE = {
  en: { digital: "Digital", physical: "Physical", service: "Service", bridge: "Bridge", simple: "Simple", variable: "Variable" },
  fa: { digital: "دیجیتال", physical: "فیزیکی", service: "خدمت", bridge: "واسط", simple: "ساده", variable: "متغیر" },
  ar: { digital: "رقمي", physical: "مادي", service: "خدمة", bridge: "وسيط", simple: "بسيط", variable: "متغير" }
} as const;

const SALE_STATUS = {
  en: { active: "Active", draft: "Draft", archived: "Archived" },
  fa: { active: "فعال", draft: "پیش‌نویس", archived: "بایگانی‌شده" },
  ar: { active: "نشط", draft: "مسودة", archived: "مؤرشف" }
} as const;

const SHIPPING_NOTICE = { en: "shipping not ready for some offers", fa: "ارسال برای بعضی پیشنهادها آماده نیست", ar: "الشحن غير جاهز لبعض العروض" } as const;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

export function ProductOperationalStatus({ locale, product, children }: { locale: Locale; product: AdminProductDetails; children?: ReactNode }) {
  const c = COPY[locale];
  const [policy, setPolicy] = useState<AdminShippingPolicy | null>(null);
  const [policyError, setPolicyError] = useState(false);
  useEffect(() => {
    if (product.type !== "physical") return;
    const controller = new AbortController();
    void api.get<AdminShippingPolicy>("/admin/settings/shipping/policy", { signal: controller.signal })
      .then(({ data }) => { setPolicy(data); setPolicyError(false); })
      .catch(() => { if (!controller.signal.aborted) setPolicyError(true); });
    return () => controller.abort();
  }, [product.type]);

  const number = new Intl.NumberFormat(locale);
  const offers = product.listings.flatMap((listing) => listing.offers);
  const activeOffers = product.listings.flatMap((listing) => listing.status === "active" ? listing.offers.filter((offer) => offer.status === "active") : []);
  const unreadyShipping = product.type === "physical" && product.listings.some((listing) =>
    listing.status === "active" && !listing.seller.shippingReady && listing.offers.some((offer) => offer.status === "active" && offer.physical && offer.physical.stock > 0));
  const stock = offers.reduce((total, offer) => total + (offer.physical?.stock ?? 0), 0);
  const partial = product.nextListingCursor !== null;
  const parcelLimits = (rule: ShippingPolicyRule) => [
    rule.maxWeightGrams != null && `${c.weight}: ${number.format(rule.maxWeightGrams)} ${c.grams}`,
    rule.maxLengthCm != null && `${locale === "fa" ? "طول" : locale === "ar" ? "الطول" : "Length"}: ${number.format(rule.maxLengthCm)} ${c.cm}`,
    rule.maxWidthCm != null && `${locale === "fa" ? "عرض" : locale === "ar" ? "العرض" : "Width"}: ${number.format(rule.maxWidthCm)} ${c.cm}`,
    rule.maxHeightCm != null && `${locale === "fa" ? "ارتفاع" : locale === "ar" ? "الارتفاع" : "Height"}: ${number.format(rule.maxHeightCm)} ${c.cm}`
  ].filter(Boolean).join(" · ") || c.none;

  return <section className={styles.panel} aria-labelledby="product-operational-status-title">
    <header><h2 id="product-operational-status-title">{c.title}</h2></header>
    <dl className={styles.facts}>
      <Fact label={c.type}>{TYPE[locale][product.type]}</Fact>
      <Fact label={c.structure}>{TYPE[locale][product.kind]}</Fact>
      <Fact label={c.owner}>{product.createdBy.shopName}</Fact>
      <Fact label={c.stock}>{product.type === "physical" ? `${stock > 0 ? c.inStock : c.outOfStock} · ${number.format(stock)} ${c.units}${partial ? ` (${c.loaded})` : ""}` : c.noStock}</Fact>
      <Fact label={c.sales}>{activeOffers.length ? `${number.format(activeOffers.length)} ${c.activeOffers}${partial ? ` (${c.loaded})` : ""}${unreadyShipping ? ` · ${SHIPPING_NOTICE[locale]}` : ""}` : partial ? c.partial : c.noActive}</Fact>
      {product.type !== "physical" ? <Fact label={c.shipping}>{c.shippingNone}</Fact> : null}
      <Fact label={c.purchase}>{product.bridgePurchaseLimits ? c.bridgeRange.replace("{min}", number.format(product.bridgePurchaseLimits.minimumQuantity)).replace("{max}", number.format(product.bridgePurchaseLimits.maximumQuantity)) : product.type === "physical" ? c.stockLimit : c.standardLimit}</Fact>
    </dl>

    <div className={styles.statusGroup}>
      <h3>{c.attributes}</h3>
      {product.options.length ? <ul className={styles.statusList}>{product.options.map((option) => <li key={option.id}><strong>{option.name}</strong><span>{option.values.map((value) => value.value).join(" · ") || c.none}</span></li>)}</ul> : <p>{c.none}</p>}
    </div>
    <div className={styles.statusGroup}>
      <h3>{c.variants} · {number.format(product.variants.length)}</h3>
      {product.variants.length ? <ul className={styles.statusList}>{product.variants.map((variant) => <li key={variant.id}><span>{variant.name || variant.options.map((option) => `${option.name}: ${option.value}`).join(" · ") || TYPE[locale].simple}</span></li>)}</ul> : <p>{c.none}</p>}
    </div>
    <div className={styles.statusGroup}>
      <h3>{c.offers} · {number.format(offers.length)}</h3>
      {product.listings.map((listing) => {
        const override = policy?.sellerRules.find((item) => item.sellerId === listing.seller.id);
        const rule = override?.rule ?? policy?.defaultRule;
        return <details className={styles.statusDetails} key={listing.id}>
          <summary><span>{listing.seller.shopName}</span><small>{listing.status === "active" ? number.format(listing.offers.filter((offer) => offer.status === "active").length) : "0"} {c.activeOffers}</small></summary>
          <dl className={styles.facts}>
            <Fact label={c.sales}>{SALE_STATUS[locale][listing.status]}</Fact>
            <Fact label={c.commission}>{number.format(listing.seller.commissionRate * 100)}٪</Fact>
            {product.type === "physical" ? <Fact label={c.shipping}>{listing.seller.shippingReady ? c.shippingReady : listing.seller.shippingProfileEnabled ? c.shippingIncomplete : c.shippingDisabled}</Fact> : null}
            {product.type === "physical" ? <Fact label={c.payer}>{policyError ? c.shippingError : !rule ? c.shippingLoading : `${c[rule.payer]} · ${override ? c.sellerRule : c.defaultRule}`}</Fact> : null}
            {product.type === "physical" && rule ? <><Fact label={c.shippingRate}>{number.format(Number(rule.flatRateToman))} تومان</Fact><Fact label={c.freeAbove}>{rule.freeAboveToman ? `${number.format(Number(rule.freeAboveToman))} تومان` : c.none}</Fact><Fact label={c.limits}>{parcelLimits(rule)}</Fact></> : null}
          </dl>
          {listing.offers.map((offer) => <div className={styles.statusOffer} key={offer.id}>
            <strong>{offer.variant.name || offer.variant.options.map((option) => option.value).join(" · ") || TYPE[locale].simple}</strong>
            <dl className={styles.facts}>
              <Fact label={c.sales}>{SALE_STATUS[locale][offer.status]}</Fact>
              <Fact label={c.sku}><span dir="ltr">{offer.sellerSku || c.missingSku}</span></Fact>
              {offer.physical ? <><Fact label={c.stock}>{number.format(offer.physical.stock)} {c.units}</Fact><Fact label={c.weight}>{offer.physical.weightGrams ? `${number.format(offer.physical.weightGrams)} ${c.grams}` : c.notSet}</Fact><Fact label={c.dimensions}>{[offer.physical.lengthCm, offer.physical.widthCm, offer.physical.heightCm].every((value) => value != null) ? `${offer.physical.lengthCm} × ${offer.physical.widthCm} × ${offer.physical.heightCm} ${c.cm}` : c.notSet}</Fact></> : null}
              {offer.digital ? <Fact label={c.downloads}>{offer.digital.maxDownloads ? number.format(offer.digital.maxDownloads) : c.unlimited}</Fact> : null}
              {offer.service ? <><Fact label={c.service}>{offer.service.serviceType}</Fact><Fact label={c.hours}>{number.format(offer.service.estimatedHours)}</Fact></> : null}
            </dl>
          </div>)}
        </details>;
      })}
      {!product.listings.length ? <p>{c.none}</p> : null}
      {partial ? <p className={styles.statusNote}>{c.more}</p> : null}
    </div>
    {children ? <div className={styles.statusGroup}>{children}</div> : null}
  </section>;
}
