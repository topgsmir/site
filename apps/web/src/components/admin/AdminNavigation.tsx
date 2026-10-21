"use client";

import type { ComponentType, Dispatch, SetStateAction } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { Locale } from "@/lib/i18n";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { UploadCenterNavigation } from "@/components/dashboard/UploadCenterNavigation";
import { useSideNavigation } from "@/components/dashboard/useSideNavigation";
import navigationStyles from "@/components/dashboard/DashboardNavigation.module.css";
import panelStyles from "@/components/dashboard/PanelShell.module.css";
import type { AdminSection } from "./AdminPanelRoute";

export type AdminNavigationIcons = {
  overview: ComponentType;
  notifications: ComponentType;
  users: ComponentType;
  vendors: ComponentType;
  staff: ComponentType;
  customers: ComponentType;
  statistics: ComponentType;
  products: ComponentType;
  productChanges: ComponentType;
  sales: ComponentType;
  orders: ComponentType;
  coupons: ComponentType;
  payments: ComponentType;
  transactions: ComponentType;
  paymentMethods: ComponentType;
  usd: ComponentType;
  editorial: ComponentType;
  uploads: ComponentType;
  ai: ComponentType;
  aiModels: ComponentType;
  aiAssistant: ComponentType;
  settings: ComponentType;
  sms: ComponentType;
  bridge: ComponentType;
};

type AdminNavigationProps = {
  locale: Locale;
  adminName: string;
  ownerNavigation: boolean;
  section: AdminSection;
  copy: Record<string, string>;
  icons: AdminNavigationIcons;
  notificationCount: number | null;
  newOrderCount: number;
  usdRateFailed: boolean;
  canManageUploads: boolean;
  canManageBlog: boolean;
  isUsersSection: boolean;
  usersExpanded: boolean;
  setUsersOpen: Dispatch<SetStateAction<boolean>>;
  isProductServiceSection: boolean;
  productServiceExpanded: boolean;
  setProductServiceOpen: Dispatch<SetStateAction<boolean>>;
  isSalesServiceSection: boolean;
  salesServiceExpanded: boolean;
  setSalesServiceOpen: Dispatch<SetStateAction<boolean>>;
  isPaymentServiceSection: boolean;
  paymentServiceExpanded: boolean;
  setPaymentServiceOpen: Dispatch<SetStateAction<boolean>>;
  isContentSection: boolean;
  contentExpanded: boolean;
  setContentOpen: Dispatch<SetStateAction<boolean>>;
  isAiSection: boolean;
  aiExpanded: boolean;
  setAiOpen: Dispatch<SetStateAction<boolean>>;
  isWebsiteSection: boolean;
  websiteExpanded: boolean;
  setWebsiteOpen: Dispatch<SetStateAction<boolean>>;
  isIntegrationsSection: boolean;
  integrationsExpanded: boolean;
  setIntegrationsOpen: Dispatch<SetStateAction<boolean>>;
  isSecuritySection: boolean;
  securityExpanded: boolean;
  setSecurityOpen: Dispatch<SetStateAction<boolean>>;
};

export function AdminNavigation({
  locale,
  adminName,
  ownerNavigation,
  section,
  copy,
  icons,
  notificationCount,
  newOrderCount,
  usdRateFailed,
  canManageUploads,
  canManageBlog,
  isUsersSection,
  usersExpanded,
  setUsersOpen,
  isProductServiceSection,
  productServiceExpanded,
  setProductServiceOpen,
  isSalesServiceSection,
  salesServiceExpanded,
  setSalesServiceOpen,
  isPaymentServiceSection,
  paymentServiceExpanded,
  setPaymentServiceOpen,
  isContentSection,
  contentExpanded,
  setContentOpen,
  isAiSection,
  aiExpanded,
  setAiOpen,
  isWebsiteSection,
  websiteExpanded,
  setWebsiteOpen,
  isIntegrationsSection,
  integrationsExpanded,
  setIntegrationsOpen,
  isSecuritySection,
  securityExpanded,
  setSecurityOpen
}: AdminNavigationProps) {
  const menuNavigation = useSideNavigation();
  const c = copy;
  const {
    overview: OverviewIcon,
    notifications: NotificationsIcon,
    users: UsersGroupIcon,
    vendors: VendorsIcon,
    staff: StaffIcon,
    customers: CustomersIcon,
    statistics: StatisticsIcon,
    products: ProductsIcon,
    productChanges: ProductChangesIcon,
    sales: SalesServiceIcon,
    orders: OrdersIcon,
    coupons: CouponIcon,
    payments: PaymentServiceIcon,
    transactions: TransactionsIcon,
    paymentMethods: PaymentMethodsIcon,
    usd: UsdIcon,
    editorial: EditorialIcon,
    uploads: UploadsIcon,
    ai: AiServiceIcon,
    aiModels: AiModelsIcon,
    aiAssistant: AiAssistantIcon,
    settings: SettingsIcon,
    sms: SmsIcon,
    bridge: BridgeIcon
  } = icons;

  return (
        <aside
          className={`admin-rail ${panelStyles.rail} ${panelStyles.monochromeRail}`}
          data-navigation-surface
          data-mobile-open={true}
        >
          <nav
            ref={menuNavigation}
            id="admin-panel-navigation"
            data-monochrome="true"
            className={navigationStyles.navigation}
            aria-label={c.navigation}
            data-mobile-open={true}
          >
            {ownerNavigation ? (
              <>
                <Link
                  className={navigationStyles.item}
                  href={`/${locale}/admin`}
                  aria-current={section === "overview" ? "page" : undefined}
                >
                  <OverviewIcon />
                  <span>{c.overview}</span>
                </Link>
                <Link
                  className={navigationStyles.item}
                  href={`/${locale}/admin/notifications` as Route}
                  aria-current={
                    section === "notifications" ? "page" : undefined
                  }
                >
                  <NotificationsIcon />
                  <span>{c.notifications}</span>
                  {notificationCount !== null ? (
                    <strong className={navigationStyles.count} aria-label={`${notificationCount.toLocaleString(locale)} ${c.notifications}`}>
                      {notificationCount.toLocaleString(locale)}
                    </strong>
                  ) : null}
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
                    <span
                      className={navigationStyles.chevron}
                      aria-hidden="true"
                    >
                      ⌄
                    </span>
                  </button>
                  <div
                    className={navigationStyles.subNavigation}
                    id="admin-users-navigation"
                  >
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
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/seller-statistics` as Route}
                      aria-current={section === "seller-statistics" ? "page" : undefined}
                    >
                      <StatisticsIcon />
                      <span>{c.sellerStatistics}</span>
                    </Link>
                  </div>
                </div>
                <div
                  className={navigationStyles.group}
                  data-active={isProductServiceSection}
                  data-open={productServiceExpanded}
                >
                  <button
                    className={navigationStyles.groupTrigger}
                    type="button"
                    aria-expanded={productServiceExpanded}
                    aria-controls="admin-product-service-navigation"
                    onClick={() => setProductServiceOpen((current) => !current)}
                  >
                    <ProductsIcon />
                    <span>{c.productService}</span>
                    <span
                      className={navigationStyles.chevron}
                      aria-hidden="true"
                    >
                      ⌄
                    </span>
                  </button>
                  <div
                    className={navigationStyles.subNavigation}
                    id="admin-product-service-navigation"
                  >
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
                      href={`/${locale}/admin/product-categories` as Route}
                      aria-current={
                        section === "product-categories" ? "page" : undefined
                      }
                    >
                      <ProductsIcon />
                      <span>{c.productCategories}</span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/product-templates` as Route}
                      aria-current={section === "product-templates" ? "page" : undefined}
                    >
                      <ProductsIcon />
                      <span>{c.productTemplates}</span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/product-changes` as Route}
                      aria-current={
                        section === "product-changes" ? "page" : undefined
                      }
                    >
                      <ProductChangesIcon />
                      <span>{c.productChanges}</span>
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
                    <span
                      className={navigationStyles.chevron}
                      aria-hidden="true"
                    >
                      ⌄
                    </span>
                  </button>
                  <div
                    className={navigationStyles.subNavigation}
                    id="admin-sales-service-navigation"
                  >
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/orders` as Route}
                      aria-current={
                        section === "orders" || section === "order-detail"
                          ? "page"
                          : undefined
                      }
                    >
                      <OrdersIcon />
                      <span>{c.orders}</span>
                      <strong
                        className={navigationStyles.count}
                        aria-label={`${newOrderCount.toLocaleString(locale)} ${c.newOrders}`}
                        title={`${newOrderCount.toLocaleString(locale)} ${c.newOrders}`}
                      >
                        {newOrderCount.toLocaleString(locale)}
                      </strong>
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
                      href={`/${locale}/admin/marketing` as Route}
                      aria-current={section === "marketing" ? "page" : undefined}
                    >
                      <CouponIcon />
                      <span>{c.marketing}</span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/statistics` as Route}
                      aria-current={section === "statistics" ? "page" : undefined}
                    >
                      <StatisticsIcon />
                      <span>{c.reports}</span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/sales/configuration` as Route}
                      aria-current={section === "sales-configuration" || section === "club" || section === "settings-shipping" ? "page" : undefined}
                    >
                      <SalesServiceIcon />
                      <span>{c.salesConfiguration}</span>
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
                    <span
                      className={navigationStyles.chevron}
                      aria-hidden="true"
                    >
                      ⌄
                    </span>
                  </button>
                  <div
                    className={navigationStyles.subNavigation}
                    id="admin-payment-service-navigation"
                  >
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/payments/transactions` as Route}
                      aria-current={
                        section === "payment-transactions" ? "page" : undefined
                      }
                    >
                      <TransactionsIcon />
                      <span>{c.paymentTransactions}</span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/payments/methods` as Route}
                      aria-current={
                        section === "payment-methods" ? "page" : undefined
                      }
                    >
                      <PaymentMethodsIcon />
                      <span>{c.paymentMethods}</span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/settings/usd` as Route}
                      aria-current={
                        section === "settings-usd" ? "page" : undefined
                      }
                      data-alert={usdRateFailed}
                    >
                      <UsdIcon />
                      <span>{c.usd}</span>
                      {usdRateFailed ? (
                        <strong
                          className={navigationStyles.alert}
                          aria-label={c.usdAlert}
                          title={c.usdAlert}
                        >
                          !
                        </strong>
                      ) : null}
                    </Link>
                  </div>
                </div>
              </>
            ) : null}
            {canManageUploads || canManageBlog ? (
              <div
                className={navigationStyles.group}
                data-active={isContentSection}
                data-open={contentExpanded}
              >
                <button
                  className={navigationStyles.groupTrigger}
                  type="button"
                  aria-expanded={contentExpanded}
                  aria-controls="admin-content-navigation"
                  onClick={() => setContentOpen((current) => !current)}
                >
                  <EditorialIcon />
                  <span>{c.content}</span>
                  <span className={navigationStyles.chevron} aria-hidden="true">
                    ⌄
                  </span>
                </button>
                <div
                  className={navigationStyles.subNavigation}
                  id="admin-content-navigation"
                >
                  {canManageUploads ? (
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/uploads` as Route}
                      aria-current={section === "uploads" ? "page" : undefined}
                    >
                      <UploadsIcon />
                      <span>{c.uploads}</span>
                    </Link>
                  ) : null}
                  {canManageBlog ? (
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/blog` as Route}
                      aria-current={
                        section === "editorial" ? "page" : undefined
                      }
                    >
                      <EditorialIcon />
                      <span>{c.editorial}</span>
                    </Link>
                  ) : null}
                  {canManageBlog ? (
                    <Link
                      className={`${navigationStyles.item} ${navigationStyles.nestedItem}`}
                      href={`/${locale}/admin/blog/categories` as Route}
                      aria-current={
                        section === "blog-categories" ? "page" : undefined
                      }
                    >
                      <span>
                        {locale === "fa"
                          ? "دسته‌بندی‌ها"
                          : locale === "ar"
                            ? "التصنيفات"
                            : "Categories"}
                      </span>
                    </Link>
                  ) : null}
                  {canManageBlog ? (
                    <Link
                      className={`${navigationStyles.item} ${navigationStyles.nestedItem}`}
                      href={`/${locale}/admin/blog/tags` as Route}
                      aria-current={
                        section === "blog-tags" ? "page" : undefined
                      }
                    >
                      <span>
                        {locale === "fa"
                          ? "برچسب‌ها"
                          : locale === "ar"
                            ? "الوسوم"
                            : "Tags"}
                      </span>
                    </Link>
                  ) : null}
                  {ownerNavigation ? (
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/settings/comments` as Route}
                      aria-current={
                        section === "settings-comments" ? "page" : undefined
                      }
                    >
                      <EditorialIcon />
                      <span>{c.comments}</span>
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
            {ownerNavigation ? (
              <>
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
                    <span
                      className={navigationStyles.chevron}
                      aria-hidden="true"
                    >
                      ⌄
                    </span>
                  </button>
                  <div
                    className={navigationStyles.subNavigation}
                    id="admin-ai-navigation"
                  >
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/ai/models` as Route}
                      aria-current={
                        section === "ai-models" ? "page" : undefined
                      }
                    >
                      <AiModelsIcon />
                      <span>{c.aiModels}</span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/ai/assistant` as Route}
                      aria-current={
                        section === "ai-assistant" ? "page" : undefined
                      }
                    >
                      <AiAssistantIcon />
                      <span>{c.aiAssistant}</span>
                    </Link>
                  </div>
                </div>
                <div
                  className={navigationStyles.group}
                  data-active={isWebsiteSection}
                  data-open={websiteExpanded}
                >
                  <button
                    className={navigationStyles.groupTrigger}
                    type="button"
                    aria-expanded={websiteExpanded}
                    aria-controls="admin-website-navigation"
                    onClick={() => setWebsiteOpen((current) => !current)}
                  >
                    <EditorialIcon />
                    <span>{c.website}</span>
                    <span
                      className={navigationStyles.chevron}
                      aria-hidden="true"
                    >
                      ⌄
                    </span>
                  </button>
                  <div
                    className={navigationStyles.subNavigation}
                    id="admin-website-navigation"
                  >
                    <Link className={navigationStyles.item} href={`/${locale}/admin/settings/template` as Route} aria-current={section === "settings-template" ? "page" : undefined}>
                      <EditorialIcon /><span>{locale === "fa" ? "تنظیمات قالب" : locale === "ar" ? "إعدادات القالب" : "Template settings"}</span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/settings/seo` as Route}
                      aria-current={
                        section === "settings-seo" ? "page" : undefined
                      }
                    >
                      <EditorialIcon />
                      <span>
                        {locale === "fa"
                          ? "سئو"
                          : locale === "ar"
                            ? "تحسين البحث"
                            : "SEO"}
                      </span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/settings/homepage` as Route}
                      aria-current={
                        section === "settings-homepage" ? "page" : undefined
                      }
                    >
                      <EditorialIcon />
                      <span>
                        {locale === "fa"
                          ? "صفحه اصلی"
                          : locale === "ar"
                            ? "الصفحة الرئيسية"
                            : "Homepage"}
                      </span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/settings/notice` as Route}
                      aria-current={
                        section === "settings-notice" ? "page" : undefined
                      }
                    >
                      <EditorialIcon />
                      <span>
                        {locale === "fa"
                          ? "اطلاعیه"
                          : locale === "ar"
                            ? "الإشعار"
                            : "Notice"}
                      </span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/settings/complaints` as Route}
                      aria-current={
                        section === "settings-complaints" ? "page" : undefined
                      }
                    >
                      <EditorialIcon />
                      <span>
                        {locale === "fa"
                          ? "ثبت شکایات"
                          : locale === "ar"
                            ? "الشكاوى"
                            : "Complaints"}
                      </span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/settings/stories` as Route}
                      aria-current={
                        section === "settings-stories" ? "page" : undefined
                      }
                    >
                      <EditorialIcon />
                      <span>
                        {locale === "fa"
                          ? "استوری‌ها"
                          : locale === "ar"
                            ? "القصص"
                            : "Stories"}
                      </span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/settings/blog-sidebar` as Route}
                      aria-current={
                        section === "settings-blog-sidebar" ? "page" : undefined
                      }
                    >
                      <EditorialIcon />
                      <span>
                        {locale === "fa"
                          ? "تبلیغ کنار مقاله"
                          : locale === "ar"
                            ? "إعلان جانب المقال"
                            : "Article sidebar"}
                      </span>
                    </Link>
                  </div>
                </div>
                <div
                  className={navigationStyles.group}
                  data-active={isIntegrationsSection}
                  data-open={integrationsExpanded}
                >
                  <button
                    className={navigationStyles.groupTrigger}
                    type="button"
                    aria-expanded={integrationsExpanded}
                    aria-controls="admin-integrations-navigation"
                    onClick={() => setIntegrationsOpen((current) => !current)}
                  >
                    <SettingsIcon />
                    <span>{c.integrations}</span>
                    <span
                      className={navigationStyles.chevron}
                      aria-hidden="true"
                    >
                      ⌄
                    </span>
                  </button>
                  <div
                    className={navigationStyles.subNavigation}
                    id="admin-integrations-navigation"
                  >
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/settings/sms` as Route}
                      aria-current={
                        section === "settings-sms" ? "page" : undefined
                      }
                    >
                      <SmsIcon />
                      <span>{c.sms}</span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/settings/goghdi` as Route}
                      aria-current={
                        section === "settings-goghdi" ? "page" : undefined
                      }
                    >
                      <SmsIcon />
                      <span>{c.goghdi}</span>
                    </Link>
                    {process.env.NEXT_PUBLIC_BRIDGE_FEATURE_ENABLED ===
                    "true" ? (
                      <Link
                        className={navigationStyles.item}
                        href={`/${locale}/admin/bridge` as Route}
                        aria-current={section === "bridge" ? "page" : undefined}
                      >
                        <BridgeIcon />
                        <span>Bridge</span>
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div
                  className={navigationStyles.group}
                  data-active={isSecuritySection}
                  data-open={securityExpanded}
                >
                  <button
                    className={navigationStyles.groupTrigger}
                    type="button"
                    aria-expanded={securityExpanded}
                    aria-controls="admin-security-navigation"
                    onClick={() => setSecurityOpen((current) => !current)}
                  >
                    <SettingsIcon />
                    <span>{c.security}</span>
                    <span
                      className={navigationStyles.chevron}
                      aria-hidden="true"
                    >
                      ⌄
                    </span>
                  </button>
                  <div
                    className={navigationStyles.subNavigation}
                    id="admin-security-navigation"
                  >
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/security/rate-limit` as Route}
                      aria-current={
                        section === "security-rate-limit" ? "page" : undefined
                      }
                    >
                      <SettingsIcon />
                      <span>{c.rateLimit}</span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/security/login` as Route}
                      aria-current={
                        section === "security-login" ? "page" : undefined
                      }
                    >
                      <SettingsIcon />
                      <span>{c.auth}</span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/security/captcha` as Route}
                      aria-current={
                        section === "security-captcha" ? "page" : undefined
                      }
                    >
                      <SettingsIcon />
                      <span>{c.captcha}</span>
                    </Link>
                    <Link
                      className={navigationStyles.item}
                      href={`/${locale}/admin/settings/backup` as Route}
                      aria-current={
                        section === "settings-backup" ? "page" : undefined
                      }
                    >
                      <SettingsIcon />
                      <span>{c.backupRestore}</span>
                    </Link>
                  </div>
                </div>
              </>
            ) : null}
            <UploadCenterNavigation
              locale={locale}
              settingsHref={ownerNavigation ? `/${locale}/admin/settings/upload-centers` : undefined}
              active={section === "settings-upload-centers"}
            />
          </nav>
          <div className="admin-rail-account" data-mobile-open={true}>
            <span>{c.account}</span>
            <div className="admin-identity">
              <span>{ownerNavigation ? c.admin : c.staff}</span>
              <strong>{adminName}</strong>
            </div>
            <Link className={navigationStyles.item} href={`/${locale}/account` as Route}>
              <span>{locale === "fa" ? "حساب شخصی و خریدها" : locale === "ar" ? "حسابي ومشترياتي" : "My account and purchases"}</span>
            </Link>
            <LogoutButton locale={locale} />
          </div>
        </aside>
  );
}
