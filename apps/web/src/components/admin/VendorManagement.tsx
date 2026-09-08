"use client";

import type { Route } from "next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import type {
  AdminProductSummary,
  AdminProductsPage,
  Vendor,
  VendorPermission,
  VendorStatus
} from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ProductPublicUrl } from "@/components/product/ProductPublicUrl";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const permissionOrder: VendorPermission[] = [
  "products_manage",
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
    vendors: "Vendors",
    catalog: "Product catalog",
    editorial: "Editorial",
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
    loadMore: "Load more"
  },
  fa: {
    admin: "مدیر پلتفرم",
    navigation: "ناوبری مدیریت",
    overview: "نمای کلی",
    vendors: "فروشنده‌ها",
    catalog: "کاتالوگ محصولات",
    editorial: "تحریریه",
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
    loadMore: "بارگذاری بیشتر"
  },
  ar: {
    admin: "مدير المنصة",
    navigation: "تنقل الإدارة",
    overview: "نظرة عامة",
    vendors: "البائعون",
    catalog: "كتالوج المنتجات",
    editorial: "التحرير",
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
    loadMore: "تحميل المزيد"
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
  section
}: {
  locale: Locale;
  adminName: string;
  section: "overview" | "vendors" | "products";
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
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");

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

  const loadProducts = useCallback(async (cursor?: string) => {
    setProductsLoading(true);
    setProductsError("");
    try {
      const response = await api.get<AdminProductsPage>("/products/admin", {
        params: { limit: 20, ...(cursor ? { cursor } : {}) }
      });
      setProducts((current) => cursor ? [...current, ...response.data.items] : response.data.items);
      setProductsCursor(response.data.nextCursor);
    } catch {
      setProductsError(c.catalogLoadError);
    } finally {
      setProductsLoading(false);
    }
  }, [c.catalogLoadError]);

  const closePanel = useCallback(() => {
    setPanelMode(null);
    setEditingId(null);
    window.requestAnimationFrame(() => panelTrigger.current?.focus());
  }, []);

  useEffect(() => {
    const loadFrame = window.requestAnimationFrame(() => {
      if (section === "overview" || section === "vendors") void loadVendors();
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

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const media = gsap.matchMedia();
      media.add("(min-width: 1100px)", () => {
        const summary = root.current?.querySelector<HTMLElement>("[data-admin-summary]");
        const workspace = root.current?.querySelector<HTMLElement>("[data-vendor-workspace]");
        if (summary && workspace) {
          ScrollTrigger.create({
            trigger: workspace,
            start: "top 112px",
            end: "bottom bottom-=80",
            pin: summary,
            pinSpacing: false
          });
        }
        gsap.utils
          .toArray<HTMLElement>("[data-vendor-card]", root.current)
          .forEach((card) => {
            gsap.fromTo(
              card,
              { transform: "translateY(24px) scale(0.985)", opacity: 0.5 },
              {
                transform: "translateY(0) scale(1)",
                opacity: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: card,
                  start: "top 94%",
                  end: "top 72%",
                  scrub: 0.35
                }
              }
            );
          });
      });
      return () => media.revert();
    },
    { scope: root, dependencies: [vendors.length], revertOnUpdate: true }
  );

  const filteredVendors = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    if (!needle) return vendors;
    return vendors.filter((vendor) =>
      [vendor.shopName, vendor.ownerName, vendor.ownerEmail].some((value) =>
        value.toLocaleLowerCase(locale).includes(needle)
      )
    );
  }, [locale, query, vendors]);

  const activeCount = vendors.filter((vendor) => vendor.status === "active").length;
  const restrictedCount = vendors.length - activeCount;

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
          <Image src="/brand/topgsm-logo.jpg" alt="" width={46} height={46} />
          <span translate="no">TOP GSM</span>
        </Link>
        <nav className="admin-navigation" aria-label={c.navigation}>
          <Link
            href={`/${locale}/admin`}
            aria-current={section === "overview" ? "page" : undefined}
          >
            <OverviewIcon />
            <span>{c.overview}</span>
          </Link>
          <Link
            href={`/${locale}/admin/vendors` as Route}
            aria-current={section === "vendors" ? "page" : undefined}
          >
            <VendorsIcon />
            <span>{c.vendors}</span>
          </Link>
          <Link
            href={`/${locale}/admin/products` as Route}
            aria-current={section === "products" ? "page" : undefined}
          >
            <ProductsIcon />
            <span>{c.catalog}</span>
          </Link>
          <Link href={`/${locale}/admin/blog` as Route}>
            <ProductsIcon />
            <span>{c.editorial}</span>
          </Link>
          <Link href={`/${locale}/admin/staff` as Route}>
            <VendorsIcon />
            <span>{c.staff}</span>
          </Link>
          {process.env.NEXT_PUBLIC_BRIDGE_FEATURE_ENABLED === "true" ? (
            <Link href={`/${locale}/admin/bridge` as Route}>
              <ProductsIcon />
              <span>Bridge</span>
            </Link>
          ) : null}
        </nav>
        <div className="admin-rail-account">
          <span>{c.account}</span>
          <div className="admin-identity">
            <span>{c.admin}</span>
            <strong>{adminName}</strong>
          </div>
          <LogoutButton locale={locale} />
        </div>
      </aside>

      <main className="admin-shell" id="admin-content" ref={root}>

      {section === "overview" ? <>
      <section className="admin-hero" aria-labelledby="vendor-title">
        <div>
          <p>{c.greeting}, {adminName}</p>
          <h1 id="vendor-title">
            {c.titleStart}{" "}
            <span className="admin-inline-mark" aria-hidden="true">
              <Image src="/brand/topgsm-logo.jpg" alt="" width={112} height={52} />
            </span>{" "}
            <span>{c.titleEnd}</span>
          </h1>
          <p className="admin-hero-copy">{c.subtitle}</p>
        </div>
        <button className="admin-primary-button" type="button" onClick={(event) => openCreate(event.currentTarget)}>
          <PlusIcon />
          {c.create}
        </button>
      </section>

      <section className="admin-metrics grid-flow-dense" aria-label={c.workspace}>
        <article>
          <span>{c.total}</span>
          <strong>{vendors.length}</strong>
        </article>
        <article>
          <span>{c.active}</span>
          <strong>{activeCount}</strong>
        </article>
        <article>
          <span>{c.restricted}</span>
          <strong>{restrictedCount}</strong>
        </article>
      </section>
      </> : null}

      {section === "vendors" ? <section className="vendor-workspace grid-flow-dense" data-vendor-workspace>
        <aside className="vendor-workspace-intro" data-admin-summary>
          <h2>{c.workspace}</h2>
          <p>{c.workspaceHint}</p>
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
        {productsError ? <p className="admin-notice is-error" role="alert">{productsError}</p> : null}
        {!productsLoading && !products.length ? <p className="vendor-empty">{c.catalogEmpty}</p> : null}
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
              </article>
            ))}
          </div>
        ) : null}
        {productsCursor && !productsLoading ? (
          <button className="admin-secondary-button admin-products-more" type="button" onClick={() => void loadProducts(productsCursor)}>
            {c.loadMore}
          </button>
        ) : null}
      </section> : null}

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

function VendorsIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6.5" r="3" /><path d="M4.5 17c.4-3.2 2.2-5 5.5-5s5.1 1.8 5.5 5" /></svg>;
}

function ProductsIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m3.5 6 6.5-3 6.5 3-6.5 3-6.5-3Z" /><path d="M3.5 6v8l6.5 3 6.5-3V6M10 9v8" /></svg>;
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
