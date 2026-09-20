"use client";

import type { Route } from "next";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";



import { DesignIcon } from "@/components/DesignIcon";
import Link from "next/link";
import type {
  AdminProductSummary,
  AdminProductsPage,
  AdminUsdRateSettings,
  ProductKind,
  ProductStatus,
  ProductType,
  Vendor,
  VendorPermission,
  VendorStatus
} from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ProductPublicUrl } from "@/components/product/ProductPublicUrl";
import { AdminBridgeWorkspace } from "@/components/bridge/AdminBridgeWorkspace";
import { StaffWorkspace } from "@/components/admin/StaffWorkspace";
import { UsersWorkspace } from "@/components/admin/UsersWorkspace";
import { AdminBlogWorkspace } from "@/components/admin/AdminBlogWorkspace";
import { AdminOrdersWorkspace } from "@/components/admin/AdminOrdersWorkspace";
import { AdminOrderDetails } from "@/components/admin/AdminOrderDetails";
import { PaymentServiceWorkspace } from "@/components/admin/PaymentServiceWorkspace";
import { ProductChangesWorkspace } from "@/components/admin/ProductChangesWorkspace";
import { AiWorkspace } from "@/components/admin/AiWorkspace";
import { CouponWorkspace } from "@/components/admin/CouponWorkspace";
import { SmsSettingsWorkspace } from "@/components/admin/SmsSettingsWorkspace";
import { AuthLoginSettingsWorkspace } from "@/components/admin/AuthLoginSettingsWorkspace";
import { SecuritySettingsWorkspace } from "@/components/admin/SecuritySettingsWorkspace";
import { ShippingSettingsWorkspace } from "@/components/admin/ShippingSettingsWorkspace";
import { UsdSettingsWorkspace } from "@/components/admin/UsdSettingsWorkspace";
import { NoticeSettingsWorkspace } from "@/components/admin/NoticeSettingsWorkspace";
import { AdminCommentsWorkspace } from "@/components/comments/AdminCommentsWorkspace";
import type { AdminSection } from "@/components/admin/AdminPanelRoute";
import navigationStyles from "@/components/dashboard/DashboardNavigation.module.css";
import { AnalyticsOverview } from "@/components/analytics/AnalyticsOverview";



const permissionOrder: VendorPermission[] = [
  "products_manage",
  "physical_products_manage",
  "products_publish",
  "blog_manage",
  "coupons_manage",
  "orders_manage",
  "staff_manage",
  "analytics_view",
  "payouts_request"
];

const copy = {
  en: {
    admin: "Platform admin",
    navigation: "Admin navigation",
    overview: "Overview",
    statistics: "Statistics",
    users: "Users",
    vendors: "Vendors",
    sellService: "Sales service",
    paymentService: "Payment service",
    paymentTransactions: "Transactions",
    paymentMethods: "Payment methods",
    catalog: "Product catalog",
    editorial: "Editorial",
    ai: "Artificial intelligence",
    aiModels: "Models",
    aiAssistant: "AI assistant",
    settings: "Settings",
    comments: "Comments",
    security: "Security",
    rateLimit: "Rate limit",
    captcha: "CAPTCHA",
    auth: "Sign in",
    sms: "SMS",
    shipping: "Shipping",
    usd: "USD rate",
    usdAlert: "Automatic USD refresh failed",
    staff: "Platform staff",
    account: "Account",
    greeting: "Good to see you",
    skip: "Skip to vendor workspace",
    titleStart: "Vendors,",
    titleEnd: "under control.",
    subtitle: "Create vendor accounts, tune commercial terms, and grant only the access each team needs.",
    create: "Create vendor",
    total: "Total vendors",
    active: "Active now",
    restricted: "Awaiting or suspended",
    workspace: "Vendor workspace",
    workspaceHint: "Search, inspect, and manage every vendor from one place.",
    search: "Search by shop, owner, or email…",
    empty: "No vendors match this search.",
    products: "Products",
    productChanges: "Product changes",
    coupons: "Coupons",
    orders: "Orders",
    permissions: "Permissions",
    manage: "Manage vendor",
    showAccess: "Show access",
    hideAccess: "Hide access",
    newVendor: "New vendor account",
    editVendor: "Edit vendor",
    panelHint: "Account, access, and commercial settings are saved together.",
    ownerName: "Owner name",
    ownerEmail: "Owner email",
    shopName: "Shop name",
    phone: "Phone number",
    password: "Temporary password",
    optionalPassword: "New password (optional)",
    status: "Account status",
    commission: "Commission",
    holdback: "Holdback",
    accessTitle: "Vendor access",
    accessHint: "Permissions apply to this vendor account immediately after saving.",
    cancel: "Cancel",
    save: "Save changes",
    creating: "Creating vendor…",
    saving: "Saving changes…",
    created: "Vendor created successfully.",
    updated: "Vendor settings updated.",
    loadError: "Vendors could not be loaded. Refresh and try again.",
    requestError: "The request could not be completed.",
    statusActive: "Active",
    statusInvited: "Invited",
    statusSuspended: "Suspended",
    productsManage: "Manage products",
    productsManageHint: "Create, edit, publish, and archive listings.",
    physicalProductsManage: "Sell physical products",
    physicalProductsManageHint: "Grant physical inventory and seller-managed shipping setup.",
    productsPublish: "Publish without review",
    productsPublishHint: "Allow new and edited products to become public immediately.",
    blogManage: "Manage blog posts",
    blogManageHint: "Create and publish seller-authored blog posts.",
    couponsManage: "Manage coupons",
    couponsManageHint: "Create and schedule discount codes for the shop.",
    ordersManage: "Manage orders",
    ordersManageHint: "View orders and update fulfilment status.",
    staffManage: "Manage staff",
    staffManageHint: "Invite and remove vendor team members.",
    analyticsView: "View analytics",
    analyticsViewHint: "Access sales and performance reporting.",
    payoutsRequest: "Request payouts",
    payoutsRequestHint: "Submit settlement requests for review.",
    allAccess: "Full access",
    limitedAccess: "Limited access",
    catalogHint: "Review product records and open their public URLs.",
    productUrl: "Product URL",
    listings: "Listings",
    catalogEmpty: "No products have been created yet.",
    catalogLoadError: "Products could not be loaded. Refresh and try again.",
    productSearch: "Search title, URL, or category",
    allStatuses: "All statuses",
    allTypes: "All types",
    allKinds: "All structures",
    productType: "Product type",
    productKind: "Product structure",
    digital: "Digital", physical: "Physical", service: "Service", bridge: "Bridge", simple: "Simple", variable: "Variable",
    categoryFilter: "Filter category",
    sortBy: "Sort by",
    newestUpdated: "Recently updated",
    oldestUpdated: "Least recently updated",
    newestCreated: "Newest created",
    oldestCreated: "Oldest created",
    titleAscending: "Title A–Z",
    titleDescending: "Title Z–A",
    previousPage: "Previous",
    nextPage: "Next",
    page: "Page",
    noMatchingProducts: "No products match these filters.",
    loadMore: "Load more",
    editProduct: "Edit product",
    editProductHint: "Update the shared catalog record. Changes affect every seller listing for this product.",
    productTitle: "Product title",
    category: "Category",
    description: "Description",
    publishState: "Publication state",
    statusDraft: "Draft",
    statusPendingReview: "Pending review",
    statusPublished: "Published",
    statusArchived: "Archived",
    productUpdated: "Product updated successfully.",
    productUpdateError: "The product could not be updated."
  },
  fa: {
    admin: "مدیر پلتفرم",
    navigation: "ناوبری مدیریت",
    overview: "نمای کلی",
    statistics: "آمار",
    users: "کاربران",
    vendors: "فروشنده‌ها",
    sellService: "سرویس فروش",
    paymentService: "سرویس پرداخت",
    paymentTransactions: "تراکنش‌ها",
    paymentMethods: "روش‌های پرداخت",
    catalog: "کاتالوگ محصولات",
    editorial: "بلاگ",
    ai: "هوش مصنوعی",
    aiModels: "مدل‌ها",
    aiAssistant: "دستیار هوشمند",
    settings: "تنظیمات",
    comments: "دیدگاه‌ها",
    security: "امنیت",
    rateLimit: "محدودیت درخواست",
    captcha: "کپچا",
    auth: "ورود",
    sms: "پیامک",
    shipping: "ارسال",
    usd: "نرخ دلار",
    usdAlert: "به‌روزرسانی خودکار دلار ناموفق بود",
    staff: "کارکنان پلتفرم",
    account: "حساب کاربری",
    greeting: "خوش آمدید",
    skip: "رفتن به مدیریت فروشنده‌ها",
    titleStart: "فروشنده‌ها،",
    titleEnd: "کاملاً تحت کنترل.",
    subtitle: "حساب فروشنده بسازید، شرایط تجاری را تنظیم کنید و فقط دسترسی‌های لازم را به هر تیم بدهید.",
    create: "ایجاد فروشنده",
    total: "همه فروشنده‌ها",
    active: "فعال",
    restricted: "در انتظار یا تعلیق",
    workspace: "مدیریت فروشنده‌ها",
    workspaceHint: "همه فروشنده‌ها را از یک نقطه جست‌وجو، بررسی و مدیریت کنید.",
    search: "جست‌وجوی فروشگاه، مالک یا ایمیل…",
    empty: "فروشنده‌ای با این جست‌وجو پیدا نشد.",
    products: "محصول",
    productChanges: "تغییرات محصولات",
    coupons: "کدهای تخفیف",
    orders: "سفارش",
    permissions: "دسترسی‌ها",
    manage: "مدیریت فروشنده",
    showAccess: "نمایش دسترسی",
    hideAccess: "بستن دسترسی",
    newVendor: "حساب فروشنده جدید",
    editVendor: "ویرایش فروشنده",
    panelHint: "اطلاعات حساب، دسترسی‌ها و شرایط مالی با هم ذخیره می‌شوند.",
    ownerName: "نام مالک",
    ownerEmail: "ایمیل مالک",
    shopName: "نام فروشگاه",
    phone: "شماره تماس",
    password: "رمز عبور موقت",
    optionalPassword: "رمز عبور جدید (اختیاری)",
    status: "وضعیت حساب",
    commission: "کمیسیون",
    holdback: "وجه تضمین",
    accessTitle: "دسترسی فروشنده",
    accessHint: "دسترسی‌ها بلافاصله پس از ذخیره برای این فروشنده اعمال می‌شوند.",
    cancel: "انصراف",
    save: "ذخیره تغییرات",
    creating: "در حال ایجاد…",
    saving: "در حال ذخیره…",
    created: "فروشنده با موفقیت ایجاد شد.",
    updated: "تنظیمات فروشنده به‌روزرسانی شد.",
    loadError: "فهرست فروشنده‌ها بارگذاری نشد. صفحه را تازه کنید.",
    requestError: "انجام درخواست ممکن نبود.",
    statusActive: "فعال",
    statusInvited: "دعوت‌شده",
    statusSuspended: "تعلیق‌شده",
    productsManage: "مدیریت محصولات",
    productsManageHint: "ساخت، ویرایش، انتشار و بایگانی محصولات.",
    physicalProductsManage: "فروش محصولات فیزیکی",
    physicalProductsManageHint: "اجازه ثبت موجودی فیزیکی و تنظیم اطلاعات ارسال توسط فروشنده.",
    productsPublish: "انتشار بدون بررسی",
    productsPublishHint: "محصول جدید یا ویرایش‌شده را بلافاصله عمومی کنید.",
    blogManage: "مدیریت نوشته‌های وبلاگ",
    blogManageHint: "ساخت و انتشار نوشته‌های وبلاگ فروشنده.",
    couponsManage: "مدیریت کدهای تخفیف",
    couponsManageHint: "ساخت و زمان‌بندی کدهای تخفیف فروشگاه.",
    ordersManage: "مدیریت سفارش‌ها",
    ordersManageHint: "مشاهده سفارش و تغییر وضعیت ارسال.",
    staffManage: "مدیریت همکاران",
    staffManageHint: "دعوت یا حذف اعضای تیم فروشنده.",
    analyticsView: "مشاهده گزارش‌ها",
    analyticsViewHint: "دسترسی به آمار فروش و عملکرد.",
    payoutsRequest: "درخواست تسویه",
    payoutsRequestHint: "ثبت درخواست تسویه برای بررسی.",
    allAccess: "دسترسی کامل",
    limitedAccess: "دسترسی محدود",
    catalogHint: "رکوردهای محصول را بررسی کنید و نشانی عمومی آن‌ها را باز کنید.",
    productUrl: "نشانی محصول",
    listings: "فهرست‌ها",
    catalogEmpty: "هنوز محصولی ساخته نشده است.",
    catalogLoadError: "محصولات بارگذاری نشدند. صفحه را تازه کنید.",
    productSearch: "جست‌وجوی عنوان، نشانی یا دسته‌بندی",
    allStatuses: "همه وضعیت‌ها",
    allTypes: "همه نوع‌ها",
    allKinds: "همه ساختارها",
    productType: "نوع محصول",
    productKind: "ساختار محصول",
    digital: "دیجیتال", physical: "فیزیکی", service: "خدمات", bridge: "بریج", simple: "ساده", variable: "متغیر",
    categoryFilter: "فیلتر دسته‌بندی",
    sortBy: "مرتب‌سازی",
    newestUpdated: "تازه‌ترین ویرایش",
    oldestUpdated: "قدیمی‌ترین ویرایش",
    newestCreated: "جدیدترین ایجاد",
    oldestCreated: "قدیمی‌ترین ایجاد",
    titleAscending: "عنوان از آ تا ی",
    titleDescending: "عنوان از ی تا آ",
    previousPage: "قبلی",
    nextPage: "بعدی",
    page: "صفحه",
    noMatchingProducts: "محصولی با این فیلترها پیدا نشد.",
    loadMore: "بارگذاری بیشتر",
    editProduct: "ویرایش محصول",
    editProductHint: "رکورد مشترک کاتالوگ را ویرایش کنید. تغییرات روی فهرست همه فروشندگان این محصول اعمال می‌شود.",
    productTitle: "عنوان محصول",
    category: "دسته‌بندی",
    description: "توضیحات",
    publishState: "وضعیت انتشار",
    statusDraft: "پیش‌نویس",
    statusPendingReview: "در انتظار بررسی",
    statusPublished: "منتشرشده",
    statusArchived: "بایگانی‌شده",
    productUpdated: "محصول با موفقیت به‌روزرسانی شد.",
    productUpdateError: "محصول به‌روزرسانی نشد."
  },
  ar: {
    admin: "مدير المنصة",
    navigation: "تنقل الإدارة",
    overview: "نظرة عامة",
    statistics: "الإحصاءات",
    users: "المستخدمون",
    vendors: "البائعون",
    sellService: "خدمة المبيعات",
    paymentService: "خدمة الدفع",
    paymentTransactions: "المعاملات",
    paymentMethods: "طرق الدفع",
    catalog: "كتالوج المنتجات",
    editorial: "التحرير",
    ai: "الذكاء الاصطناعي",
    aiModels: "النماذج",
    aiAssistant: "المساعد الذكي",
    settings: "الإعدادات",
    comments: "التعليقات",
    security: "الأمان",
    rateLimit: "حد الطلبات",
    captcha: "التحقق البشري",
    auth: "تسجيل الدخول",
    sms: "الرسائل النصية",
    shipping: "الشحن",
    usd: "سعر الدولار",
    usdAlert: "فشل التحديث التلقائي للدولار",
    staff: "فريق المنصة",
    account: "الحساب",
    greeting: "مرحباً بعودتك",
    skip: "انتقل إلى إدارة البائعين",
    titleStart: "البائعون،",
    titleEnd: "تحت السيطرة.",
    subtitle: "أنشئ حسابات البائعين واضبط الشروط التجارية وامنح كل فريق الصلاحيات التي يحتاجها فقط.",
    create: "إنشاء بائع",
    total: "جميع البائعين",
    active: "نشط الآن",
    restricted: "بانتظار الدعوة أو موقوف",
    workspace: "إدارة البائعين",
    workspaceHint: "ابحث وافحص وأدر جميع البائعين من مكان واحد.",
    search: "البحث بالمتجر أو المالك أو البريد…",
    empty: "لا يوجد بائع يطابق هذا البحث.",
    products: "المنتجات",
    productChanges: "تغييرات المنتجات",
    coupons: "القسائم",
    orders: "الطلبات",
    permissions: "الصلاحيات",
    manage: "إدارة البائع",
    showAccess: "عرض الصلاحيات",
    hideAccess: "إخفاء الصلاحيات",
    newVendor: "حساب بائع جديد",
    editVendor: "تعديل البائع",
    panelHint: "يتم حفظ الحساب والصلاحيات والإعدادات التجارية معاً.",
    ownerName: "اسم المالك",
    ownerEmail: "بريد المالك",
    shopName: "اسم المتجر",
    phone: "رقم الهاتف",
    password: "كلمة مرور مؤقتة",
    optionalPassword: "كلمة مرور جديدة (اختياري)",
    status: "حالة الحساب",
    commission: "العمولة",
    holdback: "الحجز",
    accessTitle: "صلاحيات البائع",
    accessHint: "تطبق الصلاحيات على حساب البائع فور الحفظ.",
    cancel: "إلغاء",
    save: "حفظ التغييرات",
    creating: "جارٍ الإنشاء…",
    saving: "جارٍ الحفظ…",
    created: "تم إنشاء البائع بنجاح.",
    updated: "تم تحديث إعدادات البائع.",
    loadError: "تعذر تحميل البائعين. حدّث الصفحة وحاول مجدداً.",
    requestError: "تعذر إكمال الطلب.",
    statusActive: "نشط",
    statusInvited: "مدعو",
    statusSuspended: "موقوف",
    productsManage: "إدارة المنتجات",
    productsManageHint: "إنشاء القوائم وتعديلها ونشرها وأرشفتها.",
    physicalProductsManage: "بيع المنتجات المادية",
    physicalProductsManageHint: "منح إدارة المخزون المادي وإعداد الشحن بواسطة البائع.",
    productsPublish: "النشر دون مراجعة",
    productsPublishHint: "السماح بنشر المنتجات الجديدة والمعدلة فوراً.",
    blogManage: "إدارة مقالات المدونة",
    blogManageHint: "إنشاء ونشر مقالات المدونة الخاصة بالبائع.",
    couponsManage: "إدارة القسائم",
    couponsManageHint: "إنشاء رموز خصم للمتجر وجدولتها.",
    ordersManage: "إدارة الطلبات",
    ordersManageHint: "عرض الطلبات وتحديث حالة التنفيذ.",
    staffManage: "إدارة الفريق",
    staffManageHint: "دعوة أعضاء فريق البائع أو إزالتهم.",
    analyticsView: "عرض التحليلات",
    analyticsViewHint: "الوصول إلى تقارير المبيعات والأداء.",
    payoutsRequest: "طلب الدفعات",
    payoutsRequestHint: "إرسال طلبات التسوية للمراجعة.",
    allAccess: "صلاحيات كاملة",
    limitedAccess: "صلاحيات محدودة",
    catalogHint: "راجع سجلات المنتجات وافتح روابطها العامة.",
    productUrl: "رابط المنتج",
    listings: "القوائم",
    catalogEmpty: "لم يتم إنشاء أي منتج بعد.",
    catalogLoadError: "تعذر تحميل المنتجات. حدّث الصفحة وحاول مجدداً.",
    productSearch: "ابحث بالعنوان أو الرابط أو الفئة",
    allStatuses: "كل الحالات",
    allTypes: "كل الأنواع",
    allKinds: "كل البنى",
    productType: "نوع المنتج",
    productKind: "بنية المنتج",
    digital: "رقمي", physical: "مادي", service: "خدمة", bridge: "جسر", simple: "بسيط", variable: "متغير",
    categoryFilter: "تصفية الفئة",
    sortBy: "ترتيب حسب",
    newestUpdated: "آخر تحديث",
    oldestUpdated: "أقدم تحديث",
    newestCreated: "الأحدث إنشاءً",
    oldestCreated: "الأقدم إنشاءً",
    titleAscending: "العنوان تصاعدياً",
    titleDescending: "العنوان تنازلياً",
    previousPage: "السابق",
    nextPage: "التالي",
    page: "صفحة",
    noMatchingProducts: "لا توجد منتجات تطابق هذه المرشحات.",
    loadMore: "تحميل المزيد",
    editProduct: "تعديل المنتج",
    editProductHint: "حدّث سجل الكتالوج المشترك. تؤثر التغييرات على قوائم جميع البائعين لهذا المنتج.",
    productTitle: "اسم المنتج",
    category: "الفئة",
    description: "الوصف",
    publishState: "حالة النشر",
    statusDraft: "مسودة",
    statusPendingReview: "قيد المراجعة",
    statusPublished: "منشور",
    statusArchived: "مؤرشف",
    productUpdated: "تم تحديث المنتج بنجاح.",
    productUpdateError: "تعذر تحديث المنتج."
  }
} as const;

type Copy = (typeof copy)["en"];

type VendorFormState = {
  ownerName: string;
  ownerEmail: string;
  shopName: string;
  phoneNumber: string;
  password: string;
  status: VendorStatus;
  commission: string;
  holdbackRate: string;
  blogReviewRequired: boolean;
  permissions: VendorPermission[];
};

const emptyForm: VendorFormState = {
  ownerName: "",
  ownerEmail: "",
  shopName: "",
  phoneNumber: "",
  password: "",
  status: "active",
  commission: "10",
  holdbackRate: "5",
  blogReviewRequired: true,
  permissions: ["products_manage", "products_publish", "blog_manage", "coupons_manage", "orders_manage", "analytics_view"]
};

const permissionCopy: Record<
  VendorPermission,
  { title: keyof Copy; hint: keyof Copy }
> = {
  products_manage: { title: "productsManage", hint: "productsManageHint" },
  physical_products_manage: { title: "physicalProductsManage", hint: "physicalProductsManageHint" },
  products_publish: { title: "productsPublish", hint: "productsPublishHint" },
  blog_manage: { title: "blogManage", hint: "blogManageHint" },
  coupons_manage: { title: "couponsManage", hint: "couponsManageHint" },
  orders_manage: { title: "ordersManage", hint: "ordersManageHint" },
  staff_manage: { title: "staffManage", hint: "staffManageHint" },
  analytics_view: { title: "analyticsView", hint: "analyticsViewHint" },
  payouts_request: { title: "payoutsRequest", hint: "payoutsRequestHint" }
};

function formFromVendor(vendor: Vendor): VendorFormState {
  return {
    ownerName: vendor.ownerName,
    ownerEmail: vendor.ownerEmail,
    shopName: vendor.shopName,
    phoneNumber: vendor.phoneNumber ?? "",
    password: "",
    status: vendor.status,
    commission: String(vendor.commission * 100),
    holdbackRate: String(vendor.holdbackRate * 100),
    blogReviewRequired: vendor.blogReviewRequired,
    permissions: [...vendor.permissions]
  };
}

function requestMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (error as { response?: { data?: { message?: string | string[] } } })
      .response;
    const message = response?.data?.message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string") return message;
  }
  return fallback;
}

export function VendorManagement({
  locale,
  adminName,
  section,
  orderId,
  ownerNavigation
}: {
  locale: Locale;
  adminName: string;
  section: AdminSection;
  orderId?: string;
  ownerNavigation: boolean;
}) {
  const c = copy[locale];
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLElement>(null);
  const panelTrigger = useRef<HTMLButtonElement | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [products, setProducts] = useState<AdminProductSummary[]>([]);
  const [productsCursor, setProductsCursor] = useState<string | null>(null);
  const [productPageCursors, setProductPageCursors] = useState<Array<string | null>>([null]);
  const [productPage, setProductPage] = useState(0);
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [debouncedProductCategory, setDebouncedProductCategory] = useState("");
  const [productStatus, setProductStatus] = useState<ProductStatus | "">("");
  const [productType, setProductType] = useState<ProductType | "">("");
  const [productKind, setProductKind] = useState<ProductKind | "">("");
  const [productSort, setProductSort] = useState("updated_desc");
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const productRequestId = useRef(0);
  const [usersOpen, setUsersOpen] = useState(false);
  const [salesServiceOpen, setSalesServiceOpen] = useState(false);
  const [paymentServiceOpen, setPaymentServiceOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [usdRateFailed, setUsdRateFailed] = useState(false);
  const isUsersSection = section === "vendors" || section === "staff" || section === "users";
  const usersExpanded = isUsersSection || usersOpen;
  const isSalesServiceSection = section === "products" || section === "product-changes" || section === "coupons" || section === "orders" || section === "order-detail";
  const salesServiceExpanded = isSalesServiceSection || salesServiceOpen;
  const isPaymentServiceSection = section === "payment-transactions" || section === "payment-methods";
  const paymentServiceExpanded = isPaymentServiceSection || paymentServiceOpen;
  const isAiSection = section === "ai-models" || section === "ai-assistant";
  const aiExpanded = isAiSection || aiOpen;
  const isSettingsSection = section === "settings-sms" || section === "settings-shipping" || section === "settings-usd" || section === "settings-comments" || section === "settings-notice";
  const settingsExpanded = isSettingsSection || settingsOpen;
  const isSecuritySection = section === "security-rate-limit" || section === "security-login" || section === "security-captcha";
  const securityExpanded = isSecuritySection || securityOpen;

  useEffect(() => {
    if (!ownerNavigation) return;
    let active = true;
    const checkUsdRate = async () => {
      try {
        const response = await api.get<AdminUsdRateSettings>("/admin/settings/usd");
        if (active) setUsdRateFailed(response.data.cronStatus === "failed");
      } catch {
        // The settings workspace owns full request errors; navigation only mirrors a persisted cron failure.
      }
    };
    void checkUsdRate();
    const timer = window.setInterval(() => void checkUsdRate(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [ownerNavigation]);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<Vendor[]>("/seller/vendors");
      setVendors(response.data);
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }, [c.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedProductSearch(productSearch.trim());
      setDebouncedProductCategory(productCategory.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [productSearch, productCategory]);

  const loadProducts = useCallback(async (cursor: string | null = null, page = 0) => {
    const requestId = ++productRequestId.current;
    setProductsLoading(true);
    setProductsError("");
    try {
      const response = await api.get<AdminProductsPage>("/products/admin", {
        params: { limit: 20, ...(cursor ? { cursor } : {}),
          ...(debouncedProductSearch ? { search: debouncedProductSearch } : {}),
          ...(debouncedProductCategory ? { category: debouncedProductCategory } : {}),
          ...(productStatus ? { status: productStatus } : {}),
          ...(productType ? { type: productType } : {}),
          ...(productKind ? { kind: productKind } : {}), sort: productSort }
      });
      if (requestId !== productRequestId.current) return;
      setProducts(response.data.items);
      setProductsCursor(response.data.nextCursor);
      setProductPage(page);
      setProductPageCursors((current) => page === 0 ? [null] : current.slice(0, page + 1));
    } catch {
      if (requestId !== productRequestId.current) return;
      setProductsError(c.catalogLoadError);
    } finally {
      if (requestId === productRequestId.current) setProductsLoading(false);
    }
  }, [c.catalogLoadError, debouncedProductSearch, debouncedProductCategory, productStatus, productType, productKind, productSort]);

  const closePanel = useCallback(() => {
    setPanelMode(null);
    setEditingId(null);
    window.requestAnimationFrame(() => panelTrigger.current?.focus());
  }, []);

  useEffect(() => {
    const loadFrame = window.requestAnimationFrame(() => {
      if (section === "vendors") void loadVendors();
      if (section === "products") void loadProducts();
    });
    return () => window.cancelAnimationFrame(loadFrame);
  }, [loadProducts, loadVendors, section]);

  useEffect(() => {
    if (!panelMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        closePanel();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;

      const focusable = Array.from(
        panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const focusFrame = window.requestAnimationFrame(() => {
      if (panel.current?.contains(document.activeElement)) return;
      const selector = window.matchMedia("(min-width: 761px)").matches
        ? "input"
        : "button";
      panel.current?.querySelector<HTMLElement>(selector)?.focus();
    });
    document.body.classList.add("admin-panel-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.classList.remove("admin-panel-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closePanel, panelMode, submitting]);

  const filteredVendors = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    if (!needle) return vendors;
    return vendors.filter((vendor) =>
      [vendor.shopName, vendor.ownerName, vendor.ownerEmail].some((value) =>
        value.toLocaleLowerCase(locale).includes(needle)
      )
    );
  }, [locale, query, vendors]);

  function openCreate(trigger: HTMLButtonElement) {
    panelTrigger.current = trigger;
    setForm({ ...emptyForm, permissions: [...emptyForm.permissions] });
    setEditingId(null);
    setPanelMode("create");
    setError("");
    setMessage("");
  }

  function openEdit(vendor: Vendor, trigger: HTMLButtonElement) {
    panelTrigger.current = trigger;
    setForm(formFromVendor(vendor));
    setEditingId(vendor.id);
    setPanelMode("edit");
    setError("");
    setMessage("");
  }

  function updateField<K extends keyof VendorFormState>(
    field: K,
    value: VendorFormState[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function togglePermission(permission: VendorPermission) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission]
    }));
  }

  async function submitVendor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    const payload = {
      ownerName: form.ownerName,
      ownerEmail: form.ownerEmail,
      shopName: form.shopName,
      phoneNumber: form.phoneNumber,
      ...(form.password ? { password: form.password } : {}),
      status: form.status,
      commission: Number(form.commission) / 100,
      holdbackRate: Number(form.holdbackRate) / 100,
      blogReviewRequired: form.blogReviewRequired,
      permissions: form.permissions
    };

    try {
      const response = panelMode === "create"
        ? await api.post<Vendor>("/seller/vendors", payload)
        : await api.patch<Vendor>(`/seller/vendors/${editingId}`, payload);
      setVendors((current) => {
        if (panelMode === "create") return [response.data, ...current];
        return current.map((vendor) =>
          vendor.id === response.data.id ? response.data : vendor
        );
      });
      setMessage(panelMode === "create" ? c.created : c.updated);
      closePanel();
    } catch (requestError) {
      setError(requestMessage(requestError, c.requestError));
    } finally {
      setSubmitting(false);
    }
  }

  function statusLabel(status: VendorStatus) {
    if (status === "active") return c.statusActive;
    if (status === "suspended") return c.statusSuspended;
    return c.statusInvited;
  }

  return (
    <div className="admin-dashboard-shell">
      <a className="skip-link" href="#admin-content">{c.skip}</a>
      <aside className="admin-rail">
        <Link className="admin-brand" href={`/${locale}`} aria-label="Top GSM">
          <span className="admin-brand-symbol"><DesignIcon name="layers" /></span>
          <span dir="ltr" translate="no">topgsm.</span>
        </Link>
        <nav className={navigationStyles.navigation} aria-label={c.navigation}>
          {ownerNavigation ? <>
          <Link
            className={navigationStyles.item}
            href={`/${locale}/admin`}
            aria-current={section === "overview" ? "page" : undefined}
          >
            <OverviewIcon />
            <span>{c.overview}</span>
          </Link>
          <Link className={navigationStyles.item} href={`/${locale}/admin/statistics` as Route} aria-current={section === "statistics" ? "page" : undefined}>
            <StatisticsIcon />
            <span>{c.statistics}</span>
          </Link>
          <div
            className={navigationStyles.group}
            data-active={isUsersSection}
            data-open={usersExpanded}
          >
            <button
              className={navigationStyles.groupTrigger}
              type="button"
              aria-expanded={usersExpanded}
              aria-controls="admin-users-navigation"
              onClick={() => setUsersOpen((current) => !current)}
            >
              <UsersGroupIcon />
              <span>{c.users}</span>
              <span className={navigationStyles.chevron} aria-hidden="true">⌄</span>
            </button>
            <div className={navigationStyles.subNavigation} id="admin-users-navigation">
              <Link
                className={navigationStyles.item}
                href={`/${locale}/admin/vendors` as Route}
                aria-current={section === "vendors" ? "page" : undefined}
              >
                <VendorsIcon />
                <span>{c.vendors}</span>
              </Link>
              <Link
                className={navigationStyles.item}
                href={`/${locale}/admin/staff` as Route}
                aria-current={section === "staff" ? "page" : undefined}
              >
                <StaffIcon />
                <span>{c.staff}</span>
              </Link>
              <Link
                className={navigationStyles.item}
                href={`/${locale}/admin/users` as Route}
                aria-current={section === "users" ? "page" : undefined}
              >
                <CustomersIcon />
                <span>{c.users}</span>
              </Link>
            </div>
          </div>
          <div
            className={navigationStyles.group}
            data-active={isSalesServiceSection}
            data-open={salesServiceExpanded}
          >
            <button
              className={navigationStyles.groupTrigger}
              type="button"
              aria-expanded={salesServiceExpanded}
              aria-controls="admin-sales-service-navigation"
              onClick={() => setSalesServiceOpen((current) => !current)}
            >
              <SalesServiceIcon />
              <span>{c.sellService}</span>
              <span className={navigationStyles.chevron} aria-hidden="true">⌄</span>
            </button>
            <div className={navigationStyles.subNavigation} id="admin-sales-service-navigation">
              <Link
                className={navigationStyles.item}
                href={`/${locale}/admin/products` as Route}
                aria-current={section === "products" ? "page" : undefined}
              >
                <ProductsIcon />
                <span>{c.products}</span>
              </Link>
              <Link
                className={navigationStyles.item}
                href={`/${locale}/admin/product-changes` as Route}
                aria-current={section === "product-changes" ? "page" : undefined}
              >
                <ProductChangesIcon />
                <span>{c.productChanges}</span>
              </Link>
              <Link
                className={navigationStyles.item}
                href={`/${locale}/admin/coupons` as Route}
                aria-current={section === "coupons" ? "page" : undefined}
              >
                <CouponIcon />
                <span>{c.coupons}</span>
              </Link>
              <Link
                className={navigationStyles.item}
                href={`/${locale}/admin/orders` as Route}
                aria-current={section === "orders" || section === "order-detail" ? "page" : undefined}
              >
                <OrdersIcon />
                <span>{c.orders}</span>
              </Link>
            </div>
          </div>
          <div
            className={navigationStyles.group}
            data-active={isPaymentServiceSection}
            data-open={paymentServiceExpanded}
          >
            <button
              className={navigationStyles.groupTrigger}
              type="button"
              aria-expanded={paymentServiceExpanded}
              aria-controls="admin-payment-service-navigation"
              onClick={() => setPaymentServiceOpen((current) => !current)}
            >
              <PaymentServiceIcon />
              <span>{c.paymentService}</span>
              <span className={navigationStyles.chevron} aria-hidden="true">⌄</span>
            </button>
            <div className={navigationStyles.subNavigation} id="admin-payment-service-navigation">
              <Link
                className={navigationStyles.item}
                href={`/${locale}/admin/payments/transactions` as Route}
                aria-current={section === "payment-transactions" ? "page" : undefined}
              >
                <TransactionsIcon />
                <span>{c.paymentTransactions}</span>
              </Link>
              <Link
                className={navigationStyles.item}
                href={`/${locale}/admin/payments/methods` as Route}
                aria-current={section === "payment-methods" ? "page" : undefined}
              >
                <PaymentMethodsIcon />
                <span>{c.paymentMethods}</span>
              </Link>
            </div>
          </div>
          </> : null}
          <Link className={navigationStyles.item} href={`/${locale}/admin/blog` as Route} aria-current={section === "editorial" ? "page" : undefined}>
            <EditorialIcon />
            <span>{c.editorial}</span>
          </Link>
          {ownerNavigation ? <>
          <div
            className={navigationStyles.group}
            data-active={isAiSection}
            data-open={aiExpanded}
          >
            <button
              className={navigationStyles.groupTrigger}
              type="button"
              aria-expanded={aiExpanded}
              aria-controls="admin-ai-navigation"
              onClick={() => setAiOpen((current) => !current)}
            >
              <AiServiceIcon />
              <span>{c.ai}</span>
              <span className={navigationStyles.chevron} aria-hidden="true">⌄</span>
            </button>
            <div className={navigationStyles.subNavigation} id="admin-ai-navigation">
              <Link className={navigationStyles.item} href={`/${locale}/admin/ai/models` as Route} aria-current={section === "ai-models" ? "page" : undefined}>
                <AiModelsIcon />
                <span>{c.aiModels}</span>
              </Link>
              <Link className={navigationStyles.item} href={`/${locale}/admin/ai/assistant` as Route} aria-current={section === "ai-assistant" ? "page" : undefined}>
                <AiAssistantIcon />
                <span>{c.aiAssistant}</span>
              </Link>
            </div>
          </div>
          <div
            className={navigationStyles.group}
            data-active={isSettingsSection}
            data-open={settingsExpanded}
          >
            <button
              className={navigationStyles.groupTrigger}
              type="button"
              aria-expanded={settingsExpanded}
              aria-controls="admin-settings-navigation"
              onClick={() => setSettingsOpen((current) => !current)}
            >
              <SettingsIcon />
              <span>{c.settings}</span>
              <span className={navigationStyles.chevron} aria-hidden="true">⌄</span>
            </button>
            <div className={navigationStyles.subNavigation} id="admin-settings-navigation">
              <Link className={navigationStyles.item} href={`/${locale}/admin/settings/notice` as Route} aria-current={section === "settings-notice" ? "page" : undefined}>
                <EditorialIcon /><span>{locale === "fa" ? "اطلاعیه" : locale === "ar" ? "الإشعار" : "Notice"}</span>
              </Link>
              <Link className={navigationStyles.item} href={`/${locale}/admin/settings/comments` as Route} aria-current={section === "settings-comments" ? "page" : undefined}>
                <EditorialIcon /><span>{c.comments}</span>
              </Link>
              <Link
                className={navigationStyles.item}
                href={`/${locale}/admin/settings/shipping` as Route}
                aria-current={section === "settings-shipping" ? "page" : undefined}
              >
                <ShippingIcon />
                <span>{c.shipping}</span>
              </Link>
              <Link
                className={navigationStyles.item}
                href={`/${locale}/admin/settings/sms` as Route}
                aria-current={section === "settings-sms" ? "page" : undefined}
              >
                <SmsIcon />
                <span>{c.sms}</span>
              </Link>
              <Link
                className={navigationStyles.item}
                href={`/${locale}/admin/settings/usd` as Route}
                aria-current={section === "settings-usd" ? "page" : undefined}
                data-alert={usdRateFailed}
              >
                <UsdIcon />
                <span>{c.usd}</span>
                {usdRateFailed ? <strong className={navigationStyles.alert} aria-label={c.usdAlert} title={c.usdAlert}>!</strong> : null}
              </Link>
            </div>
          </div>
          <div className={navigationStyles.group} data-active={isSecuritySection} data-open={securityExpanded}>
            <button className={navigationStyles.groupTrigger} type="button" aria-expanded={securityExpanded} aria-controls="admin-security-navigation" onClick={() => setSecurityOpen((current) => !current)}>
              <SettingsIcon /><span>{c.security}</span><span className={navigationStyles.chevron} aria-hidden="true">⌄</span>
            </button>
            <div className={navigationStyles.subNavigation} id="admin-security-navigation">
              <Link className={navigationStyles.item} href={`/${locale}/admin/security/rate-limit` as Route} aria-current={section === "security-rate-limit" ? "page" : undefined}><SettingsIcon /><span>{c.rateLimit}</span></Link>
              <Link className={navigationStyles.item} href={`/${locale}/admin/security/login` as Route} aria-current={section === "security-login" ? "page" : undefined}><SettingsIcon /><span>{c.auth}</span></Link>
              <Link className={navigationStyles.item} href={`/${locale}/admin/security/captcha` as Route} aria-current={section === "security-captcha" ? "page" : undefined}><SettingsIcon /><span>{c.captcha}</span></Link>
            </div>
          </div>
          {process.env.NEXT_PUBLIC_BRIDGE_FEATURE_ENABLED === "true" ? (
            <Link className={navigationStyles.item} href={`/${locale}/admin/bridge` as Route} aria-current={section === "bridge" ? "page" : undefined}>
              <BridgeIcon />
              <span>Bridge</span>
            </Link>
          ) : null}
          </> : null}
        </nav>
        <div className="admin-rail-account">
          <span>{c.account}</span>
          <div className="admin-identity">
            <span>{ownerNavigation ? c.admin : c.staff}</span>
            <strong>{adminName}</strong>
          </div>
          <LogoutButton locale={locale} />
        </div>
      </aside>

      <main className="admin-shell" id="admin-content" ref={root}>

      {section === "overview" ? <AnalyticsOverview locale={locale} audience="admin" compact /> : null}
      {section === "statistics" ? <AnalyticsOverview locale={locale} audience="admin" /> : null}

      {section === "vendors" ? <section className="vendor-workspace grid-flow-dense" data-vendor-workspace>
        <aside className="vendor-workspace-intro" data-admin-summary>
          <h2>{c.workspace}</h2>
          <p>{c.workspaceHint}</p>
          <button className="admin-primary-button" type="button" onClick={(event) => openCreate(event.currentTarget)}>
            <PlusIcon />
            {c.create}
          </button>
          <label className="vendor-search">
            <SearchIcon />
            <span className="sr-only">{c.search}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={c.search}
              name="vendorSearch"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </aside>

        <div className="vendor-list" aria-busy={loading}>
          {error && !panelMode ? <p className="admin-notice is-error" role="alert">{error}</p> : null}
          {message ? <p className="admin-notice is-success" role="status">{message}</p> : null}
          {loading ? <VendorSkeleton /> : null}
          {!loading && filteredVendors.length === 0 ? (
            <div className="vendor-empty">
              <span>0</span>
              <p>{c.empty}</p>
            </div>
          ) : null}
          {filteredVendors.map((vendor) => {
            const expanded = expandedId === vendor.id;
            return (
              <article className="vendor-card" key={vendor.id} data-vendor-card>
                <div className="vendor-card-main">
                  <div className="vendor-avatar" aria-hidden="true">
                    {vendor.shopName.trim().slice(0, 2).toLocaleUpperCase(locale)}
                  </div>
                  <div className="vendor-primary">
                    <div>
                      <h3>{vendor.shopName}</h3>
                      <span className={`vendor-status is-${vendor.status}`}>
                        <i />{statusLabel(vendor.status)}
                      </span>
                    </div>
                    <p>{vendor.ownerName} · <span translate="no">{vendor.ownerEmail}</span></p>
                  </div>
                  <dl className="vendor-stats">
                    <div><dt>{c.products}</dt><dd>{vendor.productCount}</dd></div>
                    <div><dt>{c.orders}</dt><dd>{vendor.orderCount}</dd></div>
                    <div><dt>{c.permissions}</dt><dd>{vendor.permissions.length}/{permissionOrder.length}</dd></div>
                  </dl>
                  <button className="vendor-manage-button" type="button" onClick={(event) => openEdit(vendor, event.currentTarget)}>
                    {c.manage}<ArrowIcon />
                  </button>
                </div>
                <button
                  className="vendor-disclosure"
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`vendor-access-${vendor.id}`}
                  onClick={() => setExpandedId(expanded ? null : vendor.id)}
                >
                  <span>{vendor.permissions.length === permissionOrder.length ? c.allAccess : c.limitedAccess}</span>
                  <span>{expanded ? c.hideAccess : c.showAccess}</span>
                  <ChevronIcon />
                </button>
                <div
                  className="vendor-access-accordion"
                  id={`vendor-access-${vendor.id}`}
                  data-expanded={expanded}
                  aria-hidden={!expanded}
                >
                  <div>
                    {permissionOrder.map((permission) => (
                      <span
                        key={permission}
                        className={vendor.permissions.includes(permission) ? "is-granted" : ""}
                      >
                        <CheckIcon />
                        {c[permissionCopy[permission].title]}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section> : null}

      {section === "products" ? <section className="admin-product-catalog" aria-labelledby="admin-products-title">
        <header>
          <div>
            <h2 id="admin-products-title">{c.catalog}</h2>
            <p>{c.catalogHint}</p>
          </div>
        </header>
        <div className="admin-product-filters">
          <label><span>{c.productSearch}</span><input type="search" maxLength={100} value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /></label>
          <label><span>{c.categoryFilter}</span><input maxLength={100} value={productCategory} onChange={(event) => setProductCategory(event.target.value)} /></label>
          <label><span>{c.status}</span><select value={productStatus} onChange={(event) => setProductStatus(event.target.value as ProductStatus | "")}><option value="">{c.allStatuses}</option><option value="draft">{c.statusDraft}</option><option value="pending_review">{c.statusPendingReview}</option><option value="active">{c.statusPublished}</option><option value="archived">{c.statusArchived}</option></select></label>
          <label><span>{c.productType}</span><select value={productType} onChange={(event) => setProductType(event.target.value as ProductType | "")}><option value="">{c.allTypes}</option><option value="digital">{c.digital}</option><option value="physical">{c.physical}</option><option value="service">{c.service}</option><option value="bridge">{c.bridge}</option></select></label>
          <label><span>{c.productKind}</span><select value={productKind} onChange={(event) => setProductKind(event.target.value as ProductKind | "")}><option value="">{c.allKinds}</option><option value="simple">{c.simple}</option><option value="variable">{c.variable}</option></select></label>
          <label><span>{c.sortBy}</span><select value={productSort} onChange={(event) => setProductSort(event.target.value)}><option value="updated_desc">{c.newestUpdated}</option><option value="updated_asc">{c.oldestUpdated}</option><option value="created_desc">{c.newestCreated}</option><option value="created_asc">{c.oldestCreated}</option><option value="title_asc">{c.titleAscending}</option><option value="title_desc">{c.titleDescending}</option></select></label>
        </div>
        {productsError ? <p className="admin-notice is-error" role="alert">{productsError}</p> : null}
        {!productsLoading && !products.length ? <p className="vendor-empty">{productSearch || productCategory || productStatus || productType || productKind ? c.noMatchingProducts : c.catalogEmpty}</p> : null}
        {products.length ? (
          <div className="admin-product-list">
            {products.map((product) => (
              <article className="admin-product-row" key={product.id}>
                <div>
                  <h3>{product.title}</h3>
                  <span>{product.category ?? product.type}</span>
                </div>
                <ProductPublicUrl
                  className="admin-product-url"
                  locale={locale}
                  slug={product.slug}
                  label={`${c.productUrl} — ${product.title}`}
                />
                <dl>
                  <div><dt>{c.listings}</dt><dd>{product.listingCount}</dd></div>
                  <div><dt>{c.status}</dt><dd>{product.status}</dd></div>
                </dl>
                <Link
                  className="admin-secondary-button admin-product-edit"
                  href={`/${locale}/admin/products/${product.id}` as Route}
                >
                  {c.editProduct}
                </Link>
              </article>
            ))}
          </div>
        ) : null}
        <nav className="admin-product-pagination" aria-label={c.catalog}>
          <button className="admin-secondary-button" type="button" disabled={productsLoading || productPage === 0} onClick={() => void loadProducts(productPageCursors[productPage - 1], productPage - 1)}>{c.previousPage}</button>
          <span aria-live="polite">{c.page} {productPage + 1}</span>
          <button className="admin-secondary-button" type="button" disabled={productsLoading || !productsCursor} onClick={() => { if (!productsCursor) return; setProductPageCursors((current) => [...current.slice(0, productPage + 1), productsCursor]); void loadProducts(productsCursor, productPage + 1); }}>{c.nextPage}</button>
        </nav>
      </section> : null}

      {section === "product-changes" ? <ProductChangesWorkspace locale={locale} /> : null}

      {section === "coupons" ? <CouponWorkspace locale={locale} /> : null}

      {section === "orders" ? <AdminOrdersWorkspace locale={locale} /> : null}
      {section === "order-detail" && orderId ? <AdminOrderDetails locale={locale} orderId={orderId} /> : null}

      {section === "payment-transactions" ? <PaymentServiceWorkspace locale={locale} view="transactions" /> : null}

      {section === "payment-methods" ? <PaymentServiceWorkspace locale={locale} view="methods" /> : null}

      {section === "staff" ? <StaffWorkspace locale={locale} /> : null}

      {section === "users" ? <UsersWorkspace locale={locale} /> : null}

      {section === "bridge" ? <AdminBridgeWorkspace locale={locale} /> : null}

      {section === "editorial" ? <AdminBlogWorkspace locale={locale} /> : null}
      {section === "ai-models" ? <AiWorkspace locale={locale} view="models" /> : null}
      {section === "ai-assistant" ? <AiWorkspace locale={locale} view="assistant" /> : null}
      {section === "settings-sms" ? <SmsSettingsWorkspace locale={locale} /> : null}
      {section === "security-login" ? <AuthLoginSettingsWorkspace locale={locale} /> : null}
      {section === "security-rate-limit" ? <SecuritySettingsWorkspace locale={locale} view="rate-limit" /> : null}
      {section === "security-captcha" ? <SecuritySettingsWorkspace locale={locale} view="captcha" /> : null}
      {section === "settings-shipping" ? <ShippingSettingsWorkspace locale={locale} /> : null}
      {section === "settings-usd" ? <UsdSettingsWorkspace locale={locale} /> : null}
      {section === "settings-comments" ? <AdminCommentsWorkspace locale={locale} /> : null}
      {section === "settings-notice" ? <NoticeSettingsWorkspace locale={locale} /> : null}

      {panelMode ? (
        <div className="vendor-panel-layer" role="presentation">
          <button className="vendor-panel-scrim" type="button" aria-label={c.cancel} onClick={closePanel} />
          <section ref={panel} className="vendor-panel" role="dialog" aria-modal="true" aria-labelledby="vendor-panel-title">
            <header>
              <div>
                <h2 id="vendor-panel-title">{panelMode === "create" ? c.newVendor : c.editVendor}</h2>
                <p>{c.panelHint}</p>
              </div>
              <button className="vendor-panel-close" type="button" onClick={closePanel} aria-label={c.cancel}>
                <CloseIcon />
              </button>
            </header>
            <form onSubmit={submitVendor}>
              <div className="vendor-form-grid">
                <Field name="shopName" label={c.shopName} value={form.shopName} onChange={(value) => updateField("shopName", value)} autoComplete="off" />
                <Field name="ownerName" label={c.ownerName} value={form.ownerName} onChange={(value) => updateField("ownerName", value)} autoComplete="name" />
                <Field name="ownerEmail" label={c.ownerEmail} type="email" value={form.ownerEmail} onChange={(value) => updateField("ownerEmail", value)} autoComplete="email" spellCheck={false} />
                <Field name="phoneNumber" label={c.phone} type="tel" value={form.phoneNumber} onChange={(value) => updateField("phoneNumber", value)} required={false} autoComplete="tel" />
                <Field
                  name="password"
                  label={panelMode === "create" ? c.password : c.optionalPassword}
                  type="password"
                  value={form.password}
                  onChange={(value) => updateField("password", value)}
                  required={panelMode === "create"}
                  minLength={8}
                  autoComplete="new-password"
                  spellCheck={false}
                />
                <label className="vendor-field">
                  <span>{c.status}</span>
                  <select name="status" value={form.status} onChange={(event) => updateField("status", event.target.value as VendorStatus)}>
                    <option value="active">{c.statusActive}</option>
                    <option value="invited">{c.statusInvited}</option>
                    <option value="suspended">{c.statusSuspended}</option>
                  </select>
                </label>
                <PercentField name="commission" label={c.commission} value={form.commission} onChange={(value) => updateField("commission", value)} />
                <PercentField name="holdbackRate" label={c.holdback} value={form.holdbackRate} onChange={(value) => updateField("holdbackRate", value)} />
              </div>

              <fieldset className="permission-fieldset">
                <legend>{c.accessTitle}</legend>
                <p>{c.accessHint}</p>
                <div className="permission-list">
                  {permissionOrder.map((permission) => (
                    <label key={permission} className="permission-option">
                      <span>
                        <strong>{c[permissionCopy[permission].title]}</strong>
                        <small>{c[permissionCopy[permission].hint]}</small>
                      </span>
                      <input
                        type="checkbox"
                        name="permissions"
                        value={permission}
                        checked={form.permissions.includes(permission)}
                        onChange={() => togglePermission(permission)}
                      />
                      <i aria-hidden="true" />
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="permission-fieldset">
                <legend>{locale === "fa" ? "سیاست انتشار وبلاگ" : locale === "ar" ? "سياسة نشر المدونة" : "Blog publishing policy"}</legend>
                <p>{locale === "fa" ? "بررسی پیش از انتشار به‌صورت پیش‌فرض فعال است." : locale === "ar" ? "المراجعة قبل النشر مفعلة افتراضياً." : "Review before publication is enabled by default."}</p>
                <label className="permission-option">
                  <span>
                    <strong>{locale === "fa" ? "نیازمند بررسی تحریریه" : locale === "ar" ? "يتطلب مراجعة التحرير" : "Require editorial review"}</strong>
                    <small>{locale === "fa" ? "با خاموش‌کردن این گزینه، فروشنده می‌تواند مستقیم منتشر کند." : locale === "ar" ? "عند إيقافه يمكن للبائع النشر مباشرة." : "Turn off only for sellers trusted to publish directly."}</small>
                  </span>
                  <input type="checkbox" checked={form.blogReviewRequired} onChange={(event) => updateField("blogReviewRequired", event.target.checked)} />
                  <i aria-hidden="true" />
                </label>
              </fieldset>

              {error ? <p className="admin-notice is-error" role="alert">{error}</p> : null}
              <footer>
                <button className="admin-secondary-button" type="button" onClick={closePanel}>{c.cancel}</button>
                <button className="admin-primary-button" type="submit" disabled={submitting}>
                  {submitting ? (panelMode === "create" ? c.creating : c.saving) : c.save}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
      </main>
    </div>
  );
}

function Field({
  name,
  label,
  value,
  onChange,
  type = "text",
  required = true,
  minLength,
  autoComplete = "off",
  spellCheck
}: {
  name: string;
  label: string;
  value: string;
  onChange(value: string): void;
  type?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  spellCheck?: boolean;
}) {
  return (
    <label className="vendor-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
      />
    </label>
  );
}

function PercentField({ name, label, value, onChange }: { name: string; label: string; value: string; onChange(value: string): void }) {
  return (
    <label className="vendor-field vendor-percent-field">
      <span>{label}</span>
      <input name={name} type="number" inputMode="decimal" min="0" max="100" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} required autoComplete="off" />
      <b aria-hidden="true">%</b>
    </label>
  );
}

function VendorSkeleton() {
  return (
    <div className="vendor-skeleton" aria-hidden="true">
      <i /><i /><i />
    </div>
  );
}

function PlusIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>;
}

function OverviewIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx="1" /><rect x="12" y="3" width="5" height="5" rx="1" /><rect x="3" y="12" width="5" height="5" rx="1" /><rect x="12" y="12" width="5" height="5" rx="1" /></svg>;
}

function StatisticsIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 17V9M8 17V4M13 17v-6M18 17V7M2 17h17" /></svg>;
}

function NavIcon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
}

function UsersGroupIcon() {
  return <NavIcon><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.25" /><path d="M3.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M15 14c2.8.1 4.5 1.8 5 5" /></NavIcon>;
}

function VendorsIcon() {
  return <NavIcon><path d="M4 10v10h16V10M3 10l2-6h14l2 6" /><path d="M3 10c0 1.5 1 2.5 2.5 2.5S8 11.5 8 10c0 1.5 1 2.5 2.5 2.5S13 11.5 13 10c0 1.5 1 2.5 2.5 2.5S18 11.5 18 10c0 1.5 1 2.5 2.5 2.5M9 20v-4h6v4" /></NavIcon>;
}

function StaffIcon() {
  return <NavIcon><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M9 5V3h6v2M8 11h8M8 15h5" /></NavIcon>;
}

function CustomersIcon() {
  return <NavIcon><circle cx="12" cy="12" r="9" /><circle cx="12" cy="9" r="3" /><path d="M6.5 19c.7-3.4 2.5-5 5.5-5s4.8 1.6 5.5 5" /></NavIcon>;
}

function SalesServiceIcon() {
  return <NavIcon><path d="M5 8h14l1 12H4L5 8Z" /><path d="M9 9V7a3 3 0 0 1 6 0v2M8 14h8" /></NavIcon>;
}

function ProductsIcon() {
  return <NavIcon><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></NavIcon>;
}

function ProductChangesIcon() {
  return <NavIcon><path d="m3 7 6-3 6 3-6 3-6-3ZM3 7v7l6 3.5 3-1.75M9 10v7.5" /><path d="M15 12.5a4 4 0 0 1 5.5 1.5M20.5 14v-3M20.5 14h-3M21 18a4 4 0 0 1-5.5 1.5M15.5 19.5v3M15.5 19.5h3" /></NavIcon>;
}

function CouponIcon() {
  return <NavIcon><path d="M4 7a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-2a3 3 0 0 0 0-6V7Z" /><path d="m9 15 6-6M9.5 9h.01M14.5 15h.01" /></NavIcon>;
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

function PaymentServiceIcon() {
  return <NavIcon><path d="M4 7.5h14a2 2 0 0 1 2 2V19H6a2 2 0 0 1-2-2V7.5Z" /><path d="m5 7 11-3v3.5M15 12h6v4h-6a2 2 0 0 1 0-4Z" /></NavIcon>;
}

function TransactionsIcon() {
  return <NavIcon><circle cx="12" cy="12" r="9" /><path d="M8 9h8l-2.5-2.5M16 15H8l2.5 2.5" /></NavIcon>;
}

function PaymentMethodsIcon() {
  return <NavIcon><rect x="3" y="5" width="15" height="11" rx="2" /><path d="M3 9h15M7 13h3" /><path d="M7 19h14V8" /></NavIcon>;
}

function EditorialIcon() {
  return <NavIcon><path d="M5 4h14v16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="M7 8h8M7 12h8M7 16h5M19 6h2v12a2 2 0 0 1-2 2" /></NavIcon>;
}

function AiServiceIcon() {
  return <NavIcon><rect x="5" y="5" width="14" height="14" rx="3" /><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M19 9h4M1 15h4M19 15h4M12 8l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" /></NavIcon>;
}

function AiModelsIcon() {
  return <NavIcon><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></NavIcon>;
}

function AiAssistantIcon() {
  return <NavIcon><path d="M4 5h16v12H9l-5 4V5Z" /><path d="m13 8 .7 2.3L16 11l-2.3.7L13 14l-.7-2.3L10 11l2.3-.7L13 8Z" /></NavIcon>;
}

function SettingsIcon() {
  return <NavIcon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3h4v.08A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06A1.7 1.7 0 0 0 19.43 9 1.7 1.7 0 0 0 21 10v4h-.08A1.7 1.7 0 0 0 19.4 15Z" /></NavIcon>;
}

function SmsIcon() {
  return <NavIcon><path d="M4 5.5h16v11H8l-4 3v-14Z" /><path d="M8 10h8M8 13h5" /></NavIcon>;
}

function ShippingIcon() {
  return <NavIcon><path d="M3 6h11v10H3V6Zm11 4h4l3 3v3h-7v-6Z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></NavIcon>;
}

function UsdIcon() {
  return <NavIcon><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5c-.8-.7-2-1-3.4-1-1.8 0-3.1.8-3.1 2s1.1 1.8 3.2 2.2 3.1.9 3.1 2.4-1.3 2.4-3.3 2.4c-1.5 0-2.9-.5-3.8-1.4M12 5.5v13" /></NavIcon>;
}

function BridgeIcon() {
  return <NavIcon><circle cx="6" cy="12" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="m8.7 10.7 6.6-3.4M8.7 13.3l6.6 3.4" /></NavIcon>;
}

function SearchIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-4-4 4 4-4 4" /></svg>;
}

function ChevronIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 3 3 7-7" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>;
}
