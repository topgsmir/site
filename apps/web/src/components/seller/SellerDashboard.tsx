"use client";

import axios from "axios";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AppUser,
  ProductKind,
  ProductStatus,
  ProductType,
  SellerListing,
  SellerListingsPage
} from "@topgsm/shared-types";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ProductPublicUrl } from "@/components/product/ProductPublicUrl";
import { SellerCoupons } from "./SellerCoupons";
import { SellerBlogPanel } from "./SellerBlogPanel";
import styles from "./SellerDashboard.module.css";

type DashboardSection = "overview" | "products" | "blog" | "coupons" | "orders" | "payouts";
type RequestState = "idle" | "loading" | "error" | "success";

type SellerDashboardProps = {
  locale: Locale;
  user: Pick<AppUser, "fullName" | "email" | "permissions">;
  initialSection?: DashboardSection;
};

type SellerProductCreationProps = Omit<SellerDashboardProps, "initialSection">;

type OfferDraft = {
  id: string;
  name: string;
  optionValue: string;
  price: string;
  sellerSku: string;
  fileReference: string;
  maxDownloads: string;
  stock: string;
  weightGrams: string;
  serviceType: string;
  estimatedHours: string;
  instructions: string;
};

type ProductDraft = {
  title: string;
  category: string;
  description: string;
  kind: ProductKind;
  type: ProductType;
  status: ProductStatus;
  currency: string;
  optionName: string;
  offers: OfferDraft[];
};

type DashboardCopy = {
  brand: string;
  workspace: string;
  overview: string;
  products: string;
  blog: string;
  coupons: string;
  orders: string;
  payouts: string;
  account: string;
  welcome: string;
  overviewDescription: string;
  addProduct: string;
  loadedProducts: string;
  activeListings: string;
  offersShown: string;
  catalogHealth: string;
  noProducts: string;
  noProductsDescription: string;
  recentProducts: string;
  viewProducts: string;
  productsDescription: string;
  searchProducts: string;
  allStatuses: string;
  draft: string;
  active: string;
  archived: string;
  product: string;
  productUrl: string;
  type: string;
  kind: string;
  offers: string;
  price: string;
  status: string;
  loadMore: string;
  loading: string;
  retry: string;
  listError: string;
  emptySearch: string;
  simple: string;
  variable: string;
  digital: string;
  physical: string;
  service: string;
  sectionUnavailable: string;
  ordersUnavailable: string;
  payoutsUnavailable: string;
  backToOverview: string;
  newProduct: string;
  newProductDescription: string;
  close: string;
  basics: string;
  title: string;
  category: string;
  description: string;
  productKind: string;
  productType: string;
  publishState: string;
  offerDetails: string;
  currency: string;
  optionName: string;
  optionNameHint: string;
  variant: string;
  variantName: string;
  optionValue: string;
  sellerSku: string;
  fileReference: string;
  fileReferenceHint: string;
  maxDownloads: string;
  stock: string;
  weightGrams: string;
  serviceType: string;
  estimatedHours: string;
  instructions: string;
  addVariant: string;
  removeVariant: string;
  cancel: string;
  createProduct: string;
  creatingProduct: string;
  formIncomplete: string;
  createError: string;
  sellerRole: string;
  moreAvailable: string;
};

const COPY: Record<Locale, DashboardCopy> = {
  en: {
    brand: "TOP GSM",
    workspace: "Seller workspace",
    overview: "Overview",
    products: "Products",
    blog: "Blog",
    coupons: "Coupons",
    orders: "Orders",
    payouts: "Payouts",
    account: "Account",
    welcome: "Your selling workspace",
    overviewDescription: "Review the catalog, publish offers, and move between seller operations from one place.",
    addProduct: "Add product",
    loadedProducts: "Products loaded",
    activeListings: "Active listings",
    offersShown: "Offers shown",
    catalogHealth: "Catalog snapshot",
    noProducts: "No products yet",
    noProductsDescription: "Add the first product to create a listing and seller offer.",
    recentProducts: "Recent products",
    viewProducts: "View products",
    productsDescription: "Create simple or variable listings for downloads, physical goods, and services.",
    searchProducts: "Search products",
    allStatuses: "All statuses",
    draft: "Draft",
    active: "Active",
    archived: "Archived",
    product: "Product",
    productUrl: "Product URL",
    type: "Type",
    kind: "Kind",
    offers: "Offers",
    price: "Price",
    status: "Status",
    loadMore: "Load more",
    loading: "Loading…",
    retry: "Try again",
    listError: "Products could not be loaded. Check seller access, then try again.",
    emptySearch: "No products match this search.",
    simple: "Simple",
    variable: "Variable",
    digital: "Download",
    physical: "Physical",
    service: "Service",
    sectionUnavailable: "This section is not connected yet",
    ordersUnavailable: "Seller-scoped order data must be secured before orders can appear here.",
    payoutsUnavailable: "Seller-scoped payout data must be secured before payout requests can appear here.",
    backToOverview: "Back to overview",
    newProduct: "Create a product",
    newProductDescription: "The catalog record and your seller offer are created together.",
    close: "Close",
    basics: "Product details",
    title: "Product title",
    category: "Category",
    description: "Description",
    productKind: "Product structure",
    productType: "Fulfillment type",
    publishState: "Initial status",
    offerDetails: "Offer details",
    currency: "Currency",
    optionName: "Option name",
    optionNameHint: "For example: Storage, Color, or License.",
    variant: "Variant",
    variantName: "Variant label",
    optionValue: "Option value",
    sellerSku: "Seller SKU",
    fileReference: "Secure file reference",
    fileReferenceHint: "Use a storage key, not a public download URL.",
    maxDownloads: "Maximum downloads",
    stock: "Stock",
    weightGrams: "Weight in grams",
    serviceType: "Service type",
    estimatedHours: "Estimated hours",
    instructions: "Buyer instructions",
    addVariant: "Add variant",
    removeVariant: "Remove variant",
    cancel: "Cancel",
    createProduct: "Create product",
    creatingProduct: "Creating…",
    formIncomplete: "Complete the required fields with valid values, then create the product.",
    createError: "The product could not be created. Review the details and try again.",
    sellerRole: "Seller account",
    moreAvailable: "More products are available"
  },
  fa: {
    brand: "TOP GSM",
    workspace: "فضای کاری فروشنده",
    overview: "نمای کلی",
    products: "محصولات",
    blog: "وبلاگ",
    coupons: "کدهای تخفیف",
    orders: "سفارش‌ها",
    payouts: "تسویه‌ها",
    account: "حساب کاربری",
    welcome: "فضای مدیریت فروش شما",
    overviewDescription: "کاتالوگ را بررسی کنید، پیشنهادهای فروش را منتشر کنید و بین بخش‌های فروشنده جابه‌جا شوید.",
    addProduct: "افزودن محصول",
    loadedProducts: "محصول بارگذاری‌شده",
    activeListings: "فهرست فعال",
    offersShown: "پیشنهاد قابل مشاهده",
    catalogHealth: "نمای فعلی کاتالوگ",
    noProducts: "هنوز محصولی ندارید",
    noProductsDescription: "برای ساخت اولین فهرست و پیشنهاد فروش، یک محصول اضافه کنید.",
    recentProducts: "محصولات اخیر",
    viewProducts: "مشاهده محصولات",
    productsDescription: "محصول ساده یا متغیر برای دانلود، کالای فیزیکی و خدمات بسازید.",
    searchProducts: "جست‌وجوی محصولات",
    allStatuses: "همه وضعیت‌ها",
    draft: "پیش‌نویس",
    active: "فعال",
    archived: "بایگانی‌شده",
    product: "محصول",
    productUrl: "نشانی محصول",
    type: "نوع",
    kind: "ساختار",
    offers: "پیشنهادها",
    price: "قیمت",
    status: "وضعیت",
    loadMore: "نمایش بیشتر",
    loading: "در حال بارگذاری…",
    retry: "تلاش دوباره",
    listError: "محصولات بارگذاری نشدند. دسترسی فروشنده را بررسی و دوباره تلاش کنید.",
    emptySearch: "محصولی مطابق این جست‌وجو پیدا نشد.",
    simple: "ساده",
    variable: "متغیر",
    digital: "دانلودی",
    physical: "فیزیکی",
    service: "خدمت",
    sectionUnavailable: "این بخش هنوز متصل نشده است",
    ordersUnavailable: "پیش از نمایش سفارش‌ها، داده‌ها باید به‌صورت امن به همین فروشنده محدود شوند.",
    payoutsUnavailable: "پیش از نمایش درخواست‌های تسویه، داده‌ها باید به‌صورت امن به همین فروشنده محدود شوند.",
    backToOverview: "بازگشت به نمای کلی",
    newProduct: "ساخت محصول",
    newProductDescription: "رکورد کاتالوگ و پیشنهاد فروش شما هم‌زمان ساخته می‌شوند.",
    close: "بستن",
    basics: "مشخصات محصول",
    title: "عنوان محصول",
    category: "دسته‌بندی",
    description: "توضیحات",
    productKind: "ساختار محصول",
    productType: "نوع تحویل",
    publishState: "وضعیت اولیه",
    offerDetails: "جزئیات پیشنهاد فروش",
    currency: "واحد پول",
    optionName: "نام ویژگی",
    optionNameHint: "برای مثال: حافظه، رنگ یا مجوز.",
    variant: "تنوع",
    variantName: "عنوان تنوع",
    optionValue: "مقدار ویژگی",
    sellerSku: "شناسه کالای فروشنده",
    fileReference: "شناسه امن فایل",
    fileReferenceHint: "کلید فضای ذخیره‌سازی را وارد کنید، نه لینک عمومی دانلود.",
    maxDownloads: "حداکثر دانلود",
    stock: "موجودی",
    weightGrams: "وزن به گرم",
    serviceType: "نوع خدمت",
    estimatedHours: "زمان تخمینی به ساعت",
    instructions: "دستورالعمل خریدار",
    addVariant: "افزودن تنوع",
    removeVariant: "حذف تنوع",
    cancel: "انصراف",
    createProduct: "ساخت محصول",
    creatingProduct: "در حال ساخت…",
    formIncomplete: "فیلدهای ضروری را با مقادیر معتبر کامل کنید و دوباره محصول را بسازید.",
    createError: "محصول ساخته نشد. اطلاعات را بررسی و دوباره تلاش کنید.",
    sellerRole: "حساب فروشنده",
    moreAvailable: "محصولات بیشتری موجود است"
  },
  ar: {
    brand: "TOP GSM",
    workspace: "مساحة عمل البائع",
    overview: "نظرة عامة",
    products: "المنتجات",
    blog: "المدونة",
    coupons: "القسائم",
    orders: "الطلبات",
    payouts: "الدفعات",
    account: "الحساب",
    welcome: "مساحة إدارة مبيعاتك",
    overviewDescription: "راجع الكتالوج وانشر عروض البيع وانتقل بين عمليات البائع من مكان واحد.",
    addProduct: "إضافة منتج",
    loadedProducts: "منتجات محمّلة",
    activeListings: "قوائم نشطة",
    offersShown: "عروض ظاهرة",
    catalogHealth: "ملخص الكتالوج الحالي",
    noProducts: "لا توجد منتجات بعد",
    noProductsDescription: "أضف المنتج الأول لإنشاء قائمة وعرض بيع.",
    recentProducts: "المنتجات الأخيرة",
    viewProducts: "عرض المنتجات",
    productsDescription: "أنشئ منتجات بسيطة أو متغيرة للتنزيل والسلع المادية والخدمات.",
    searchProducts: "بحث في المنتجات",
    allStatuses: "كل الحالات",
    draft: "مسودة",
    active: "نشط",
    archived: "مؤرشف",
    product: "المنتج",
    productUrl: "رابط المنتج",
    type: "النوع",
    kind: "البنية",
    offers: "العروض",
    price: "السعر",
    status: "الحالة",
    loadMore: "تحميل المزيد",
    loading: "جارٍ التحميل…",
    retry: "إعادة المحاولة",
    listError: "تعذر تحميل المنتجات. تحقق من وصول البائع ثم حاول مرة أخرى.",
    emptySearch: "لا توجد منتجات مطابقة لهذا البحث.",
    simple: "بسيط",
    variable: "متغير",
    digital: "تنزيل",
    physical: "مادي",
    service: "خدمة",
    sectionUnavailable: "هذا القسم غير متصل بعد",
    ordersUnavailable: "يجب تأمين بيانات الطلبات وتقييدها بهذا البائع قبل عرضها هنا.",
    payoutsUnavailable: "يجب تأمين بيانات الدفعات وتقييدها بهذا البائع قبل عرضها هنا.",
    backToOverview: "العودة إلى النظرة العامة",
    newProduct: "إنشاء منتج",
    newProductDescription: "يتم إنشاء سجل الكتالوج وعرض البائع معًا.",
    close: "إغلاق",
    basics: "تفاصيل المنتج",
    title: "عنوان المنتج",
    category: "الفئة",
    description: "الوصف",
    productKind: "بنية المنتج",
    productType: "نوع التنفيذ",
    publishState: "الحالة الأولية",
    offerDetails: "تفاصيل العرض",
    currency: "العملة",
    optionName: "اسم الخيار",
    optionNameHint: "مثال: التخزين أو اللون أو الترخيص.",
    variant: "متغير",
    variantName: "تسمية المتغير",
    optionValue: "قيمة الخيار",
    sellerSku: "رمز البائع",
    fileReference: "مرجع الملف الآمن",
    fileReferenceHint: "استخدم مفتاح التخزين، وليس رابط تنزيل عامًا.",
    maxDownloads: "الحد الأقصى للتنزيلات",
    stock: "المخزون",
    weightGrams: "الوزن بالغرام",
    serviceType: "نوع الخدمة",
    estimatedHours: "الساعات المقدرة",
    instructions: "تعليمات المشتري",
    addVariant: "إضافة متغير",
    removeVariant: "إزالة المتغير",
    cancel: "إلغاء",
    createProduct: "إنشاء المنتج",
    creatingProduct: "جارٍ الإنشاء…",
    formIncomplete: "أكمل الحقول المطلوبة بقيم صحيحة، ثم أنشئ المنتج.",
    createError: "تعذر إنشاء المنتج. راجع التفاصيل وحاول مرة أخرى.",
    sellerRole: "حساب البائع",
    moreAvailable: "توجد منتجات إضافية"
  }
};

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/;
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;
const STORAGE_REFERENCE_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/;

function makeOffer(id: string): OfferDraft {
  return {
    id,
    name: "",
    optionValue: "",
    price: "",
    sellerSku: "",
    fileReference: "",
    maxDownloads: "1",
    stock: "0",
    weightGrams: "0",
    serviceType: "",
    estimatedHours: "1",
    instructions: ""
  };
}

function makeDraft(): ProductDraft {
  return {
    title: "",
    category: "",
    description: "",
    kind: "simple",
    type: "physical",
    status: "draft",
    currency: "USD",
    optionName: "",
    offers: [makeOffer("variant-1")]
  };
}

function Icon({ name }: { name: DashboardSection | "plus" | "search" | "close" | "box" }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    products: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></>,
    blog: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    coupons: <><path d="M4 7a3 3 0 0 0 3-3h13v6a2 2 0 0 0 0 4v6H7a3 3 0 0 0-3-3z"/><path d="M12 7v2M12 11v2M12 15v2"/></>,
    orders: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></>,
    payouts: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    box: <><path d="M5 8.5 12 5l7 3.5v7L12 19l-7-3.5z"/><path d="m5 8.5 7 3.5 7-3.5"/></>
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function requestError(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(" ");
  return typeof message === "string" ? message : fallback;
}

function statusLabel(status: ProductStatus, copy: DashboardCopy) {
  return copy[status];
}

function validateDraft(draft: ProductDraft) {
  if (draft.title.trim().length < 2) return false;
  if (!CURRENCY_PATTERN.test(draft.currency.trim())) return false;
  if (draft.kind === "variable" && !draft.optionName.trim()) return false;
  if (draft.kind === "variable" && draft.offers.length < 1) return false;

  return draft.offers.every((offer) => {
    if (!MONEY_PATTERN.test(offer.price.trim())) return false;
    if (draft.kind === "variable" && !offer.optionValue.trim()) return false;
    if (draft.type === "digital") {
      return STORAGE_REFERENCE_PATTERN.test(offer.fileReference.trim()) && Number.isInteger(Number(offer.maxDownloads)) && Number(offer.maxDownloads) >= 0;
    }
    if (draft.type === "physical") {
      return Number.isInteger(Number(offer.stock)) && Number(offer.stock) >= 0 && Number.isInteger(Number(offer.weightGrams)) && Number(offer.weightGrams) >= 0;
    }
    return Boolean(offer.serviceType.trim()) && Number.isInteger(Number(offer.estimatedHours)) && Number(offer.estimatedHours) >= 1;
  });
}

function buildOffer(draft: ProductDraft, offer: OfferDraft) {
  const shared = {
    price: offer.price.trim(),
    currency: draft.currency.trim().toUpperCase(),
    status: draft.status,
    ...(offer.sellerSku.trim() ? { sellerSku: offer.sellerSku.trim() } : {})
  };

  if (draft.type === "digital") {
    return {
      ...shared,
      digital: {
        fileReference: offer.fileReference.trim(),
        maxDownloads: Number(offer.maxDownloads)
      }
    };
  }
  if (draft.type === "physical") {
    return {
      ...shared,
      physical: {
        stock: Number(offer.stock),
        weightGrams: Number(offer.weightGrams)
      }
    };
  }
  return {
    ...shared,
    service: {
      serviceType: offer.serviceType.trim(),
      estimatedHours: Number(offer.estimatedHours),
      ...(offer.instructions.trim() ? { instructions: offer.instructions.trim() } : {})
    }
  };
}

function OfferFields({
  copy,
  draft,
  offer,
  index,
  canRemove,
  update,
  remove
}: {
  copy: DashboardCopy;
  draft: ProductDraft;
  offer: OfferDraft;
  index: number;
  canRemove: boolean;
  update: (id: string, key: keyof OfferDraft, value: string) => void;
  remove: (id: string) => void;
}) {
  return (
    <fieldset className={styles.offerGroup}>
      <legend>{draft.kind === "variable" ? `${copy.variant} ${index + 1}` : copy.offerDetails}</legend>
      {draft.kind === "variable" ? (
        <div className={styles.twoColumns}>
          <label className={styles.field}>
            <span>{copy.optionValue}</span>
            <input required maxLength={100} value={offer.optionValue} onChange={(event) => update(offer.id, "optionValue", event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>{copy.variantName}</span>
            <input maxLength={200} value={offer.name} onChange={(event) => update(offer.id, "name", event.target.value)} />
          </label>
        </div>
      ) : null}
      <div className={styles.threeColumns}>
        <label className={styles.field}>
          <span>{copy.price}</span>
          <input required inputMode="decimal" pattern="(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,4})?" value={offer.price} onChange={(event) => update(offer.id, "price", event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>{copy.sellerSku}</span>
          <input maxLength={100} value={offer.sellerSku} onChange={(event) => update(offer.id, "sellerSku", event.target.value)} />
        </label>
        {draft.type === "digital" ? (
          <label className={styles.field}>
            <span>{copy.maxDownloads}</span>
            <input required type="number" min="0" step="1" value={offer.maxDownloads} onChange={(event) => update(offer.id, "maxDownloads", event.target.value)} />
          </label>
        ) : null}
        {draft.type === "physical" ? (
          <>
            <label className={styles.field}>
              <span>{copy.stock}</span>
              <input required type="number" min="0" step="1" value={offer.stock} onChange={(event) => update(offer.id, "stock", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>{copy.weightGrams}</span>
              <input required type="number" min="0" step="1" value={offer.weightGrams} onChange={(event) => update(offer.id, "weightGrams", event.target.value)} />
            </label>
          </>
        ) : null}
        {draft.type === "service" ? (
          <>
            <label className={styles.field}>
              <span>{copy.serviceType}</span>
              <input required maxLength={100} value={offer.serviceType} onChange={(event) => update(offer.id, "serviceType", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>{copy.estimatedHours}</span>
              <input required type="number" min="1" step="1" value={offer.estimatedHours} onChange={(event) => update(offer.id, "estimatedHours", event.target.value)} />
            </label>
          </>
        ) : null}
      </div>
      {draft.type === "digital" ? (
        <label className={styles.field}>
          <span>{copy.fileReference}</span>
          <input required maxLength={512} value={offer.fileReference} onChange={(event) => update(offer.id, "fileReference", event.target.value)} aria-describedby={`${offer.id}-file-hint`} />
          <small id={`${offer.id}-file-hint`}>{copy.fileReferenceHint}</small>
        </label>
      ) : null}
      {draft.type === "service" ? (
        <label className={styles.field}>
          <span>{copy.instructions}</span>
          <textarea maxLength={5000} value={offer.instructions} onChange={(event) => update(offer.id, "instructions", event.target.value)} />
        </label>
      ) : null}
      {canRemove ? (
        <button className={styles.removeButton} type="button" onClick={() => remove(offer.id)}>
          <Icon name="close" />
          {copy.removeVariant}
        </button>
      ) : null}
    </fieldset>
  );
}

export function SellerDashboard({ locale, user, initialSection = "overview" }: SellerDashboardProps) {
  const router = useRouter();
  const copy = COPY[locale];
  const [section, setSection] = useState<DashboardSection>(initialSection);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listState, setListState] = useState<RequestState>("loading");
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all");

  const loadListings = useCallback(async (cursor?: string, append = false) => {
    setListState("loading");
    setListError("");
    try {
      const response = await api.get<SellerListingsPage>("/products/mine", {
        params: { limit: 20, ...(cursor ? { cursor } : {}) }
      });
      setListings((current) => append ? [...current, ...response.data.items] : response.data.items);
      setNextCursor(response.data.nextCursor);
      setListState("success");
    } catch (error) {
      setListError(requestError(error, copy.listError));
      setListState("error");
    }
  }, [copy.listError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadListings(), 0);
    return () => window.clearTimeout(timer);
  }, [loadListings]);

  const visibleListings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return listings.filter((listing) => {
      const matchesStatus = statusFilter === "all" || listing.status === statusFilter;
      const matchesQuery = !query || [listing.product.title, listing.product.category ?? "", listing.product.slug]
        .some((value) => value.toLocaleLowerCase(locale).includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [listings, locale, search, statusFilter]);

  const activeListings = listings.filter((listing) => listing.status === "active").length;
  const offersShown = listings.reduce((total, listing) => total + listing.offers.length, 0);

  function selectSection(next: DashboardSection) {
    setSection(next);
    document.querySelector("main")?.focus({ preventScroll: true });
  }

  function openProductPage() {
    router.push(`/${locale}/seller-dashboard/products/new` as Route);
  }

  const navigation: Array<{ id: DashboardSection; label: string }> = [
    { id: "overview", label: copy.overview },
    { id: "products", label: copy.products },
    ...(user.permissions?.includes("blog_manage")
      ? [{ id: "blog" as const, label: copy.blog }]
      : []),
    ...(user.permissions?.includes("coupons_manage")
      ? [{ id: "coupons" as const, label: copy.coupons }]
      : []),
    { id: "orders", label: copy.orders },
    { id: "payouts", label: copy.payouts }
  ];

  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <div className={styles.brandBlock}>
          <strong>{copy.brand}</strong>
          <span>{copy.workspace}</span>
        </div>
        <nav className={styles.navigation} aria-label={copy.workspace}>
          {navigation.map((item) => (
            <button
              className={styles.navButton}
              type="button"
              key={item.id}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => selectSection(item.id)}
              data-state="default"
            >
              <Icon name={item.id} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className={styles.accountBlock}>
          <span>{copy.account}</span>
          <strong>{user.fullName}</strong>
          <small>{user.email}</small>
          <small>{copy.sellerRole}</small>
          <LogoutButton locale={locale} />
        </div>
      </aside>

      <main className={styles.main} tabIndex={-1}>
        <header className={styles.pageHeader}>
          <div>
            <p>{copy.workspace}</p>
            <h1>{section === "overview" ? copy.welcome : copy[section]}</h1>
          </div>
          {(section === "overview" || section === "products") ? (
            <button className={styles.primaryButton} type="button" onClick={openProductPage} data-state="default">
              <Icon name="plus" />
              {copy.addProduct}
            </button>
          ) : null}
        </header>

        <div className={styles.sectionBody} key={section}>
          {section === "overview" ? (
            <section aria-labelledby="catalog-snapshot-title">
              <div className={styles.introRow}>
                <p>{copy.overviewDescription}</p>
                {nextCursor ? <span className={styles.moreNote}>{copy.moreAvailable}</span> : null}
              </div>
              <div className={styles.metricStrip} aria-labelledby="catalog-snapshot-title">
                <h2 id="catalog-snapshot-title" className={styles.srOnly}>{copy.catalogHealth}</h2>
                <dl>
                  <div><dt>{copy.loadedProducts}</dt><dd>{listings.length}</dd></div>
                  <div><dt>{copy.activeListings}</dt><dd>{activeListings}</dd></div>
                  <div><dt>{copy.offersShown}</dt><dd>{offersShown}</dd></div>
                </dl>
              </div>
              <div className={styles.workspaceBlock}>
                <div className={styles.blockHeading}>
                  <h2>{copy.recentProducts}</h2>
                  <button className={styles.textButton} type="button" onClick={() => selectSection("products")}>
                    {copy.viewProducts}
                  </button>
                </div>
                <ProductList
                  copy={copy}
                  locale={locale}
                  listings={listings.slice(0, 5)}
                  state={listState}
                  error={listError}
                  onRetry={() => void loadListings()}
                  onAdd={openProductPage}
                />
              </div>
            </section>
          ) : null}

          {section === "products" ? (
            <section aria-labelledby="products-title">
              <div className={styles.introRow}>
                <div>
                  <h2 id="products-title" className={styles.sectionTitle}>{copy.products}</h2>
                  <p>{copy.productsDescription}</p>
                </div>
              </div>
              <div className={styles.filters}>
                <label className={styles.searchField}>
                  <span className={styles.srOnly}>{copy.searchProducts}</span>
                  <Icon name="search" />
                  <input type="search" value={search} placeholder={copy.searchProducts} onChange={(event) => setSearch(event.target.value)} />
                </label>
                <label className={styles.filterField}>
                  <span className={styles.srOnly}>{copy.status}</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ProductStatus | "all")}>
                    <option value="all">{copy.allStatuses}</option>
                    <option value="draft">{copy.draft}</option>
                    <option value="active">{copy.active}</option>
                    <option value="archived">{copy.archived}</option>
                  </select>
                </label>
              </div>
              <ProductList
                copy={copy}
                locale={locale}
                listings={visibleListings}
                state={listState}
                error={listError}
                emptySearch={Boolean(search.trim()) || statusFilter !== "all"}
                onRetry={() => void loadListings()}
                onAdd={openProductPage}
              />
              {nextCursor && listState !== "loading" ? (
                <button className={styles.loadMoreButton} type="button" onClick={() => void loadListings(nextCursor, true)}>
                  {copy.loadMore}
                </button>
              ) : null}
            </section>
          ) : null}

          {section === "coupons" ? <SellerCoupons locale={locale} /> : null}

          {section === "blog" ? <SellerBlogPanel locale={locale} listings={listings} /> : null}

          {section === "orders" || section === "payouts" ? (
            <section className={styles.unavailable} aria-labelledby="unavailable-title">
              <Icon name={section} />
              <h2 id="unavailable-title">{copy.sectionUnavailable}</h2>
              <p>{section === "orders" ? copy.ordersUnavailable : copy.payoutsUnavailable}</p>
              <button className={styles.secondaryButton} type="button" onClick={() => selectSection("overview")}>
                {copy.backToOverview}
              </button>
            </section>
          ) : null}
        </div>

        <footer className={styles.footer}>
          <span>{copy.brand}</span>
          <span>{user.email}</span>
        </footer>
      </main>

    </div>
  );
}

export function SellerProductCreation({ locale, user }: SellerProductCreationProps) {
  const router = useRouter();
  const copy = COPY[locale];
  const [draft, setDraft] = useState<ProductDraft>(() => makeDraft());
  const [submitState, setSubmitState] = useState<RequestState>("idle");
  const [formError, setFormError] = useState("");
  const nextVariantNumber = useRef(2);

  function updateDraft<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (formError) setFormError("");
  }

  function changeKind(kind: ProductKind) {
    setDraft((current) => ({
      ...current,
      kind,
      optionName: kind === "variable" ? current.optionName : "",
      offers: kind === "variable" && current.offers.length === 1
        ? [current.offers[0], makeOffer("variant-2")]
        : [current.offers[0]]
    }));
    nextVariantNumber.current = 3;
    setFormError("");
  }

  function updateOffer(id: string, key: keyof OfferDraft, value: string) {
    setDraft((current) => ({
      ...current,
      offers: current.offers.map((offer) => offer.id === id ? { ...offer, [key]: value } : offer)
    }));
    if (formError) setFormError("");
  }

  function addVariant() {
    if (draft.offers.length >= 100) return;
    const id = `variant-${nextVariantNumber.current}`;
    nextVariantNumber.current += 1;
    setDraft((current) => ({ ...current, offers: [...current.offers, makeOffer(id)] }));
  }

  function removeVariant(id: string) {
    setDraft((current) => ({ ...current, offers: current.offers.filter((offer) => offer.id !== id) }));
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateDraft(draft)) {
      setFormError(copy.formIncomplete);
      setSubmitState("error");
      return;
    }

    setSubmitState("loading");
    setFormError("");
    const offers = draft.offers.map((offer) => ({
      ...(draft.kind === "variable" ? { variantKey: offer.id } : {}),
      ...buildOffer(draft, offer)
    }));
    const payload = {
      title: draft.title.trim(),
      ...(draft.category.trim() ? { category: draft.category.trim() } : {}),
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
      kind: draft.kind,
      type: draft.type,
      status: draft.status,
      ...(draft.kind === "variable" ? {
        variants: draft.offers.map((offer) => ({
          key: offer.id,
          ...(offer.name.trim() ? { name: offer.name.trim() } : {}),
          options: [{ name: draft.optionName.trim(), value: offer.optionValue.trim() }]
        }))
      } : {}),
      offers
    };

    try {
      await api.post<SellerListing>("/products", payload);
      setSubmitState("success");
      router.replace(`/${locale}/seller-dashboard?section=products`);
    } catch (error) {
      setFormError(requestError(error, copy.createError));
      setSubmitState("error");
    }
  }

  return (
    <div className={styles.creationShell}>
      <header className={styles.creationTopbar}>
        <Link className={styles.creationBrand} href={`/${locale}/seller-dashboard`}>
          <strong>{copy.brand}</strong>
          <span>{copy.workspace}</span>
        </Link>
        <div className={styles.creationAccount}>
          <strong>{user.fullName}</strong>
          <span>{user.email}</span>
        </div>
      </header>

      <main className={styles.creationMain}>
        <header className={styles.creationHeader}>
          <div>
            <p>{copy.products}</p>
            <h1>{copy.newProduct}</h1>
            <span>{copy.newProductDescription}</span>
          </div>
          <Link className={styles.secondaryButton} href={`/${locale}/seller-dashboard?section=products`}>
            {copy.cancel}
          </Link>
        </header>

        <form className={styles.productForm} onSubmit={createProduct} onInvalidCapture={() => setFormError(copy.formIncomplete)} aria-busy={submitState === "loading"}>
          <fieldset className={styles.formSection}>
            <legend>{copy.basics}</legend>
            <div className={styles.twoColumns}>
              <label className={styles.field}>
                <span>{copy.title}</span>
                <input autoFocus required minLength={2} maxLength={200} value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
              </label>
              <label className={styles.field}>
                <span>{copy.category}</span>
                <input maxLength={100} value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} />
              </label>
            </div>
            <label className={styles.field}>
              <span>{copy.description}</span>
              <textarea maxLength={10000} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
            </label>
            <div className={styles.threeColumns}>
              <label className={styles.field}>
                <span>{copy.productKind}</span>
                <select value={draft.kind} onChange={(event) => changeKind(event.target.value as ProductKind)}>
                  <option value="simple">{copy.simple}</option>
                  <option value="variable">{copy.variable}</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>{copy.productType}</span>
                <select value={draft.type} onChange={(event) => updateDraft("type", event.target.value as ProductType)}>
                  <option value="digital">{copy.digital}</option>
                  <option value="physical">{copy.physical}</option>
                  <option value="service">{copy.service}</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>{copy.publishState}</span>
                <select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as ProductStatus)}>
                  <option value="draft">{copy.draft}</option>
                  <option value="active">{copy.active}</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className={styles.formSection}>
            <legend>{copy.offerDetails}</legend>
            <label className={styles.currencyField}>
              <span>{copy.currency}</span>
              <input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={draft.currency} onChange={(event) => updateDraft("currency", event.target.value.toUpperCase())} />
            </label>
            {draft.kind === "variable" ? (
              <label className={styles.field}>
                <span>{copy.optionName}</span>
                <input required maxLength={50} value={draft.optionName} onChange={(event) => updateDraft("optionName", event.target.value)} aria-describedby="option-name-hint" />
                <small id="option-name-hint">{copy.optionNameHint}</small>
              </label>
            ) : null}
          </fieldset>

          <div className={styles.offerList}>
            {draft.offers.map((offer, index) => (
              <OfferFields
                key={offer.id}
                copy={copy}
                draft={draft}
                offer={offer}
                index={index}
                canRemove={draft.kind === "variable" && draft.offers.length > 1}
                update={updateOffer}
                remove={removeVariant}
              />
            ))}
          </div>

          {draft.kind === "variable" && draft.offers.length < 100 ? (
            <button className={styles.addVariantButton} type="button" onClick={addVariant}>
              <Icon name="plus" />
              {copy.addVariant}
            </button>
          ) : null}

          <div className={styles.formMessage} aria-live="polite">
            {formError ? <p role="alert">{formError}</p> : null}
          </div>
          <footer className={styles.formActions}>
            <Link className={styles.secondaryButton} href={`/${locale}/seller-dashboard?section=products`}>
              {copy.cancel}
            </Link>
            <button className={styles.primaryButton} type="submit" disabled={submitState === "loading"} data-state={submitState}>
              {submitState === "loading" ? copy.creatingProduct : copy.createProduct}
            </button>
          </footer>
        </form>
      </main>
    </div>
  );
}

function ProductList({
  copy,
  locale,
  listings,
  state,
  error,
  emptySearch = false,
  onRetry,
  onAdd
}: {
  copy: DashboardCopy;
  locale: Locale;
  listings: SellerListing[];
  state: RequestState;
  error: string;
  emptySearch?: boolean;
  onRetry: () => void;
  onAdd: () => void;
}) {
  if (state === "loading" && listings.length === 0) {
    return (
      <div className={styles.skeleton} aria-label={copy.loading} aria-busy="true">
        <i /><i /><i />
      </div>
    );
  }
  if (state === "error" && listings.length === 0) {
    return (
      <div className={styles.notice} role="alert">
        <p>{error || copy.listError}</p>
        <button className={styles.secondaryButton} type="button" onClick={onRetry} data-state="error">{copy.retry}</button>
      </div>
    );
  }
  if (listings.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Icon name="box" />
        <h3>{emptySearch ? copy.emptySearch : copy.noProducts}</h3>
        {!emptySearch ? <p>{copy.noProductsDescription}</p> : null}
        {!emptySearch ? <button className={styles.primaryButton} type="button" onClick={onAdd}>{copy.addProduct}</button> : null}
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.productTable}>
        <thead>
          <tr>
            <th>{copy.product}</th>
            <th>{copy.productUrl}</th>
            <th>{copy.type}</th>
            <th>{copy.kind}</th>
            <th>{copy.offers}</th>
            <th>{copy.price}</th>
            <th>{copy.status}</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.id}>
              <td data-label={copy.product}>
                <strong>{listing.product.title}</strong>
                <small>{listing.product.category ?? listing.product.slug}</small>
              </td>
              <td data-label={copy.productUrl}>
                <ProductPublicUrl
                  className={styles.productUrl}
                  locale={locale}
                  slug={listing.product.slug}
                  label={`${copy.productUrl} — ${listing.product.title}`}
                />
              </td>
              <td data-label={copy.type}>{copy[listing.product.type]}</td>
              <td data-label={copy.kind}>{copy[listing.product.kind]}</td>
              <td data-label={copy.offers}>{listing.offers.length}</td>
              <td data-label={copy.price} className={styles.priceCell}>
                {listing.offers[0] ? `${listing.offers[0].price} ${listing.offers[0].currency}` : "—"}
              </td>
              <td data-label={copy.status}>
                <span className={styles.statusBadge} data-status={listing.status}>{statusLabel(listing.status, copy)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
