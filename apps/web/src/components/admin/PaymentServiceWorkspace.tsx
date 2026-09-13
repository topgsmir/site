"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AdminPaymentMethod,
  AdminPaymentSellerOption,
  AdminPaymentTransaction,
  AdminPaymentTransactionsPage,
  PaymentTransactionStatus,
  ProductType
} from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./PaymentServiceWorkspace.module.css";

const copy = {
  en: {
    eyebrow: "Money operations",
    title: "Payment service",
    intro: "Monitor registered payment methods and every payment attempt recorded against an order.",
    methods: "Payment methods",
    methodsHint: "Methods are supplied by interchangeable provider adapters in the API.",
    available: "Ready",
    unavailable: "Needs configuration",
    configured: "Configuration complete",
    noChanges: "Saved — no pending changes",
    cancelChanges: "Discard changes",
    methodSaveError: "This method was not saved. Review the settings and try again.",
    developmentOnly: "This test gateway is available outside production only. Use it for local development and automated testing.",
    missingMerchantId: "Enter the Zarinpal merchant ID below before enabling this method.",
    missingCallbackUrl: "Enter a valid HTTPS callback URL below before enabling this method.",
    credentials: "Provider credentials",
    credentialsHint: "Secrets are encrypted before storage and are never returned to this browser.",
    merchantId: "Merchant ID",
    callbackUrl: "HTTPS callback URL",
    refundToken: "Refund access token",
    configuredSecret: "Configured · ending in {hint}",
    configuredValue: "Configured · enter a value only to replace it",
    optionalSecret: "Optional · required only for refunds",
    removeRefundToken: "Remove the saved refund token",
    disabled: "Disabled",
    refunds: "Refunds supported",
    enableMethod: "Enable this payment method",
    productTypes: "Allowed product types",
    productTypesHint: "No selection allows every product type.",
    sellers: "Allowed sellers",
    sellersHint: "No selection allows every active seller.",
    saveMethod: "Save method settings",
    savingMethod: "Saving…",
    methodSaved: "Payment method settings saved.",
    unsaved: "Unsaved changes",
    allProductTypes: "All product types",
    allowAllProductTypes: "Allow every product type",
    selectedProductTypes: "selected product types",
    allSellers: "All active sellers",
    selectedSellersTitle: "Selected sellers",
    clearSellers: "Clear seller restriction",
    addSeller: "Add",
    removeSeller: "Remove {seller}",
    sellerSearchPrompt: "Search to add a seller. Selected sellers stay visible here.",
    selectedSellers: "selected sellers",
    scopeAll: "Available for every product type from every active seller.",
    scopeTypes: "Available only for {types}, from every active seller.",
    scopeSellers: "Available for every product type, only from {sellers}.",
    scopeBoth: "Available only when the product type is {types} and the seller is {sellers}.",
    searchSellers: "Search sellers",
    clearSearch: "Clear seller search",
    searchingSellers: "Searching sellers…",
    noSellerMatch: "No seller matches this search.",
    saveError: "Settings could not be saved. Review your choices and try again.",
    allTypes: { digital: "Digital", physical: "Physical", service: "Service", bridge: "Bridge" },
    transactions: "Transactions",
    transactionsHint: "Newest attempts appear first. Amounts are shown exactly as stored.",
    order: "Order",
    parties: "Customer / seller",
    method: "Method",
    amount: "Amount",
    status: "Status",
    created: "Created",
    noReference: "No provider reference",
    empty: "No transactions have been recorded yet. New payment attempts will appear here automatically.",
    loading: "Loading payment service…",
    loadMore: "Load more transactions",
    filters: "Find a transaction",
    referenceSearch: "Order, transaction, authority, or provider reference",
    referenceSearchHint: "Enter the complete identifier (at least 2 characters).",
    filterStatus: "Status",
    filterProvider: "Payment method",
    filterSeller: "Seller",
    filterFrom: "From date",
    filterTo: "To date",
    allOptions: "All",
    chooseSeller: "Choose a seller from the suggestions",
    applyFilters: "Apply filters",
    resetFilters: "Clear filters",
    results: "transactions found",
    details: "Details",
    hideDetails: "Hide details",
    transactionId: "Transaction ID",
    authority: "Authority",
    providerReference: "Provider reference",
    buyerEmail: "Buyer email",
    failureCode: "Failure code",
    verifiedAt: "Verified",
    refundedAt: "Refunded",
    updatedAt: "Last update",
    notRecorded: "Not recorded",
    invalidDateRange: "The start date must be before the end date.",
    loadError: "Payment information could not be loaded. Refresh and try again.",
    statusCreated: "Created",
    statusInitiating: "Initiating",
    statusInitiationUnknown: "Initiation needs reconciliation",
    statusPending: "Pending",
    statusSucceeded: "Succeeded",
    statusRefundPending: "Refunding",
    statusRefundUnknown: "Refund needs reconciliation",
    statusFailed: "Failed",
    statusRefunded: "Refunded"
  },
  fa: {
    eyebrow: "عملیات مالی",
    title: "سرویس پرداخت",
    intro: "روش‌های پرداخت ثبت‌شده و تمام تلاش‌های پرداخت مرتبط با سفارش‌ها را در یک جا ببینید.",
    methods: "روش‌های پرداخت",
    methodsHint: "هر روش با یک درگاه مستقل در API پیاده‌سازی شده و بدون تغییر منطق اصلی قابل جایگزینی است.",
    available: "آماده استفاده",
    unavailable: "نیازمند پیکربندی",
    configured: "پیکربندی کامل است",
    noChanges: "تنظیمات ذخیره شده و تغییری باقی نمانده است",
    cancelChanges: "لغو تغییرات",
    methodSaveError: "تنظیمات این روش ذخیره نشد. موارد را بررسی و دوباره تلاش کنید.",
    developmentOnly: "این درگاه آزمایشی فقط خارج از محیط عملیاتی کار می‌کند. از آن برای توسعه محلی و تست خودکار استفاده کنید.",
    missingMerchantId: "پیش از فعال‌سازی، شناسه پذیرنده زرین‌پال را در بخش زیر وارد کنید.",
    missingCallbackUrl: "پیش از فعال‌سازی، نشانی بازگشت معتبر HTTPS را در بخش زیر وارد کنید.",
    credentials: "اطلاعات اتصال درگاه",
    credentialsHint: "اطلاعات محرمانه پیش از ذخیره رمزنگاری می‌شود و هرگز به مرورگر بازگردانده نمی‌شود.",
    merchantId: "شناسه پذیرنده",
    callbackUrl: "نشانی بازگشت HTTPS",
    refundToken: "توکن دسترسی بازپرداخت",
    configuredSecret: "تنظیم شده · پایان با {hint}",
    configuredValue: "تنظیم شده · فقط برای جایگزینی مقدار وارد کنید",
    optionalSecret: "اختیاری · فقط برای بازپرداخت لازم است",
    removeRefundToken: "حذف توکن بازپرداخت ذخیره‌شده",
    disabled: "غیرفعال",
    refunds: "امکان بازپرداخت",
    enableMethod: "فعال‌سازی این روش پرداخت",
    productTypes: "نوع محصولات مجاز",
    productTypesHint: "اگر گزینه‌ای انتخاب نشود، همه نوع محصولات مجاز هستند.",
    sellers: "فروشنده‌های مجاز",
    sellersHint: "اگر فروشنده‌ای انتخاب نکنید، همه فروشنده‌های فعال می‌توانند از این روش استفاده کنند.",
    saveMethod: "ذخیره تنظیمات روش",
    savingMethod: "در حال ذخیره…",
    methodSaved: "تنظیمات روش پرداخت ذخیره شد.",
    unsaved: "تغییرات ذخیره‌نشده",
    allProductTypes: "همه نوع محصولات",
    allowAllProductTypes: "همه نوع محصولات مجاز باشند",
    selectedProductTypes: "نوع محصول انتخاب‌شده",
    allSellers: "همه فروشنده‌های فعال",
    selectedSellersTitle: "فروشنده‌های انتخاب‌شده",
    clearSellers: "حذف محدودیت فروشنده",
    addSeller: "افزودن",
    removeSeller: "حذف {seller}",
    sellerSearchPrompt: "برای افزودن فروشنده جست‌وجو کنید. انتخاب‌های فعلی همیشه همین‌جا می‌مانند.",
    selectedSellers: "فروشنده انتخاب‌شده",
    scopeAll: "این روش برای همه نوع محصولات و همه فروشنده‌های فعال نمایش داده می‌شود.",
    scopeTypes: "این روش فقط برای {types} و همه فروشنده‌های فعال نمایش داده می‌شود.",
    scopeSellers: "این روش برای همه نوع محصولات، فقط از فروشنده‌های {sellers} نمایش داده می‌شود.",
    scopeBoth: "این روش فقط زمانی نمایش داده می‌شود که نوع محصول یکی از {types} و فروشنده یکی از {sellers} باشد.",
    searchSellers: "جست‌وجوی فروشنده",
    clearSearch: "پاک کردن جست‌وجوی فروشنده",
    searchingSellers: "در حال جست‌وجوی فروشنده…",
    noSellerMatch: "فروشنده‌ای با این عبارت پیدا نشد.",
    saveError: "تنظیمات ذخیره نشد. انتخاب‌ها را بررسی و دوباره تلاش کنید.",
    allTypes: { digital: "دیجیتال", physical: "فیزیکی", service: "خدمات", bridge: "بریج" },
    transactions: "تراکنش‌ها",
    transactionsHint: "جدیدترین تلاش‌ها ابتدا نمایش داده می‌شوند و مبلغ دقیقاً مطابق رکورد پایگاه داده است.",
    order: "سفارش",
    parties: "خریدار / فروشنده",
    method: "روش",
    amount: "مبلغ",
    status: "وضعیت",
    created: "زمان ثبت",
    noReference: "بدون شناسه درگاه",
    empty: "هنوز تراکنشی ثبت نشده است. تلاش‌های پرداخت جدید به‌صورت خودکار اینجا نمایش داده می‌شوند.",
    loading: "در حال بارگذاری سرویس پرداخت…",
    loadMore: "نمایش تراکنش‌های بیشتر",
    filters: "پیدا کردن تراکنش",
    referenceSearch: "شناسه سفارش، تراکنش، Authority یا مرجع درگاه",
    referenceSearchHint: "شناسه کامل را با دست‌کم ۲ نویسه وارد کنید.",
    filterStatus: "وضعیت",
    filterProvider: "روش پرداخت",
    filterSeller: "فروشنده",
    filterFrom: "از تاریخ",
    filterTo: "تا تاریخ",
    allOptions: "همه",
    chooseSeller: "فروشنده را از پیشنهادها انتخاب کنید",
    applyFilters: "اعمال فیلترها",
    resetFilters: "پاک کردن فیلترها",
    results: "تراکنش پیدا شد",
    details: "جزئیات",
    hideDetails: "بستن جزئیات",
    transactionId: "شناسه تراکنش",
    authority: "Authority",
    providerReference: "مرجع درگاه",
    buyerEmail: "ایمیل خریدار",
    failureCode: "کد خطا",
    verifiedAt: "زمان تأیید",
    refundedAt: "زمان بازپرداخت",
    updatedAt: "آخرین تغییر",
    notRecorded: "ثبت نشده",
    invalidDateRange: "تاریخ شروع باید پیش از تاریخ پایان باشد.",
    loadError: "اطلاعات پرداخت بارگذاری نشد. صفحه را تازه کنید.",
    statusCreated: "ایجادشده",
    statusInitiating: "در حال آغاز پرداخت",
    statusInitiationUnknown: "نیازمند بررسی آغاز پرداخت",
    statusPending: "در انتظار",
    statusSucceeded: "موفق",
    statusRefundPending: "در حال بازپرداخت",
    statusRefundUnknown: "نیازمند بررسی بازپرداخت",
    statusFailed: "ناموفق",
    statusRefunded: "بازپرداخت‌شده"
  },
  ar: {
    eyebrow: "العمليات المالية",
    title: "خدمة الدفع",
    intro: "راقب طرق الدفع المسجلة وجميع محاولات الدفع المرتبطة بالطلبات.",
    methods: "طرق الدفع",
    methodsHint: "توفر واجهة API كل طريقة عبر موفر مستقل قابل للاستبدال.",
    available: "جاهزة",
    unavailable: "تحتاج إلى إعداد",
    configured: "اكتمل الإعداد",
    noChanges: "تم حفظ الإعدادات ولا توجد تغييرات معلقة",
    cancelChanges: "إلغاء التغييرات",
    methodSaveError: "لم تُحفظ هذه الطريقة. راجع الإعدادات وحاول مجدداً.",
    developmentOnly: "بوابة الاختبار هذه متاحة خارج بيئة الإنتاج فقط.",
    missingMerchantId: "أدخل معرّف تاجر Zarinpal أدناه قبل تفعيل هذه الطريقة.",
    missingCallbackUrl: "أدخل رابط عودة HTTPS صالحاً أدناه قبل تفعيل هذه الطريقة.",
    credentials: "بيانات اعتماد المزوّد",
    credentialsHint: "تُشفّر الأسرار قبل التخزين ولا يعيدها الخادم إلى هذا المتصفح.",
    merchantId: "معرّف التاجر",
    callbackUrl: "رابط عودة HTTPS",
    refundToken: "رمز الوصول للاسترداد",
    configuredSecret: "تم الإعداد · ينتهي بـ {hint}",
    configuredValue: "تم الإعداد · أدخل قيمة فقط لاستبدالها",
    optionalSecret: "اختياري · مطلوب للاسترداد فقط",
    removeRefundToken: "حذف رمز الاسترداد المحفوظ",
    disabled: "معطلة",
    refunds: "تدعم الاسترداد",
    enableMethod: "تفعيل طريقة الدفع",
    productTypes: "أنواع المنتجات المسموحة",
    productTypesHint: "عدم التحديد يسمح بكل أنواع المنتجات.",
    sellers: "البائعون المسموحون",
    sellersHint: "عدم التحديد يسمح لكل البائعين النشطين باستخدام هذه الطريقة.",
    saveMethod: "حفظ إعدادات الطريقة",
    savingMethod: "جارٍ الحفظ…",
    methodSaved: "تم حفظ إعدادات طريقة الدفع.",
    unsaved: "تغييرات غير محفوظة",
    allProductTypes: "جميع أنواع المنتجات",
    allowAllProductTypes: "السماح بكل أنواع المنتجات",
    selectedProductTypes: "نوع منتج محدد",
    allSellers: "جميع البائعين النشطين",
    selectedSellersTitle: "البائعون المحددون",
    clearSellers: "إزالة قيد البائع",
    addSeller: "إضافة",
    removeSeller: "إزالة {seller}",
    sellerSearchPrompt: "ابحث لإضافة بائع. تبقى الاختيارات الحالية ظاهرة هنا.",
    selectedSellers: "بائع محدد",
    scopeAll: "متاحة لكل أنواع المنتجات من جميع البائعين النشطين.",
    scopeTypes: "متاحة فقط لأنواع {types} من جميع البائعين النشطين.",
    scopeSellers: "متاحة لكل أنواع المنتجات من البائعين {sellers} فقط.",
    scopeBoth: "متاحة فقط عندما يكون النوع {types} والبائع {sellers}.",
    searchSellers: "البحث عن بائع",
    clearSearch: "مسح البحث عن بائع",
    searchingSellers: "جارٍ البحث عن بائع…",
    noSellerMatch: "لا يوجد بائع مطابق لهذا البحث.",
    saveError: "تعذر حفظ الإعدادات. راجع اختياراتك وحاول مجدداً.",
    allTypes: { digital: "رقمي", physical: "مادي", service: "خدمة", bridge: "Bridge" },
    transactions: "المعاملات",
    transactionsHint: "تظهر أحدث المحاولات أولاً وتُعرض المبالغ كما هي مخزنة.",
    order: "الطلب",
    parties: "العميل / البائع",
    method: "الطريقة",
    amount: "المبلغ",
    status: "الحالة",
    created: "تاريخ الإنشاء",
    noReference: "لا يوجد مرجع للموفر",
    empty: "لم تُسجل معاملات بعد. ستظهر محاولات الدفع الجديدة هنا تلقائياً.",
    loading: "جارٍ تحميل خدمة الدفع…",
    loadMore: "تحميل معاملات إضافية",
    filters: "العثور على معاملة",
    referenceSearch: "معرف الطلب أو المعاملة أو مرجع الموفر",
    referenceSearchHint: "أدخل المعرف الكامل بحرفين على الأقل.",
    filterStatus: "الحالة",
    filterProvider: "طريقة الدفع",
    filterSeller: "البائع",
    filterFrom: "من تاريخ",
    filterTo: "إلى تاريخ",
    allOptions: "الكل",
    chooseSeller: "اختر بائعاً من الاقتراحات",
    applyFilters: "تطبيق المرشحات",
    resetFilters: "مسح المرشحات",
    results: "معاملة موجودة",
    details: "التفاصيل",
    hideDetails: "إخفاء التفاصيل",
    transactionId: "معرف المعاملة",
    authority: "Authority",
    providerReference: "مرجع الموفر",
    buyerEmail: "بريد المشتري",
    failureCode: "رمز الخطأ",
    verifiedAt: "وقت التحقق",
    refundedAt: "وقت الاسترداد",
    updatedAt: "آخر تحديث",
    notRecorded: "غير مسجل",
    invalidDateRange: "يجب أن يسبق تاريخ البدء تاريخ الانتهاء.",
    loadError: "تعذر تحميل معلومات الدفع. حدّث الصفحة وحاول مجدداً.",
    statusCreated: "أُنشئت",
    statusInitiating: "جارٍ بدء الدفع",
    statusInitiationUnknown: "بدء الدفع يحتاج إلى مراجعة",
    statusPending: "قيد الانتظار",
    statusSucceeded: "ناجحة",
    statusRefundPending: "جارٍ الاسترداد",
    statusRefundUnknown: "الاسترداد يحتاج إلى مراجعة",
    statusFailed: "فشلت",
    statusRefunded: "مستردة"
  }
} as const;

type TransactionFilters = {
  query: string;
  status: "" | PaymentTransactionStatus;
  providerCode: string;
  sellerId: string;
  from: string;
  to: string;
};

type CredentialDraft = {
  merchantId: string;
  callbackUrl: string;
  refundAccessToken: string;
  clearRefundAccessToken: boolean;
};

const EMPTY_CREDENTIAL_DRAFT: CredentialDraft = {
  merchantId: "",
  callbackUrl: "",
  refundAccessToken: "",
  clearRefundAccessToken: false
};

const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  query: "",
  status: "",
  providerCode: "",
  sellerId: "",
  from: "",
  to: ""
};

export function PaymentServiceWorkspace({
  locale,
  view
}: {
  locale: Locale;
  view: "transactions" | "methods";
}) {
  const c = copy[locale];
  const [methods, setMethods] = useState<AdminPaymentMethod[]>([]);
  const [sellerOptions, setSellerOptions] = useState<AdminPaymentSellerOption[]>([]);
  const [transactions, setTransactions] = useState<AdminPaymentTransaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [savingMethod, setSavingMethod] = useState<string | null>(null);
  const [savedMethods, setSavedMethods] = useState<Record<string, string>>({});
  const [savedMethodValues, setSavedMethodValues] = useState<Record<string, AdminPaymentMethod>>({});
  const [savedMethod, setSavedMethod] = useState<string | null>(null);
  const [methodErrors, setMethodErrors] = useState<Record<string, string>>({});
  const [credentialDrafts, setCredentialDrafts] = useState<Record<string, CredentialDraft>>({});
  const [activeMethodCode, setActiveMethodCode] = useState<string | null>(null);
  const [sellerQueries, setSellerQueries] = useState<Record<string, string>>({});
  const [activeSellerSearch, setActiveSellerSearch] = useState<{ code: string; query: string } | null>(null);
  const [searchingSellersFor, setSearchingSellersFor] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<TransactionFilters>({ ...EMPTY_TRANSACTION_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState<TransactionFilters>({ ...EMPTY_TRANSACTION_FILTERS });
  const [transactionSellerText, setTransactionSellerText] = useState("");
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(() => new Set());

  const loadMethodData = useCallback(async () => {
    setLoading(true);
    setError("");
    setSavedMethod(null);
    try {
      const [methodsResponse, sellersResponse] = await Promise.all([
        api.get<AdminPaymentMethod[]>("/payments/admin/methods"),
        api.get<AdminPaymentSellerOption[]>("/payments/admin/seller-options", { params: { limit: 100 } })
      ]);
      const snapshots = Object.fromEntries(methodsResponse.data.map((method) => [method.code, cloneMethod(method)]));
      setMethods(methodsResponse.data);
      setCredentialDrafts({});
      setSavedMethodValues(snapshots);
      setSavedMethods(Object.fromEntries(methodsResponse.data.map((method) => [method.code, serializeMethod(method)])));
      setActiveMethodCode((current) => current && methodsResponse.data.some((method) => method.code === current)
        ? current
        : methodsResponse.data[0]?.code ?? null);
      const selected = methodsResponse.data.flatMap((method) => method.allowedSellers);
      setSellerOptions(uniqueSellers([...selected, ...sellersResponse.data]));
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }, [c.loadError]);

  useEffect(() => {
    if (view === "methods") void loadMethodData();
  }, [loadMethodData, view]);

  useEffect(() => {
    if (view !== "transactions") return;
    void (async () => {
      try {
        const [methodsResponse, sellersResponse] = await Promise.all([
          api.get<AdminPaymentMethod[]>("/payments/admin/methods"),
          api.get<AdminPaymentSellerOption[]>("/payments/admin/seller-options", { params: { limit: 100 } })
        ]);
        setMethods(methodsResponse.data);
        setSellerOptions(uniqueSellers(sellersResponse.data));
      } catch {
        setError(c.loadError);
      }
    })();
  }, [c.loadError, view]);

  const loadTransactions = useCallback(async (filters: TransactionFilters, cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else {
      setLoading(true);
      setTransactions([]);
      setTransactionTotal(0);
    }
    setError("");
    try {
      const response = await api.get<AdminPaymentTransactionsPage>("/payments/admin/transactions", {
        params: {
          limit: 20,
          ...(cursor ? { cursor } : {}),
          ...(filters.query.trim() ? { query: filters.query.trim() } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.providerCode ? { providerCode: filters.providerCode } : {}),
          ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {})
        }
      });
      setTransactions((current) => cursor ? [...current, ...response.data.items] : response.data.items);
      setNextCursor(response.data.nextCursor);
      setTransactionTotal(response.data.total);
      if (!cursor) setExpandedTransactions(new Set());
    } catch {
      setError(c.loadError);
    } finally {
      if (cursor) setLoadingMore(false);
      else setLoading(false);
    }
  }, [c.loadError]);

  useEffect(() => {
    if (view === "transactions") void loadTransactions(appliedFilters);
  }, [appliedFilters, loadTransactions, view]);

  useEffect(() => {
    const query = activeSellerSearch?.query.trim();
    if (!activeSellerSearch || !query) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchingSellersFor(activeSellerSearch.code);
      try {
        const response = await api.get<AdminPaymentSellerOption[]>("/payments/admin/seller-options", {
          params: { limit: 100, query },
          signal: controller.signal
        });
        setSellerOptions((current) => uniqueSellers([...current, ...response.data]));
      } catch {
        // The existing options stay usable when a background search is interrupted or fails.
      } finally {
        if (!controller.signal.aborted) setSearchingSellersFor(null);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeSellerSearch]);

  function updateMethod(code: string, update: Partial<AdminPaymentMethod>) {
    setSavedMethod((current) => current === code ? null : current);
    setMethodErrors((current) => ({ ...current, [code]: "" }));
    setMethods((current) => current.map((method) => method.code === code ? { ...method, ...update } : method));
  }

  function resetMethod(code: string) {
    const snapshot = savedMethodValues[code];
    if (!snapshot) return;
    setMethods((current) => current.map((method) => method.code === code ? cloneMethod(snapshot) : method));
    setCredentialDrafts((current) => ({ ...current, [code]: { ...EMPTY_CREDENTIAL_DRAFT } }));
    setMethodErrors((current) => ({ ...current, [code]: "" }));
    setSavedMethod(null);
  }

  async function saveMethod(method: AdminPaymentMethod) {
    setSavingMethod(method.code);
    setMethodErrors((current) => ({ ...current, [method.code]: "" }));
    setSavedMethod(null);
    try {
      const credentialDraft = credentialDrafts[method.code] ?? EMPTY_CREDENTIAL_DRAFT;
      const response = await api.patch<AdminPaymentMethod>(`/payments/admin/methods/${method.code}`, {
        enabled: method.enabled,
        productTypes: method.allowedProductTypes,
        sellerIds: method.allowedSellers.map((seller) => seller.id),
        ...(method.code === "zarinpal" ? {
          ...(credentialDraft.merchantId.trim() ? { merchantId: credentialDraft.merchantId.trim() } : {}),
          ...(credentialDraft.callbackUrl.trim() ? { callbackUrl: credentialDraft.callbackUrl.trim() } : {}),
          ...(credentialDraft.refundAccessToken.trim() ? { refundAccessToken: credentialDraft.refundAccessToken.trim() } : {}),
          ...(credentialDraft.clearRefundAccessToken ? { clearRefundAccessToken: true } : {})
        } : {})
      });
      updateMethod(method.code, response.data);
      setSavedMethods((current) => ({ ...current, [method.code]: serializeMethod(response.data) }));
      setSavedMethodValues((current) => ({ ...current, [method.code]: cloneMethod(response.data) }));
      setCredentialDrafts((current) => ({ ...current, [method.code]: { ...EMPTY_CREDENTIAL_DRAFT } }));
      setSavedMethod(method.code);
    } catch {
      setMethodErrors((current) => ({ ...current, [method.code]: c.methodSaveError }));
    } finally {
      setSavingMethod(null);
    }
  }

  function applyTransactionFilters() {
    if (draftFilters.from && draftFilters.to && draftFilters.from > draftFilters.to) {
      setError(c.invalidDateRange);
      return;
    }
    setError("");
    setAppliedFilters({ ...draftFilters });
  }

  function clearTransactionFilters() {
    setDraftFilters({ ...EMPTY_TRANSACTION_FILTERS });
    setAppliedFilters({ ...EMPTY_TRANSACTION_FILTERS });
    setTransactionSellerText("");
  }

  function clearAppliedFilter(key: keyof TransactionFilters) {
    const next = { ...appliedFilters, [key]: "" };
    setAppliedFilters(next);
    setDraftFilters(next);
    if (key === "sellerId") setTransactionSellerText("");
  }

  return (
    <section className={styles.workspace} aria-labelledby="payment-service-title">
      <header className={styles.hero}>
        <h1 id="payment-service-title">{c.title}</h1>
        <span>{c.intro}</span>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      {view === "methods" ? <section className={styles.section} aria-labelledby="payment-methods-title">
        <header className={styles.sectionHeader}>
          <div>
            <h2 id="payment-methods-title">{c.methods}</h2>
            <p>{c.methodsHint}</p>
          </div>
          <strong>{methods.length.toLocaleString(locale)}</strong>
        </header>
        {loading ? <MethodSkeleton label={c.loading} /> : (() => {
          const method = methods.find((item) => item.code === activeMethodCode) ?? methods[0];
          if (!method) return null;
          const credentialDraft = credentialDrafts[method.code] ?? EMPTY_CREDENTIAL_DRAFT;
          const credentialsDirty = Object.values(credentialDraft).some(Boolean);
          const dirty = savedMethods[method.code] !== serializeMethod(method) || credentialsDirty;
          const sellerQuery = sellerQueries[method.code] ?? "";
          const normalizedSellerQuery = sellerQuery.trim().toLocaleLowerCase(locale);
          const sellerResults = normalizedSellerQuery
            ? sellerOptions
              .filter((seller) => seller.shopName.toLocaleLowerCase(locale).includes(normalizedSellerQuery))
              .filter((seller) => !method.allowedSellers.some((selected) => selected.id === seller.id))
              .slice(0, 10)
            : [];
          const availabilityMessage = unavailabilityMessage(method, c);

          return <div className={styles.methodConsole}>
            <nav className={styles.methodIndex} aria-label={c.methods}>
              {methods.map((item) => (
                <button
                  type="button"
                  key={item.code}
                  aria-pressed={item.code === method.code}
                  onClick={() => setActiveMethodCode(item.code)}
                >
                  <span className={styles.methodMark} aria-hidden="true">{item.name.slice(0, 1)}</span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.currencies.join(" · ")}</small>
                  </span>
                  <i data-state={!item.adapterAvailable ? "unavailable" : item.enabled ? "enabled" : "disabled"}>
                    {!item.adapterAvailable ? c.unavailable : item.enabled ? c.available : c.disabled}
                  </i>
                </button>
              ))}
            </nav>

            <article className={styles.methodEditor} aria-labelledby={`method-${method.code}-title`}>
              <header className={styles.editorHeader}>
                <div>
                  <h3 id={`method-${method.code}-title`}>{method.name}</h3>
                  <p dir="ltr">{method.code} · {method.currencies.join(" · ")}</p>
                </div>
                <div className={styles.methodState} data-state={!method.adapterAvailable ? "unavailable" : method.enabled ? "enabled" : "disabled"}>
                  <strong>{!method.adapterAvailable ? c.unavailable : method.enabled ? c.available : c.disabled}</strong>
                  <small>{method.supportsRefunds ? c.refunds : c.configured}</small>
                </div>
              </header>

              {!method.adapterAvailable ? (
                <div className={styles.readinessNotice} id={`method-${method.code}-availability`} role="note">
                  <strong>{c.unavailable}</strong>
                  <p>{availabilityMessage}</p>
                </div>
              ) : null}

              <div className={styles.policyPreview}>
                <span>{c.configured}</span>
                <strong>{scopeSentence(method, c, locale)}</strong>
              </div>

              {method.code === "zarinpal" ? <fieldset className={styles.credentialsPanel}>
                <legend>{c.credentials}</legend>
                <p>{c.credentialsHint}</p>
                <div className={styles.credentialFields}>
                  <label>
                    <span>{c.merchantId}</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={credentialDraft.merchantId}
                      placeholder={method.configuration?.merchantIdConfigured
                        ? c.configuredSecret.replace("{hint}", method.configuration.merchantIdHint ?? "••••")
                        : c.merchantId}
                      onChange={(event) => setCredentialDrafts((current) => ({
                        ...current,
                        [method.code]: { ...credentialDraft, merchantId: event.currentTarget.value }
                      }))}
                    />
                  </label>
                  <label>
                    <span>{c.callbackUrl}</span>
                    <input
                      type="url"
                      inputMode="url"
                      dir="ltr"
                      value={credentialDraft.callbackUrl}
                      placeholder={method.configuration?.callbackUrlConfigured ? c.configuredValue : "https://"}
                      onChange={(event) => setCredentialDrafts((current) => ({
                        ...current,
                        [method.code]: { ...credentialDraft, callbackUrl: event.currentTarget.value }
                      }))}
                    />
                  </label>
                  <label>
                    <span>{c.refundToken}</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={credentialDraft.refundAccessToken}
                      disabled={credentialDraft.clearRefundAccessToken}
                      placeholder={method.configuration?.refundAccessTokenConfigured
                        ? c.configuredSecret.replace("{hint}", method.configuration.refundAccessTokenHint ?? "••••")
                        : c.optionalSecret}
                      onChange={(event) => setCredentialDrafts((current) => ({
                        ...current,
                        [method.code]: { ...credentialDraft, refundAccessToken: event.currentTarget.value }
                      }))}
                    />
                  </label>
                </div>
                {method.configuration?.refundAccessTokenConfigured ? <label className={styles.clearCredential}>
                  <input
                    type="checkbox"
                    checked={credentialDraft.clearRefundAccessToken}
                    onChange={(event) => setCredentialDrafts((current) => ({
                      ...current,
                      [method.code]: {
                        ...credentialDraft,
                        refundAccessToken: "",
                        clearRefundAccessToken: event.currentTarget.checked
                      }
                    }))}
                  />
                  <span>{c.removeRefundToken}</span>
                </label> : null}
              </fieldset> : null}

              <label className={styles.enableControl}>
                <span>
                  <strong>{c.enableMethod}</strong>
                  <small>{method.adapterAvailable ? c.configured : availabilityMessage}</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={method.enabled}
                  disabled={!method.adapterAvailable && !method.enabled && method.code !== "zarinpal"}
                  aria-describedby={!method.adapterAvailable ? `method-${method.code}-availability` : undefined}
                  onChange={(event) => updateMethod(method.code, { enabled: event.currentTarget.checked })}
                />
                <span className={styles.switchTrack} aria-hidden="true"><span /></span>
              </label>

              <div className={styles.policyGrid}>
                <fieldset className={styles.restriction}>
                  <legend>{c.productTypes}</legend>
                  <p>{c.productTypesHint}</p>
                  <div className={styles.typeOptions}>
                    <button
                      type="button"
                      aria-pressed={method.allowedProductTypes.length === 0}
                      onClick={() => updateMethod(method.code, { allowedProductTypes: [] })}
                    >
                      <AllProductsIcon />
                      <span>{c.allProductTypes}</span>
                      <span className={styles.selectionMark} aria-hidden="true"><CheckIcon /></span>
                    </button>
                    {(Object.keys(c.allTypes) as ProductType[]).map((productType) => (
                      <button
                        type="button"
                        key={productType}
                        aria-pressed={method.allowedProductTypes.includes(productType)}
                        onClick={() => updateMethod(method.code, {
                          allowedProductTypes: method.allowedProductTypes.includes(productType)
                            ? method.allowedProductTypes.filter((type) => type !== productType)
                            : [...method.allowedProductTypes, productType]
                        })}
                      >
                        <ProductTypeIcon type={productType} />
                        <span>{c.allTypes[productType]}</span>
                        <span className={styles.selectionMark} aria-hidden="true"><CheckIcon /></span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className={styles.sellerControl}>
                  <legend>{c.sellers}</legend>
                  <p>{c.sellerSearchPrompt}</p>
                  <div className={styles.selectedSellers}>
                    <header>
                      <strong>{c.selectedSellersTitle}</strong>
                      {method.allowedSellers.length ? (
                        <button type="button" onClick={() => updateMethod(method.code, { allowedSellers: [] })}>
                          {c.clearSellers}
                        </button>
                      ) : null}
                    </header>
                    {method.allowedSellers.length ? <div className={styles.sellerChips}>
                      {method.allowedSellers.map((seller) => (
                        <button
                          type="button"
                          key={seller.id}
                          aria-label={c.removeSeller.replace("{seller}", seller.shopName)}
                          onClick={() => updateMethod(method.code, {
                            allowedSellers: method.allowedSellers.filter((item) => item.id !== seller.id)
                          })}
                        >
                          <StoreIcon /><span>{seller.shopName}</span><i aria-hidden="true"><CloseIcon /></i>
                        </button>
                      ))}
                    </div> : <p>{c.allSellers}</p>}
                  </div>
                  <div className={styles.searchControl}>
                    <label htmlFor={`seller-search-${method.code}`}>{c.searchSellers}</label>
                    <div className={styles.searchField}>
                      <SearchIcon />
                      <input
                        id={`seller-search-${method.code}`}
                        type="search"
                        value={sellerQuery}
                        onChange={(event) => {
                          const query = event.currentTarget.value;
                          setSellerQueries((current) => ({ ...current, [method.code]: query }));
                          setActiveSellerSearch({ code: method.code, query });
                        }}
                      />
                      {sellerQuery ? <button
                        type="button"
                        aria-label={c.clearSearch}
                        onClick={() => {
                          setSellerQueries((current) => ({ ...current, [method.code]: "" }));
                          setActiveSellerSearch(null);
                        }}
                      ><CloseIcon /></button> : null}
                    </div>
                  </div>
                  {sellerQuery.trim() ? <div className={styles.sellerResults} aria-busy={searchingSellersFor === method.code}>
                    {sellerResults.map((seller) => (
                      <button
                        type="button"
                        key={seller.id}
                        onClick={() => updateMethod(method.code, {
                          allowedSellers: uniqueSellers([...method.allowedSellers, seller])
                        })}
                      >
                        <StoreIcon />
                        <span>{seller.shopName}</span>
                        <strong>{c.addSeller}<PlusIcon /></strong>
                      </button>
                    ))}
                    {searchingSellersFor === method.code ? <p role="status">{c.searchingSellers}</p> : null}
                    {!sellerResults.length && searchingSellersFor !== method.code ? <p>{c.noSellerMatch}</p> : null}
                  </div> : null}
                </fieldset>
              </div>

              <footer className={styles.methodActions}>
                <span data-state={methodErrors[method.code] ? "error" : dirty ? "dirty" : "saved"} role="status">
                  {methodErrors[method.code] || (savedMethod === method.code && !dirty ? c.methodSaved : dirty ? c.unsaved : c.noChanges)}
                </span>
                <div>
                  {dirty ? <button className={styles.discardMethod} type="button" onClick={() => resetMethod(method.code)}>
                    {c.cancelChanges}
                  </button> : null}
                  <button
                    className={styles.saveMethod}
                    type="button"
                    data-loading={savingMethod === method.code}
                    disabled={savingMethod !== null || !dirty}
                    onClick={() => void saveMethod(method)}
                  >
                    {savingMethod === method.code ? c.savingMethod : c.saveMethod}
                  </button>
                </div>
              </footer>
            </article>
          </div>;
        })()}
      </section> : null}

      {view === "transactions" ? <section className={styles.section} aria-labelledby="payment-transactions-title">
        <header className={styles.sectionHeader}>
          <div>
            <h2 id="payment-transactions-title">{c.transactions}</h2>
            <p>{c.transactionsHint}</p>
          </div>
          {!loading ? <strong>{transactionTotal.toLocaleString(locale)}</strong> : null}
        </header>

        <form className={styles.transactionFilters} onSubmit={(event) => {
          event.preventDefault();
          applyTransactionFilters();
        }}>
          <header>
            <h3>{c.filters}</h3>
            <p>{c.referenceSearchHint}</p>
          </header>
          <label className={styles.filterSearch}>
            <span>{c.referenceSearch}</span>
            <input
              type="search"
              minLength={2}
              value={draftFilters.query}
              onChange={(event) => setDraftFilters((current) => ({ ...current, query: event.currentTarget.value }))}
            />
          </label>
          <label>
            <span>{c.filterStatus}</span>
            <select
              value={draftFilters.status}
              onChange={(event) => setDraftFilters((current) => ({
                ...current,
                status: event.currentTarget.value as TransactionFilters["status"]
              }))}
            >
              <option value="">{c.allOptions}</option>
              {(["created", "initiating", "initiation_unknown", "pending", "succeeded", "refund_pending", "refund_unknown", "failed", "refunded"] as PaymentTransactionStatus[]).map((status) => (
                <option key={status} value={status}>{statusLabel(status, c)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{c.filterProvider}</span>
            <select
              value={draftFilters.providerCode}
              onChange={(event) => setDraftFilters((current) => ({ ...current, providerCode: event.currentTarget.value }))}
            >
              <option value="">{c.allOptions}</option>
              {methods.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}
            </select>
          </label>
          <label>
            <span>{c.filterSeller}</span>
            <input
              type="search"
              list="payment-transaction-sellers"
              value={transactionSellerText}
              placeholder={c.chooseSeller}
              onChange={(event) => {
                const value = event.currentTarget.value;
                const selected = sellerOptions.find((seller) => sellerOptionLabel(seller) === value);
                setTransactionSellerText(value);
                setDraftFilters((current) => ({ ...current, sellerId: selected?.id ?? "" }));
                setActiveSellerSearch({ code: "transactions", query: value });
              }}
            />
            <datalist id="payment-transaction-sellers">
              {sellerOptions.map((seller) => <option key={seller.id} value={sellerOptionLabel(seller)} />)}
            </datalist>
          </label>
          <label>
            <span>{c.filterFrom}</span>
            <input
              type="date"
              value={draftFilters.from}
              max={draftFilters.to || undefined}
              onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.currentTarget.value }))}
            />
          </label>
          <label>
            <span>{c.filterTo}</span>
            <input
              type="date"
              value={draftFilters.to}
              min={draftFilters.from || undefined}
              onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.currentTarget.value }))}
            />
          </label>
          <footer>
            <button className={styles.applyFilters} type="submit">{c.applyFilters}</button>
            {Object.values(appliedFilters).some(Boolean) || Object.values(draftFilters).some(Boolean) ? (
              <button className={styles.clearFilters} type="button" onClick={clearTransactionFilters}>{c.resetFilters}</button>
            ) : null}
          </footer>
        </form>

        {Object.entries(appliedFilters).some(([, value]) => Boolean(value)) ? (
          <div className={styles.appliedFilters} aria-label={c.filters}>
            {(Object.entries(appliedFilters) as Array<[keyof TransactionFilters, string]>).map(([key, value]) => value ? (
              <button key={key} type="button" onClick={() => clearAppliedFilter(key)}>
                <span>{filterLabel(key, value, methods, sellerOptions, c)}</span><i aria-hidden="true">×</i>
              </button>
            ) : null)}
          </div>
        ) : null}

        {!loading && !error ? <p className={styles.resultCount} aria-live="polite">
          <strong>{transactionTotal.toLocaleString(locale)}</strong> {c.results}
        </p> : null}

        {!loading && !error && transactions.length === 0 ? (
          <div className={styles.empty}>
            <span aria-hidden="true">۰</span>
            <p>{c.empty}</p>
          </div>
        ) : null}

        {transactions.length ? <div className={styles.transactionLedger}>
          <div className={styles.ledgerHeader} aria-hidden="true">
            <span>{c.order}</span><span>{c.parties}</span><span>{c.method}</span><span>{c.amount}</span><span>{c.status}</span><span>{c.created}</span><span />
          </div>
          {transactions.map((transaction) => {
            const expanded = expandedTransactions.has(transaction.id);
            return <article className={styles.transactionRow} key={transaction.id}>
              <div data-label={c.order}>
                <code dir="ltr">{shortId(transaction.orderId)}</code>
                <small dir="ltr">{transaction.providerReferenceId ?? transaction.authority ?? c.noReference}</small>
              </div>
              <div data-label={c.parties}>
                <strong>{transaction.buyer.fullName}</strong>
                <small>{transaction.seller.shopName}</small>
              </div>
              <div data-label={c.method}><span dir="ltr">{transaction.provider}</span></div>
              <div data-label={c.amount}>
                <strong dir="ltr" className={styles.amount}>{formatAmount(transaction.amount, locale)}</strong>
                <small dir="ltr">{transaction.currency}</small>
              </div>
              <div data-label={c.status}>
                <span className={styles.status} data-status={transaction.status}>{statusLabel(transaction.status, c)}</span>
              </div>
              <div data-label={c.created}>
                <time dateTime={transaction.createdAt}>{new Date(transaction.createdAt).toLocaleString(locale)}</time>
              </div>
              <button
                className={styles.detailsToggle}
                type="button"
                aria-expanded={expanded}
                aria-controls={`transaction-${transaction.id}-details`}
                onClick={() => setExpandedTransactions((current) => {
                  const next = new Set(current);
                  if (next.has(transaction.id)) next.delete(transaction.id);
                  else next.add(transaction.id);
                  return next;
                })}
              >{expanded ? c.hideDetails : c.details}</button>
              {expanded ? <dl className={styles.transactionDetails} id={`transaction-${transaction.id}-details`}>
                <div><dt>{c.transactionId}</dt><dd dir="ltr">{transaction.id}</dd></div>
                <div><dt>{c.order}</dt><dd dir="ltr">{transaction.orderId}</dd></div>
                <div><dt>{c.authority}</dt><dd dir="ltr">{transaction.authority ?? c.notRecorded}</dd></div>
                <div><dt>{c.providerReference}</dt><dd dir="ltr">{transaction.providerReferenceId ?? c.notRecorded}</dd></div>
                <div><dt>{c.buyerEmail}</dt><dd dir="ltr">{transaction.buyer.email}</dd></div>
                <div><dt>{c.failureCode}</dt><dd dir="ltr">{transaction.failureCode ?? c.notRecorded}</dd></div>
                <div><dt>{c.verifiedAt}</dt><dd>{formatDate(transaction.verifiedAt, locale, c.notRecorded)}</dd></div>
                <div><dt>{c.refundedAt}</dt><dd>{formatDate(transaction.refundedAt, locale, c.notRecorded)}</dd></div>
                <div><dt>{c.updatedAt}</dt><dd>{formatDate(transaction.updatedAt, locale, c.notRecorded)}</dd></div>
              </dl> : null}
            </article>;
          })}
        </div> : null}

        {loading ? <TransactionSkeleton label={c.loading} /> : null}
        {!loading && nextCursor ? (
          <button className={styles.more} type="button" disabled={loadingMore} onClick={() => void loadTransactions(appliedFilters, nextCursor)}>
            {loadingMore ? c.loading : c.loadMore}
          </button>
        ) : null}
      </section> : null}
    </section>
  );
}

function shortId(value: string) {
  return `#${value.slice(0, 8)}`;
}

function sellerOptionLabel(seller: AdminPaymentSellerOption) {
  return `${seller.shopName} · ${shortId(seller.id)}`;
}

function formatAmount(value: string, locale: Locale) {
  const [integer, rawFraction = ""] = value.split(".");
  const fraction = rawFraction.replace(/0+$/, "");
  const formattedInteger = BigInt(integer).toLocaleString(locale);
  return fraction ? `${formattedInteger}.${fraction}` : formattedInteger;
}

function formatDate(value: string | null, locale: Locale, fallback: string) {
  return value ? new Date(value).toLocaleString(locale) : fallback;
}

function statusLabel(status: PaymentTransactionStatus, c: (typeof copy)[Locale]) {
  if (status === "created") return c.statusCreated;
  if (status === "initiating") return c.statusInitiating;
  if (status === "initiation_unknown") return c.statusInitiationUnknown;
  if (status === "pending") return c.statusPending;
  if (status === "succeeded") return c.statusSucceeded;
  if (status === "refund_pending") return c.statusRefundPending;
  if (status === "refund_unknown") return c.statusRefundUnknown;
  if (status === "refunded") return c.statusRefunded;
  return c.statusFailed;
}

function uniqueSellers(sellers: AdminPaymentSellerOption[]) {
  return Array.from(new Map(sellers.map((seller) => [seller.id, seller])).values())
    .sort((left, right) => left.shopName.localeCompare(right.shopName));
}

function cloneMethod(method: AdminPaymentMethod): AdminPaymentMethod {
  return {
    ...method,
    currencies: [...method.currencies],
    allowedProductTypes: [...method.allowedProductTypes],
    allowedSellers: method.allowedSellers.map((seller) => ({ ...seller }))
  };
}

function unavailabilityMessage(method: AdminPaymentMethod, c: (typeof copy)[Locale]) {
  if (method.unavailabilityReason === "development_only") return c.developmentOnly;
  if (method.unavailabilityReason === "missing_merchant_id") return c.missingMerchantId;
  if (method.unavailabilityReason === "missing_callback_url") return c.missingCallbackUrl;
  return c.unavailable;
}

function scopeSentence(method: AdminPaymentMethod, c: (typeof copy)[Locale], locale: Locale) {
  const types = method.allowedProductTypes.map((type) => c.allTypes[type]).join(locale === "en" ? ", " : "، ");
  const sellers = method.allowedSellers.map((seller) => seller.shopName).join(locale === "en" ? ", " : "، ");
  if (types && sellers) return c.scopeBoth.replace("{types}", types).replace("{sellers}", sellers);
  if (types) return c.scopeTypes.replace("{types}", types);
  if (sellers) return c.scopeSellers.replace("{sellers}", sellers);
  return c.scopeAll;
}

function filterLabel(
  key: keyof TransactionFilters,
  value: string,
  methods: AdminPaymentMethod[],
  sellers: AdminPaymentSellerOption[],
  c: (typeof copy)[Locale]
) {
  if (key === "status") return `${c.filterStatus}: ${statusLabel(value as PaymentTransactionStatus, c)}`;
  if (key === "providerCode") return `${c.filterProvider}: ${methods.find((method) => method.code === value)?.name ?? value}`;
  if (key === "sellerId") return `${c.filterSeller}: ${sellers.find((seller) => seller.id === value)?.shopName ?? shortId(value)}`;
  if (key === "from") return `${c.filterFrom}: ${value}`;
  if (key === "to") return `${c.filterTo}: ${value}`;
  return `${c.referenceSearch}: ${value}`;
}

function serializeMethod(method: AdminPaymentMethod) {
  return JSON.stringify({
    enabled: method.enabled,
    productTypes: [...method.allowedProductTypes].sort(),
    sellerIds: method.allowedSellers.map((seller) => seller.id).sort()
  });
}

type IconProps = { className?: string };

function SearchIcon({ className }: IconProps) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>;
}

function CheckIcon({ className }: IconProps) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 4.2 4.2L19 6.8" />
  </svg>;
}

function CloseIcon({ className }: IconProps) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>;
}

function PlusIcon({ className }: IconProps) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>;
}

function StoreIcon({ className }: IconProps) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10v9h16v-9M3 10l2-5h14l2 5" />
    <path d="M3 10a3 3 0 0 0 5 2 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 3-2M9 19v-5h6v5" />
  </svg>;
}

function AllProductsIcon({ className }: IconProps) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="6" height="6" rx="1.3" /><rect x="14" y="4" width="6" height="6" rx="1.3" />
    <rect x="4" y="14" width="6" height="6" rx="1.3" /><rect x="14" y="14" width="6" height="6" rx="1.3" />
  </svg>;
}

function ProductTypeIcon({ type }: { type: ProductType }) {
  if (type === "digital") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5" width="17" height="11" rx="2" /><path d="M8 20h8M12 16v4" />
  </svg>;
  if (type === "physical") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 8 8-4 8 4-8 4-8-4Z" /><path d="m4 8 8 4 8-4v8l-8 4-8-4V8Z" /><path d="M12 12v8" />
  </svg>;
  if (type === "service") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.7 2.7-3-3 2.7-2.7Z" />
  </svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 7h10M7 17h10M9 4 6 7l3 3M15 14l3 3-3 3" />
  </svg>;
}

function MethodSkeleton({ label }: { label: string }) {
  return (
    <div className={styles.skeleton} role="status" aria-label={label}>
      <i /><i /><i /><i />
    </div>
  );
}

function TransactionSkeleton({ label }: { label: string }) {
  return (
    <div className={styles.transactionSkeleton} role="status" aria-label={label}>
      <i /><i /><i />
    </div>
  );
}
