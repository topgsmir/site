"use client";

import axios from "axios";
import type { Route } from "next";
import Link from "next/link";
import Image from "next/image";
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
  useRef,
  useState
} from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ProductPublicUrl } from "@/components/product/ProductPublicUrl";
import { SellerBridgeWorkspace } from "@/components/bridge/SellerBridgeWorkspace";
import { SellerOrders } from "@/components/seller/SellerOrders";
import { SellerShippingProfileWorkspace } from "@/components/seller/SellerShippingProfileWorkspace";
import { SellerCoupons } from "./SellerCoupons";
import { SellerBlogPanel } from "./SellerBlogPanel";
import { DesignIcon } from "@/components/DesignIcon";
import { PRODUCT_CREATION_COPY } from "./ProductCreationCopy";
import styles from "./SellerDashboard.module.css";
import creation from "./ProductCreation.module.css";
import navigationStyles from "@/components/dashboard/DashboardNavigation.module.css";
import { AnalyticsOverview } from "@/components/analytics/AnalyticsOverview";
import { CollapsibleFilters } from "@/components/dashboard/CollapsibleFilters";
import { useNewOrderCount } from "@/components/dashboard/useNewOrderCount";
import { DashboardMobileNavigation } from "@/components/dashboard/DashboardMobileNavigation";

type DashboardSection = "overview" | "statistics" | "products" | "blog" | "coupons" | "orders" | "shipping" | "payouts" | "bridge";
type RequestState = "idle" | "loading" | "error" | "success";

const FILTER_COPY = {
  en: { filters: "Find and filter", filtersHint: "Narrow the catalog by product details or listing state.", activeFilters: "active filters", clear: "Clear filters", category: "Category", productStatus: "Product status", productType: "Product type", productKind: "Structure", listingStatus: "Listing status", allTypes: "All types", allKinds: "All structures", allListingStatuses: "All listing statuses", sort: "Sort by", updatedDesc: "Recently updated", updatedAsc: "Least recently updated", createdDesc: "Newest created", createdAsc: "Oldest created", titleAsc: "Title A–Z", titleDesc: "Title Z–A", previous: "Previous", next: "Next", page: "Page" },
  fa: { filters: "جست‌وجو و فیلتر", filtersHint: "محصولات را بر اساس مشخصات یا وضعیت فهرست محدود کنید.", activeFilters: "فیلتر فعال", clear: "پاک کردن فیلترها", category: "دسته‌بندی", productStatus: "وضعیت محصول", productType: "نوع محصول", productKind: "ساختار", listingStatus: "وضعیت فهرست", allTypes: "همه نوع‌ها", allKinds: "همه ساختارها", allListingStatuses: "همه وضعیت‌های فهرست", sort: "مرتب‌سازی", updatedDesc: "تازه‌ترین ویرایش", updatedAsc: "قدیمی‌ترین ویرایش", createdDesc: "جدیدترین ایجاد", createdAsc: "قدیمی‌ترین ایجاد", titleAsc: "عنوان از آ تا ی", titleDesc: "عنوان از ی تا آ", previous: "قبلی", next: "بعدی", page: "صفحه" },
  ar: { filters: "البحث والتصفية", filtersHint: "ضيّق قائمة المنتجات حسب التفاصيل أو حالة العرض.", activeFilters: "فلاتر نشطة", clear: "مسح الفلاتر", category: "الفئة", productStatus: "حالة المنتج", productType: "نوع المنتج", productKind: "البنية", listingStatus: "حالة العرض", allTypes: "كل الأنواع", allKinds: "كل البنى", allListingStatuses: "كل حالات العرض", sort: "ترتيب حسب", updatedDesc: "آخر تحديث", updatedAsc: "أقدم تحديث", createdDesc: "الأحدث إنشاءً", createdAsc: "الأقدم إنشاءً", titleAsc: "العنوان تصاعدياً", titleDesc: "العنوان تنازلياً", previous: "السابق", next: "التالي", page: "صفحة" }
} as const;

type SellerDashboardProps = {
  locale: Locale;
  user: Pick<AppUser, "fullName" | "email" | "permissions">;
  initialSection?: DashboardSection;
};

type SellerProductCreationProps = Omit<SellerDashboardProps, "initialSection">;

type ServiceInputDraft = {
  id: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "password";
  required: boolean;
  placeholder: string;
  helpText: string;
  minimumLength: string;
  maximumLength: string;
};

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
  serviceInputs: ServiceInputDraft[];
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
  statistics: string;
  sellService: string;
  products: string;
  blog: string;
  coupons: string;
  orders: string;
  newOrders: string;
  shipping: string;
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
  pending_review: string;
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
  bridge: string;
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
  customerQuestions: string;
  customerQuestionsHint: string;
  addQuestion: string;
  questionLabel: string;
  questionType: string;
  textAnswer: string;
  longAnswer: string;
  passwordAnswer: string;
  requiredAnswer: string;
  placeholder: string;
  helpText: string;
  minimumLength: string;
  maximumLength: string;
  removeQuestion: string;
  addVariant: string;
  removeVariant: string;
  cancel: string;
  createProduct: string;
  creatingProduct: string;
  formIncomplete: string;
  createError: string;
  sellerRole: string;
  moreAvailable: string;
  actions: string;
  editProduct: string;
  sharedProduct: string;
  sharedProductHint: string;
  editProductDescription: string;
  saveChanges: string;
  savingChanges: string;
  updateError: string;
};

const COPY: Record<Locale, DashboardCopy> = {
  en: {
    brand: "TOP GSM",
    workspace: "Seller workspace",
    overview: "Overview",
    statistics: "Statistics",
    sellService: "Sell service",
    products: "Products",
    blog: "Blog",
    coupons: "Coupons",
    orders: "Orders",
    newOrders: "new orders",
    shipping: "Shipping profile",
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
    pending_review: "Pending review",
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
    bridge: "Bridge service",
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
    fileReference: "HTTPS delivery URL",
    fileReferenceHint: "Paste the HTTPS URL from UploadCenter. Buyers receive it after verified payment.",
    maxDownloads: "Maximum downloads",
    stock: "Stock",
    weightGrams: "Weight in grams",
    serviceType: "Service type",
    estimatedHours: "Estimated hours",
    instructions: "Buyer instructions",
    customerQuestions: "Customer questions",
    customerQuestionsHint: "Ask only for the details needed to complete this service. Password answers are encrypted and never saved in the customer’s browser.",
    addQuestion: "Add question",
    questionLabel: "Question",
    questionType: "Answer type",
    textAnswer: "Short text",
    longAnswer: "Long text",
    passwordAnswer: "Password or secret",
    requiredAnswer: "Required answer",
    placeholder: "Placeholder",
    helpText: "Help text",
    minimumLength: "Minimum length",
    maximumLength: "Maximum length",
    removeQuestion: "Remove question",
    addVariant: "Add variant",
    removeVariant: "Remove variant",
    cancel: "Cancel",
    createProduct: "Create product",
    creatingProduct: "Creating…",
    formIncomplete: "Complete the required fields with valid values, then create the product.",
    createError: "The product could not be created. Review the details and try again.",
    sellerRole: "Seller account",
    moreAvailable: "More products are available",
    actions: "Actions", editProduct: "Edit", sharedProduct: "Shared catalog", sharedProductHint: "Only the seller who created this shared catalog product can edit its details.", editProductDescription: "Update the catalog details and publication state.", saveChanges: "Save changes", savingChanges: "Saving…", updateError: "The product could not be updated. Review the details and try again."
  },
  fa: {
    brand: "TOP GSM",
    workspace: "فضای کاری فروشنده",
    overview: "نمای کلی",
    statistics: "آمار",
    sellService: "خدمات فروش",
    products: "محصولات",
    blog: "وبلاگ",
    coupons: "کدهای تخفیف",
    orders: "سفارش‌ها",
    newOrders: "سفارش جدید",
    shipping: "پروفایل ارسال",
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
    pending_review: "در انتظار بررسی",
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
    bridge: "سرویس Bridge",
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
    fileReference: "لینک HTTPS تحویل فایل",
    fileReferenceHint: "لینک HTTPS آپلودسنتر را وارد کنید؛ پس از پرداخت تأییدشده به خریدار نمایش داده می‌شود.",
    maxDownloads: "حداکثر دانلود",
    stock: "موجودی",
    weightGrams: "وزن به گرم",
    serviceType: "نوع خدمت",
    estimatedHours: "زمان تخمینی به ساعت",
    instructions: "دستورالعمل خریدار",
    customerQuestions: "پرسش‌های مشتری",
    customerQuestionsHint: "فقط اطلاعات لازم برای انجام خدمت را بپرسید. پاسخ‌های رمز عبور رمزگذاری می‌شوند و در مرورگر مشتری ذخیره نمی‌شوند.",
    addQuestion: "افزودن پرسش",
    questionLabel: "پرسش",
    questionType: "نوع پاسخ",
    textAnswer: "متن کوتاه",
    longAnswer: "متن بلند",
    passwordAnswer: "رمز عبور یا اطلاعات محرمانه",
    requiredAnswer: "پاسخ اجباری",
    placeholder: "متن راهنما",
    helpText: "توضیح تکمیلی",
    minimumLength: "حداقل طول",
    maximumLength: "حداکثر طول",
    removeQuestion: "حذف پرسش",
    addVariant: "افزودن تنوع",
    removeVariant: "حذف تنوع",
    cancel: "انصراف",
    createProduct: "ساخت محصول",
    creatingProduct: "در حال ساخت…",
    formIncomplete: "فیلدهای ضروری را با مقادیر معتبر کامل کنید و دوباره محصول را بسازید.",
    createError: "محصول ساخته نشد. اطلاعات را بررسی و دوباره تلاش کنید.",
    sellerRole: "حساب فروشنده",
    moreAvailable: "محصولات بیشتری موجود است",
    actions: "عملیات", editProduct: "ویرایش", sharedProduct: "کاتالوگ مشترک", sharedProductHint: "فقط فروشنده‌ای که این محصول مشترک را ساخته است می‌تواند مشخصات آن را ویرایش کند.", editProductDescription: "مشخصات کاتالوگ و وضعیت انتشار را به‌روزرسانی کنید.", saveChanges: "ذخیره تغییرات", savingChanges: "در حال ذخیره…", updateError: "محصول به‌روزرسانی نشد. اطلاعات را بررسی و دوباره تلاش کنید."
  },
  ar: {
    brand: "TOP GSM",
    workspace: "مساحة عمل البائع",
    overview: "نظرة عامة",
    statistics: "الإحصاءات",
    sellService: "خدمات البيع",
    products: "المنتجات",
    blog: "المدونة",
    coupons: "القسائم",
    orders: "الطلبات",
    newOrders: "طلبات جديدة",
    shipping: "ملف الشحن",
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
    pending_review: "بانتظار المراجعة",
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
    bridge: "خدمة Bridge",
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
    fileReference: "رابط تسليم HTTPS",
    fileReferenceHint: "ألصق رابط HTTPS من مركز الرفع؛ يظهر للمشتري بعد تأكيد الدفع.",
    maxDownloads: "الحد الأقصى للتنزيلات",
    stock: "المخزون",
    weightGrams: "الوزن بالغرام",
    serviceType: "نوع الخدمة",
    estimatedHours: "الساعات المقدرة",
    instructions: "تعليمات المشتري",
    customerQuestions: "أسئلة العميل",
    customerQuestionsHint: "اطلب فقط المعلومات اللازمة لتنفيذ الخدمة. تُشفّر إجابات كلمات المرور ولا تُحفظ في متصفح العميل.",
    addQuestion: "إضافة سؤال",
    questionLabel: "السؤال",
    questionType: "نوع الإجابة",
    textAnswer: "نص قصير",
    longAnswer: "نص طويل",
    passwordAnswer: "كلمة مرور أو بيانات سرية",
    requiredAnswer: "إجابة مطلوبة",
    placeholder: "نص توضيحي",
    helpText: "نص مساعد",
    minimumLength: "الحد الأدنى للطول",
    maximumLength: "الحد الأقصى للطول",
    removeQuestion: "حذف السؤال",
    addVariant: "إضافة متغير",
    removeVariant: "إزالة المتغير",
    cancel: "إلغاء",
    createProduct: "إنشاء المنتج",
    creatingProduct: "جارٍ الإنشاء…",
    formIncomplete: "أكمل الحقول المطلوبة بقيم صحيحة، ثم أنشئ المنتج.",
    createError: "تعذر إنشاء المنتج. راجع التفاصيل وحاول مرة أخرى.",
    sellerRole: "حساب البائع",
    moreAvailable: "توجد منتجات إضافية",
    actions: "الإجراءات", editProduct: "تعديل", sharedProduct: "كتالوج مشترك", sharedProductHint: "يمكن فقط للبائع الذي أنشأ منتج الكتالوج المشترك تعديل تفاصيله.", editProductDescription: "حدّث تفاصيل الكتالوج وحالة النشر.", saveChanges: "حفظ التغييرات", savingChanges: "جارٍ الحفظ…", updateError: "تعذر تحديث المنتج. راجع التفاصيل وحاول مجدداً."
  }
};

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/;
const CURRENCY_PATTERN = /^(?:TOMAN|USD)$/;
const HTTPS_URL_PATTERN = /^https:\/\/\S{1,2040}$/i;

const PRODUCT_IMAGE_COPY = {
  en: { title: "Product image", hint: "WebP or SVG · up to 8 MiB", choose: "Choose image", replace: "Replace image", remove: "Remove image", error: "The product image could not be updated." },
  fa: { title: "تصویر محصول", hint: "WebP یا SVG · حداکثر ۸ مگابایت", choose: "انتخاب تصویر", replace: "تغییر تصویر", remove: "حذف تصویر", error: "به‌روزرسانی تصویر محصول انجام نشد." },
  ar: { title: "صورة المنتج", hint: "WebP أو SVG · حتى 8 ميغابايت", choose: "اختيار صورة", replace: "تغيير الصورة", remove: "حذف الصورة", error: "تعذر تحديث صورة المنتج." }
} as const;

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
    instructions: "",
    serviceInputs: []
  };
}

function makeDraft(physicalGranted: boolean): ProductDraft {
  return {
    title: "",
    category: "",
    description: "",
    kind: "simple",
    type: physicalGranted ? "physical" : "digital",
    status: "draft",
    currency: "TOMAN",
    optionName: "",
    offers: [makeOffer("variant-1")]
  };
}

function Icon({ name }: { name: DashboardSection | "plus" | "search" | "close" | "box" }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    statistics: <><path d="M4 20V11M10 20V5M16 20v-8M22 20V8"/><path d="M2 20h20"/></>,
    products: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></>,
    blog: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    coupons: <><path d="M4 7a3 3 0 0 0 3-3h13v6a2 2 0 0 0 0 4v6H7a3 3 0 0 0-3-3z"/><path d="M12 7v2M12 11v2M12 15v2"/></>,
    orders: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></>,
    shipping: <><path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    payouts: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/></>,
    bridge: <><path d="M8 7H6a4 4 0 0 0 0 8h2M16 7h2a4 4 0 0 1 0 8h-2"/><path d="M8 12h8"/></>,
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
    if (draft.currency === "TOMAN" && !/^\d+$/.test(offer.price.trim())) return false;
    if (draft.kind === "variable" && !offer.optionValue.trim()) return false;
    if (draft.type === "digital") {
      return HTTPS_URL_PATTERN.test(offer.fileReference.trim()) && Number.isInteger(Number(offer.maxDownloads)) && Number(offer.maxDownloads) >= 0;
    }
    if (draft.type === "physical") {
      return Number.isInteger(Number(offer.stock)) && Number(offer.stock) >= 0 && Number.isInteger(Number(offer.weightGrams)) && Number(offer.weightGrams) >= 0;
    }
    if (!offer.serviceType.trim() || !Number.isInteger(Number(offer.estimatedHours)) || Number(offer.estimatedHours) < 1) return false;
    const keys = new Set<string>();
    return offer.serviceInputs.every((field) => {
      const minimumLength = Number(field.minimumLength || 0);
      const maximumLength = Number(field.maximumLength || 2000);
      if (!field.label.trim() || keys.has(field.key)) return false;
      keys.add(field.key);
      return Number.isInteger(minimumLength) && Number.isInteger(maximumLength) && minimumLength >= 0 && maximumLength >= 1 && minimumLength <= maximumLength && maximumLength <= 2000;
    });
  });
}

function buildOffer(draft: ProductDraft, offer: OfferDraft) {
  const shared = {
    price: offer.price.trim(),
    currency: draft.currency.trim().toUpperCase(),
    // Product visibility gates the whole listing. Keep its offers ready so a
    // draft can be published later without leaving an active product hidden.
    status: "active" as const,
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
      ...(offer.instructions.trim() ? { instructions: offer.instructions.trim() } : {}),
      inputs: offer.serviceInputs.map((field) => ({
        key: field.key,
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        minimumLength: Number(field.minimumLength || 0),
        maximumLength: Number(field.maximumLength || 2000),
        ...(field.placeholder.trim() ? { placeholder: field.placeholder.trim() } : {}),
        ...(field.helpText.trim() ? { helpText: field.helpText.trim() } : {})
      }))
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
  remove,
  addServiceInput,
  updateServiceInput,
  removeServiceInput
}: {
  copy: DashboardCopy;
  draft: ProductDraft;
  offer: OfferDraft;
  index: number;
  canRemove: boolean;
  update: (id: string, key: Exclude<keyof OfferDraft, "serviceInputs">, value: string) => void;
  remove: (id: string) => void;
  addServiceInput: (offerId: string) => void;
  updateServiceInput: <K extends keyof ServiceInputDraft>(offerId: string, inputId: string, key: K, value: ServiceInputDraft[K]) => void;
  removeServiceInput: (offerId: string, inputId: string) => void;
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
          <input required inputMode="decimal" pattern={draft.currency === "TOMAN" ? "(?:0|[1-9][0-9]{0,15})" : "(?:0|[1-9][0-9]{0,15})(?:\\.[0-9]{1,4})?"} value={offer.price} onChange={(event) => update(offer.id, "price", event.target.value)} />
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
          <input required type="url" maxLength={2048} value={offer.fileReference} onChange={(event) => update(offer.id, "fileReference", event.target.value)} aria-describedby={`${offer.id}-file-hint`} />
          <small id={`${offer.id}-file-hint`}>{copy.fileReferenceHint}</small>
        </label>
      ) : null}
      {draft.type === "service" ? (
        <>
          <label className={styles.field}>
            <span>{copy.instructions}</span>
            <textarea maxLength={5000} value={offer.instructions} onChange={(event) => update(offer.id, "instructions", event.target.value)} />
          </label>
          <section className={creation.questionBuilder} aria-label={copy.customerQuestions}>
            <header><div><h3>{copy.customerQuestions}</h3><p>{copy.customerQuestionsHint}</p></div>{offer.serviceInputs.length < 10 ? <button type="button" onClick={() => addServiceInput(offer.id)}><Icon name="plus" />{copy.addQuestion}</button> : null}</header>
            {offer.serviceInputs.map((field) => <fieldset key={field.id} className={creation.questionCard}>
              <div className={creation.questionGrid}>
                <label className={styles.field}><span>{copy.questionLabel}</span><input required maxLength={120} value={field.label} onChange={(event) => updateServiceInput(offer.id, field.id, "label", event.target.value)} /></label>
                <label className={styles.field}><span>{copy.questionType}</span><select value={field.type} onChange={(event) => updateServiceInput(offer.id, field.id, "type", event.target.value as ServiceInputDraft["type"])}><option value="text">{copy.textAnswer}</option><option value="textarea">{copy.longAnswer}</option><option value="password">{copy.passwordAnswer}</option></select></label>
                <label className={styles.field}><span>{copy.placeholder}</span><input maxLength={160} value={field.placeholder} onChange={(event) => updateServiceInput(offer.id, field.id, "placeholder", event.target.value)} /></label>
                <label className={styles.field}><span>{copy.helpText}</span><input maxLength={300} value={field.helpText} onChange={(event) => updateServiceInput(offer.id, field.id, "helpText", event.target.value)} /></label>
                <label className={styles.field}><span>{copy.minimumLength}</span><input required type="number" min="0" max="2000" step="1" value={field.minimumLength} onChange={(event) => updateServiceInput(offer.id, field.id, "minimumLength", event.target.value)} /></label>
                <label className={styles.field}><span>{copy.maximumLength}</span><input required type="number" min="1" max="2000" step="1" value={field.maximumLength} onChange={(event) => updateServiceInput(offer.id, field.id, "maximumLength", event.target.value)} /></label>
              </div>
              <footer><label className={creation.requiredToggle}><input type="checkbox" checked={field.required} onChange={(event) => updateServiceInput(offer.id, field.id, "required", event.target.checked)} /><span>{copy.requiredAnswer}</span></label><button type="button" onClick={() => removeServiceInput(offer.id, field.id)}>{copy.removeQuestion}</button></footer>
            </fieldset>)}
          </section>
        </>
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
  const imageCopy = PRODUCT_IMAGE_COPY[locale];
  const [section, setSection] = useState<DashboardSection>(initialSection);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageCursors, setPageCursors] = useState<Array<string | null>>([null]);
  const [listPage, setListPage] = useState(0);
  const [listState, setListState] = useState<RequestState>("loading");
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [debouncedCategory, setDebouncedCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ProductType | "all">("all");
  const [kindFilter, setKindFilter] = useState<ProductKind | "all">("all");
  const [listingStatusFilter, setListingStatusFilter] = useState<"all" | "draft" | "active" | "archived">("all");
  const [sort, setSort] = useState("updated_desc");
  const [editingProduct, setEditingProduct] = useState<SellerListing | null>(null);
  const [editDraft, setEditDraft] = useState({ title: "", category: "", description: "", status: "draft" as ProductStatus });
  const [editState, setEditState] = useState<RequestState>("idle");
  const [editError, setEditError] = useState("");
  const [sellServiceOpen, setSellServiceOpen] = useState(false);
  const productEditorRef = useRef<HTMLElement>(null);
  const listRequestId = useRef(0);
  const hasAnalytics = Boolean(user.permissions?.includes("analytics_view"));
  const canManageOrders = Boolean(user.permissions?.includes("orders_manage"));
  const { count: newOrderCount, refresh: refreshNewOrderCount } = useNewOrderCount(canManageOrders);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setDebouncedCategory(categoryFilter.trim()); }, 300);
    return () => window.clearTimeout(timer);
  }, [search, categoryFilter]);

  const loadListings = useCallback(async (cursor: string | null = null, page = 0) => {
    const requestId = ++listRequestId.current;
    setListState("loading");
    setListError("");
    try {
      const response = await api.get<SellerListingsPage>("/products/mine", {
        params: { limit: 20, ...(cursor ? { cursor } : {}),
          ...(section === "products" && debouncedSearch ? { search: debouncedSearch } : {}),
          ...(section === "products" && debouncedCategory ? { category: debouncedCategory } : {}),
          ...(section === "products" && statusFilter !== "all" ? { status: statusFilter } : {}),
          ...(section === "products" && typeFilter !== "all" ? { type: typeFilter } : {}),
          ...(section === "products" && kindFilter !== "all" ? { kind: kindFilter } : {}),
          ...(section === "products" && listingStatusFilter !== "all" ? { listingStatus: listingStatusFilter } : {}),
          ...(section === "products" ? { sort } : {}) }
      });
      if (requestId !== listRequestId.current) return;
      setListings(response.data.items);
      setNextCursor(response.data.nextCursor);
      setListPage(page);
      setPageCursors((current) => page === 0 ? [null] : current.slice(0, page + 1));
      setListState("success");
    } catch (error) {
      if (requestId !== listRequestId.current) return;
      setListError(requestError(error, copy.listError));
      setListState("error");
    }
  }, [copy.listError, section, debouncedSearch, debouncedCategory, statusFilter, typeFilter, kindFilter, listingStatusFilter, sort]);

  useEffect(() => {
    if (section === "overview" && hasAnalytics) return;
    if (section !== "overview" && section !== "products") return;
    const loadFrame = window.requestAnimationFrame(() => void loadListings());
    return () => window.cancelAnimationFrame(loadFrame);
  }, [hasAnalytics, loadListings, section]);

  useEffect(() => {
    if (!editingProduct) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); setEditingProduct(null); return;
      }
      if (event.key !== "Tab" || !productEditorRef.current) return;
      const focusable = Array.from(productEditorRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]'
      ));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [editingProduct]);

  const activeListings = listings.filter((listing) => listing.status === "active").length;
  const offersShown = listings.reduce((total, listing) => total + listing.offers.length, 0);
  const activeProductFilterCount = [search.trim(), categoryFilter.trim(), statusFilter !== "all", typeFilter !== "all", kindFilter !== "all", listingStatusFilter !== "all", sort !== "updated_desc"].filter(Boolean).length;

  function clearProductFilters() {
    setSearch("");
    setCategoryFilter("");
    setStatusFilter("all");
    setTypeFilter("all");
    setKindFilter("all");
    setListingStatusFilter("all");
    setSort("updated_desc");
  }

  function selectSection(next: DashboardSection) {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("section");
    else url.searchParams.set("section", next);
    window.history.replaceState(window.history.state, "", url);
    document.querySelector("main")?.focus({ preventScroll: true });
  }

  function openProductPage() {
    router.push(`/${locale}/seller-dashboard/products/new` as Route);
  }

  function openProductEditor(listing: SellerListing) {
    setEditingProduct(listing);
    setEditDraft({
      title: listing.product.title,
      category: listing.product.category ?? "",
      description: listing.product.description ?? "",
      status: listing.product.status
    });
    setEditState("idle"); setEditError("");
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct || editDraft.title.trim().length < 2) return;
    setEditState("loading"); setEditError("");
    try {
      const response = await api.patch<SellerListing>(`/products/${editingProduct.product.id}`, {
        title: editDraft.title.trim(),
        category: editDraft.category.trim() || null,
        description: editDraft.description.trim() || null,
        status: editDraft.status
      });
      setListings((current) => current.map((listing) => listing.id === response.data.id ? response.data : listing));
      setEditState("success"); setEditingProduct(null);
    } catch (error) {
      setEditState("error"); setEditError(requestError(error, copy.updateError));
    }
  }

  async function uploadProductImage(file: File) {
    if (!editingProduct || editState === "loading") return;
    const body = new FormData();
    body.append("file", file);
    setEditState("loading"); setEditError("");
    try {
      const response = await api.post<NonNullable<SellerListing["product"]["image"]>>(`/products/${editingProduct.product.id}/image`, body);
      const update = (listing: SellerListing): SellerListing => listing.product.id === editingProduct.product.id
        ? { ...listing, product: { ...listing.product, image: response.data } }
        : listing;
      setListings((current) => current.map(update));
      setEditingProduct((current) => current ? update(current) : current);
      setEditState("success");
    } catch (error) {
      setEditState("error"); setEditError(requestError(error, imageCopy.error));
    }
  }

  async function removeProductImage() {
    if (!editingProduct?.product.image || editState === "loading") return;
    setEditState("loading"); setEditError("");
    try {
      await api.delete(`/products/${editingProduct.product.id}/image`);
      const update = (listing: SellerListing): SellerListing => listing.product.id === editingProduct.product.id
        ? { ...listing, product: { ...listing.product, image: null } }
        : listing;
      setListings((current) => current.map(update));
      setEditingProduct((current) => current ? update(current) : current);
      setEditState("success");
    } catch (error) {
      setEditState("error"); setEditError(requestError(error, imageCopy.error));
    }
  }

  const sellServiceNavigation: Array<{ id: DashboardSection; label: string }> = [
    { id: "products", label: copy.products },
    ...(user.permissions?.includes("coupons_manage")
      ? [{ id: "coupons" as const, label: copy.coupons }]
      : []),
    ...(canManageOrders
      ? [{ id: "orders" as const, label: copy.orders }]
      : []),
    ...(user.permissions?.includes("physical_products_manage")
      ? [{ id: "shipping" as const, label: copy.shipping }]
      : []),
    ...(process.env.NEXT_PUBLIC_BRIDGE_FEATURE_ENABLED === "true"
      ? [{ id: "bridge" as const, label: copy.bridge }]
      : [])
  ];
  const secondaryNavigation: Array<{ id: DashboardSection; label: string }> = [
    ...(user.permissions?.includes("blog_manage")
      ? [{ id: "blog" as const, label: copy.blog }]
      : []),
    { id: "payouts", label: copy.payouts }
  ];
  const isSellServiceSection = sellServiceNavigation.some((item) => item.id === section);
  const sellServiceExpanded = isSellServiceSection || sellServiceOpen;

  return (
    <div className={styles.shell}>
      <DashboardMobileNavigation locale={locale} title={copy.workspace} currentLabel={copy[section]} shortcuts={[
        { label: copy.overview, icon: <Icon name="overview" />, active: section === "overview", onClick: () => selectSection("overview") },
        ...(canManageOrders ? [{ label: copy.orders, icon: <Icon name="orders" />, active: section === "orders", count: newOrderCount, onClick: () => selectSection("orders") }] : []),
        { label: copy.products, icon: <Icon name="products" />, active: section === "products", onClick: () => selectSection("products") }
      ]}>
      <aside className={styles.rail} data-navigation-surface data-mobile-open={true}>
        <div className={styles.brandBlock}>
          <span className={styles.brandIdentity}>
            <strong dir="ltr" translate="no">topgsm.</strong>
            <span>{copy.workspace}</span>
          </span>
        </div>
        <nav id="seller-panel-navigation" className={navigationStyles.navigation} aria-label={copy.workspace} data-mobile-open={true}>
          <button
            className={navigationStyles.item}
            type="button"
            aria-current={section === "overview" ? "page" : undefined}
            onClick={() => selectSection("overview")}
            data-state="default"
          >
            <Icon name="overview" />
            <span>{copy.overview}</span>
          </button>
          {hasAnalytics ? <button className={navigationStyles.item} type="button" aria-current={section === "statistics" ? "page" : undefined} onClick={() => selectSection("statistics")} data-state="default">
            <Icon name="statistics" />
            <span>{copy.statistics}</span>
          </button> : null}
          <div
            className={navigationStyles.group}
            data-active={isSellServiceSection}
            data-open={sellServiceExpanded}
          >
            <button
              className={navigationStyles.groupTrigger}
              type="button"
              aria-expanded={sellServiceExpanded}
              aria-controls="sell-service-navigation"
              onClick={() => setSellServiceOpen((current) => !current)}
            >
              <Icon name="products" />
              <span>{copy.sellService}</span>
              <span className={navigationStyles.chevron} aria-hidden="true">⌄</span>
            </button>
            <div className={navigationStyles.subNavigation} id="sell-service-navigation">
              {sellServiceNavigation.map((item) => (
                <button
                  className={navigationStyles.item}
                  type="button"
                  key={item.id}
                  aria-current={section === item.id ? "page" : undefined}
                  onClick={() => selectSection(item.id)}
                  data-state="default"
                >
                  <Icon name={item.id} />
                  <span>{item.label}</span>
                  {item.id === "orders" ? (
                    <strong
                      className={navigationStyles.count}
                      aria-label={`${newOrderCount.toLocaleString(locale)} ${copy.newOrders}`}
                      title={`${newOrderCount.toLocaleString(locale)} ${copy.newOrders}`}
                    >
                      {newOrderCount.toLocaleString(locale)}
                    </strong>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          {secondaryNavigation.map((item) => (
            <button
              className={navigationStyles.item}
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
          <Link className={navigationStyles.item} href={`/${locale}/seller-dashboard/comments` as Route}>
            <Icon name="blog" />
            <span>{locale === "fa" ? "دیدگاه‌ها" : locale === "ar" ? "التعليقات" : "Comments"}</span>
          </Link>
        </nav>
        <div className={styles.accountBlock} data-mobile-open={true}>
          <span>{copy.account}</span>
          <strong>{user.fullName}</strong>
          <small>{user.email}</small>
          <small>{copy.sellerRole}</small>
          <LogoutButton locale={locale} />
        </div>
      </aside>
      </DashboardMobileNavigation>

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
            hasAnalytics ? <AnalyticsOverview locale={locale} audience="seller" compact /> : <section aria-labelledby="catalog-snapshot-title">
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
                  onEdit={openProductEditor}
                />
              </div>
            </section>
          ) : null}

          {section === "statistics" && hasAnalytics ? <AnalyticsOverview locale={locale} audience="seller" /> : null}

          {section === "products" ? (
            <section aria-labelledby="products-title">
              <div className={styles.introRow}>
                <div>
                  <h2 id="products-title" className={styles.sectionTitle}>{copy.products}</h2>
                  <p>{copy.productsDescription}</p>
                </div>
              </div>
              <CollapsibleFilters className={styles.filterPanel} locale={locale} title={FILTER_COPY[locale].filters} description={FILTER_COPY[locale].filtersHint} activeCount={activeProductFilterCount}>
                {activeProductFilterCount > 0 ? <div className={styles.filterActions}><button type="button" onClick={clearProductFilters}><Icon name="close" />{FILTER_COPY[locale].clear}</button></div> : null}
                <div className={styles.filters}>
                  <label className={`${styles.filterControl} ${styles.searchControl}`}><span>{copy.searchProducts}</span><span className={styles.searchField}><Icon name="search" /><input type="search" value={search} placeholder={copy.searchProducts} onChange={(event) => setSearch(event.target.value)} /></span></label>
                  <label className={styles.filterControl}><span>{FILTER_COPY[locale].category}</span><span className={styles.filterField}><input value={categoryFilter} maxLength={100} placeholder={FILTER_COPY[locale].category} onChange={(event) => setCategoryFilter(event.target.value)} /></span></label>
                  <label className={styles.filterControl}><span>{FILTER_COPY[locale].productStatus}</span><span className={styles.filterField}><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ProductStatus | "all")}><option value="all">{copy.allStatuses}</option><option value="draft">{copy.draft}</option><option value="pending_review">{copy.pending_review}</option><option value="active">{copy.active}</option><option value="archived">{copy.archived}</option></select></span></label>
                  <label className={styles.filterControl}><span>{FILTER_COPY[locale].productType}</span><span className={styles.filterField}><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as ProductType | "all")}><option value="all">{FILTER_COPY[locale].allTypes}</option><option value="digital">{copy.digital}</option><option value="physical">{copy.physical}</option><option value="service">{copy.service}</option><option value="bridge">{copy.bridge}</option></select></span></label>
                  <label className={styles.filterControl}><span>{FILTER_COPY[locale].productKind}</span><span className={styles.filterField}><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as ProductKind | "all")}><option value="all">{FILTER_COPY[locale].allKinds}</option><option value="simple">{copy.simple}</option><option value="variable">{copy.variable}</option></select></span></label>
                  <label className={styles.filterControl}><span>{FILTER_COPY[locale].listingStatus}</span><span className={styles.filterField}><select value={listingStatusFilter} onChange={(event) => setListingStatusFilter(event.target.value as typeof listingStatusFilter)}><option value="all">{FILTER_COPY[locale].allListingStatuses}</option><option value="draft">{copy.draft}</option><option value="active">{copy.active}</option><option value="archived">{copy.archived}</option></select></span></label>
                  <label className={styles.filterControl}><span>{FILTER_COPY[locale].sort}</span><span className={styles.filterField}><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated_desc">{FILTER_COPY[locale].updatedDesc}</option><option value="updated_asc">{FILTER_COPY[locale].updatedAsc}</option><option value="created_desc">{FILTER_COPY[locale].createdDesc}</option><option value="created_asc">{FILTER_COPY[locale].createdAsc}</option><option value="title_asc">{FILTER_COPY[locale].titleAsc}</option><option value="title_desc">{FILTER_COPY[locale].titleDesc}</option></select></span></label>
                </div>
              </CollapsibleFilters>
              <ProductList
                copy={copy}
                locale={locale}
                listings={listings}
                state={listState}
                error={listError}
                emptySearch={Boolean(search.trim() || categoryFilter.trim()) || statusFilter !== "all" || typeFilter !== "all" || kindFilter !== "all" || listingStatusFilter !== "all"}
                onRetry={() => void loadListings()}
                onAdd={openProductPage}
                onEdit={openProductEditor}
              />
              <nav className={styles.productPagination} aria-label={copy.products}>
                <button className={styles.loadMoreButton} type="button" disabled={listState === "loading" || listPage === 0} onClick={() => void loadListings(pageCursors[listPage - 1], listPage - 1)}>{FILTER_COPY[locale].previous}</button>
                <span aria-live="polite">{FILTER_COPY[locale].page} {listPage + 1}</span>
                <button className={styles.loadMoreButton} type="button" disabled={listState === "loading" || !nextCursor} onClick={() => { if (!nextCursor) return; setPageCursors((current) => [...current.slice(0, listPage + 1), nextCursor]); void loadListings(nextCursor, listPage + 1); }}>{FILTER_COPY[locale].next}</button>
              </nav>
            </section>
          ) : null}

          {section === "coupons" ? <SellerCoupons locale={locale} /> : null}

          {section === "blog" ? <SellerBlogPanel locale={locale} /> : null}

          {section === "bridge" ? <SellerBridgeWorkspace locale={locale} /> : null}

          {section === "orders" ? <SellerOrders locale={locale} onOrderUpdated={refreshNewOrderCount} /> : null}

          {section === "shipping" ? <SellerShippingProfileWorkspace locale={locale} /> : null}

          {section === "payouts" ? (
            <section className={styles.unavailable} aria-labelledby="unavailable-title">
              <Icon name={section} />
              <h2 id="unavailable-title">{copy.sectionUnavailable}</h2>
              <p>{copy.payoutsUnavailable}</p>
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

      {editingProduct ? (
        <div className={styles.editorLayer} role="presentation">
          <button className={styles.editorScrim} type="button" aria-label={copy.cancel} onClick={() => setEditingProduct(null)} />
          <section ref={productEditorRef} className={styles.productEditor} role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
            <header><div><h2 id="product-editor-title">{copy.editProduct}</h2><p>{copy.editProductDescription}</p></div><button className={styles.textButton} type="button" onClick={() => setEditingProduct(null)}>{copy.cancel}</button></header>
            <form onSubmit={updateProduct} aria-busy={editState === "loading"}>
              <section className={styles.productImageEditor}>
                <div>
                  {editingProduct.product.image ? (() => {
                    const variant = editingProduct.product.image.variants.find((item) => item.name === "thumb") ?? editingProduct.product.image.variants[0];
                    return variant ? <Image unoptimized src={variant.url} alt={editingProduct.product.title} width={variant.width} height={variant.height} /> : null;
                  })() : <span aria-hidden="true">＋</span>}
                </div>
                <p><strong>{imageCopy.title}</strong><small>{imageCopy.hint}</small></p>
                <label className={styles.secondaryButton}>{editingProduct.product.image ? imageCopy.replace : imageCopy.choose}<input type="file" accept="image/webp,image/svg+xml" disabled={editState === "loading"} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadProductImage(file); event.currentTarget.value = ""; }} /></label>
                {editingProduct.product.image ? <button className={styles.textButton} type="button" disabled={editState === "loading"} onClick={() => void removeProductImage()}>{imageCopy.remove}</button> : null}
              </section>
              <label className={styles.field}><span>{copy.title}</span><input autoFocus required minLength={2} maxLength={200} value={editDraft.title} onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} /></label>
              <label className={styles.field}><span>{copy.category}</span><input maxLength={100} value={editDraft.category} onChange={(event) => setEditDraft((current) => ({ ...current, category: event.target.value }))} /></label>
              <label className={styles.field}><span>{copy.description}</span><textarea maxLength={10000} value={editDraft.description} onChange={(event) => setEditDraft((current) => ({ ...current, description: event.target.value }))} /></label>
              <label className={styles.field}><span>{copy.publishState}</span><select value={editDraft.status} onChange={(event) => setEditDraft((current) => ({ ...current, status: event.target.value as ProductStatus }))}><option value="draft">{copy.draft}</option><option value="active">{copy.active}</option><option value="pending_review">{copy.pending_review}</option><option value="archived">{copy.archived}</option></select></label>
              {editError ? <p className={styles.inlineError} role="alert">{editError}</p> : null}
              <footer><button className={styles.secondaryButton} type="button" onClick={() => setEditingProduct(null)}>{copy.cancel}</button><button className={styles.primaryButton} type="submit" disabled={editState === "loading"}>{editState === "loading" ? copy.savingChanges : copy.saveChanges}</button></footer>
            </form>
          </section>
        </div>
      ) : null}

    </div>
  );
}

export function SellerProductCreation({ locale, user }: SellerProductCreationProps) {
  const router = useRouter();
  const copy = COPY[locale];
  const formCopy = PRODUCT_CREATION_COPY[locale];
  const imageCopy = PRODUCT_IMAGE_COPY[locale];
  const physicalGranted = Boolean(user.permissions?.includes("physical_products_manage"));
  const [draft, setDraft] = useState<ProductDraft>(() => makeDraft(physicalGranted));
  const [submitState, setSubmitState] = useState<RequestState>("idle");
  const [formError, setFormError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const nextVariantNumber = useRef(2);

  useEffect(() => {
    if (!imageFile) { setImagePreview(null); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function selectImage(file: File | undefined) {
    if (!file) return;
    if (!(["image/webp", "image/svg+xml"].includes(file.type)) || file.size > 8 * 1024 * 1024) {
      setFormError(formCopy.imageInvalid);
      return;
    }
    setImageFile(file);
    setFormError("");
  }

  function updateDraft<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (formError) setFormError("");
  }

  function changeKind(kind: ProductKind) {
    if (kind === draft.kind) return;
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

  function updateOffer(id: string, key: Exclude<keyof OfferDraft, "serviceInputs">, value: string) {
    setDraft((current) => ({
      ...current,
      offers: current.offers.map((offer) => offer.id === id ? { ...offer, [key]: value } : offer)
    }));
    if (formError) setFormError("");
  }

  function addServiceInput(offerId: string) {
    setDraft((current) => ({
      ...current,
      offers: current.offers.map((offer) => {
        if (offer.id !== offerId || offer.serviceInputs.length >= 10) return offer;
        const token = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
        return {
          ...offer,
          serviceInputs: [...offer.serviceInputs, {
            id: `question-${token}`,
            key: `field_${token}`,
            label: "",
            type: "text",
            required: true,
            placeholder: "",
            helpText: "",
            minimumLength: "0",
            maximumLength: "2000"
          }]
        };
      })
    }));
    if (formError) setFormError("");
  }

  function updateServiceInput<K extends keyof ServiceInputDraft>(
    offerId: string,
    inputId: string,
    key: K,
    value: ServiceInputDraft[K]
  ) {
    setDraft((current) => ({
      ...current,
      offers: current.offers.map((offer) => offer.id === offerId
        ? { ...offer, serviceInputs: offer.serviceInputs.map((field) => field.id === inputId ? { ...field, [key]: value } : field) }
        : offer)
    }));
    if (formError) setFormError("");
  }

  function removeServiceInput(offerId: string, inputId: string) {
    setDraft((current) => ({
      ...current,
      offers: current.offers.map((offer) => offer.id === offerId
        ? { ...offer, serviceInputs: offer.serviceInputs.filter((field) => field.id !== inputId) }
        : offer)
    }));
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
    if (!createdProductId && !validateDraft(draft)) {
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

    let productId = createdProductId;
    try {
      if (!productId) {
        const response = await api.post<SellerListing>("/products", payload);
        productId = response.data.product.id;
        setCreatedProductId(productId);
      }
      if (imageFile) {
        const body = new FormData();
        body.append("file", imageFile);
        await api.post(`/products/${productId}/image`, body);
      }
      setSubmitState("success");
      router.replace(`/${locale}/seller-dashboard?section=products`);
    } catch (error) {
      setFormError(requestError(error, productId ? formCopy.imageUploadError : copy.createError));
      setSubmitState("error");
    }
  }

  const productTypes: Array<"digital" | "physical" | "service"> = physicalGranted ? ["digital", "physical", "service"] : ["digital", "service"];
  const productIcons = { digital: "file", physical: "layers", service: "headphones" } as const;
  const priceValues = draft.offers.map((offer) => Number(offer.price)).filter((price, index) => draft.offers[index].price.trim() && Number.isFinite(price));
  const startingPrice = priceValues.length ? formatCurrencyAmount(Math.min(...priceValues), draft.currency, locale) : null;

  return (
    <div className={creation.shell} dir={locale === "en" ? "ltr" : "rtl"}>
      <header className={creation.topbar}>
        <Link className={creation.backLink} href={`/${locale}/seller-dashboard?section=products`}><DesignIcon name="arrow" />{copy.products}</Link>
        <Link className={creation.brand} href={`/${locale}/seller-dashboard`}><DesignIcon name="layers" /><strong dir="ltr" translate="no">topgsm.</strong></Link>
        <span className={creation.account}>{user.fullName}</span>
      </header>
      <main className={creation.main}>
        <header className={creation.heading}><div><h1>{copy.newProduct}</h1><p>{formCopy.intro}</p></div><span className={creation.draftBadge}>{copy[draft.status]}</span></header>
        <form className={creation.layout} onSubmit={createProduct} onInvalidCapture={() => setFormError(copy.formIncomplete)} aria-busy={submitState === "loading"}>
          <div className={creation.formBody}>
            <section className={creation.card} aria-labelledby="product-basics">
              <header className={creation.sectionHeading}><span><DesignIcon name="file" /></span><div><h2 id="product-basics">{formCopy.details}</h2><p>{formCopy.detailsHint}</p></div></header>
              <label className={`${styles.field} ${creation.titleField}`}><span>{copy.title}</span><input required minLength={2} maxLength={200} placeholder={formCopy.titlePlaceholder} value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
              <label className={styles.field}><span>{copy.description}<small>{formCopy.optional}</small></span><textarea maxLength={10000} placeholder={formCopy.descriptionPlaceholder} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} /></label>
              <label className={styles.field}><span>{copy.category}<small>{formCopy.optional}</small></span><input maxLength={100} value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} /></label>
              <div className={creation.imageField}>
                <div className={creation.imagePreview}>{imagePreview ? <Image unoptimized src={imagePreview} alt="" width={120} height={120} /> : <DesignIcon name="layers" />}</div>
                <div><strong>{imageCopy.title}</strong><small>{imageCopy.hint}</small><label className={creation.imagePicker}>{imageFile ? imageCopy.replace : imageCopy.choose}<input type="file" accept="image/webp,image/svg+xml" disabled={submitState === "loading"} onChange={(event) => { selectImage(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{imageFile ? <button className={creation.imageRemove} type="button" disabled={submitState === "loading"} onClick={() => setImageFile(null)}>{imageCopy.remove}</button> : null}</div>
              </div>
            </section>
            <fieldset className={creation.deliveryCard}>
              <legend>{formCopy.delivery}</legend>
              <div className={creation.typeOptions}>{productTypes.map((type) => <label key={type} className={creation.typeOption} data-selected={draft.type === type}><input type="radio" name="product-type" value={type} checked={draft.type === type} onChange={() => updateDraft("type", type)} /><DesignIcon name={productIcons[type]} /><strong>{copy[type]}</strong><span>{formCopy[type]}</span><i aria-hidden="true">{draft.type === type ? <DesignIcon name="check" /> : null}</i></label>)}</div>
            </fieldset>
            <section className={creation.card} aria-labelledby="product-pricing">
              <header className={creation.sectionHeading}><span><DesignIcon name="layers" /></span><div><h2 id="product-pricing">{formCopy.configuration}</h2><p>{formCopy.configurationHint}</p></div></header>
              <div className={creation.kindOptions} role="group" aria-label={copy.productKind}>{(["simple", "variable"] as const).map((kind) => <button key={kind} type="button" aria-pressed={draft.kind === kind} onClick={() => changeKind(kind)}><strong>{copy[kind]}</strong><span>{formCopy[kind]}</span></button>)}</div>
              <div className={creation.pricingSettings}>
                <label className={styles.currencyField}><span>{copy.currency}</span><select required value={draft.currency} onChange={(event) => updateDraft("currency", event.target.value)}><option value="USD">USD</option><option value="TOMAN">تومان</option></select></label>
                {draft.kind === "variable" ? <label className={styles.field}><span>{copy.optionName}</span><input required maxLength={50} value={draft.optionName} onChange={(event) => updateDraft("optionName", event.target.value)} aria-describedby="option-name-hint" /><small id="option-name-hint">{copy.optionNameHint}</small></label> : null}
              </div>
              <div className={creation.offers}>{draft.offers.map((offer, index) => <OfferFields key={offer.id} copy={copy} draft={draft} offer={offer} index={index} canRemove={draft.kind === "variable" && draft.offers.length > 1} update={updateOffer} remove={removeVariant} addServiceInput={addServiceInput} updateServiceInput={updateServiceInput} removeServiceInput={removeServiceInput} />)}</div>
              {draft.kind === "variable" && draft.offers.length < 100 ? <button className={styles.addVariantButton} type="button" onClick={addVariant}><Icon name="plus" />{copy.addVariant}</button> : null}
            </section>
          </div>
          <aside className={creation.sidebar}>
            <section className={creation.preview} aria-labelledby="product-preview"><span className={creation.eyebrow} id="product-preview">{formCopy.preview}</span><div className={creation.previewIcon}><DesignIcon name={productIcons[draft.type as keyof typeof productIcons] ?? "layers"} /></div><span className={creation.previewCategory}>{draft.category.trim() || formCopy.noCategory}</span><h2>{draft.title.trim() || formCopy.untitled}</h2><p>{copy[draft.type]}<span>·</span>{copy[draft.kind]}</p><div className={creation.previewPrice}>{startingPrice ? <><small>{draft.kind === "variable" ? formCopy.from : copy.price}</small><strong>{startingPrice}<span>{currencyLabel(draft.currency)}</span></strong></> : <span>{formCopy.pricePending}</span>}</div></section>
            <section className={creation.publish}><h2>{formCopy.summary}</h2><p>{formCopy.summaryHint}</p><label className={styles.field}><span>{copy.publishState}</span><select value={draft.status} disabled={Boolean(createdProductId)} onChange={(event) => updateDraft("status", event.target.value as ProductStatus)}><option value="draft">{copy.draft}</option><option value="active">{copy.active}</option></select></label><p className={creation.statusHint}>{draft.status === "draft" ? formCopy.draftHint : formCopy.activeHint}</p><div className={creation.readiness} data-ready={validateDraft(draft)}><DesignIcon name="check" /><span>{validateDraft(draft) ? formCopy.ready : formCopy.incomplete}</span></div><div aria-live="polite">{formError ? <p className={creation.error} role="alert">{formError}</p> : null}</div><button className={styles.primaryButton} type="submit" disabled={submitState === "loading"} data-state={submitState}>{submitState === "loading" ? copy.creatingProduct : createdProductId ? formCopy.retryImage : copy.createProduct}<DesignIcon name="arrow" /></button><Link className={creation.cancel} href={`/${locale}/seller-dashboard?section=products`}>{copy.cancel}</Link></section>
          </aside>
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
  onAdd,
  onEdit
}: {
  copy: DashboardCopy;
  locale: Locale;
  listings: SellerListing[];
  state: RequestState;
  error: string;
  emptySearch?: boolean;
  onRetry: () => void;
  onAdd: () => void;
  onEdit: (listing: SellerListing) => void;
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
            <th>{copy.actions}</th>
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
                {listing.offers[0] ? `${formatCurrencyAmount(listing.offers[0].price, listing.offers[0].currency, locale)} ${currencyLabel(listing.offers[0].currency)}` : "—"}
              </td>
              <td data-label={copy.status}>
                <span className={styles.statusBadge} data-status={listing.product.status}>{statusLabel(listing.product.status, copy)}</span>
              </td>
              <td data-label={copy.actions}>
                {listing.product.canEdit ? (
                  <button className={styles.textButton} type="button" onClick={() => onEdit(listing)}>
                    {copy.editProduct}
                  </button>
                ) : (
                  <span className={styles.actionUnavailable} title={copy.sharedProductHint}>
                    {copy.sharedProduct}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
