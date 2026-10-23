"use client";

import type { ComponentType, Dispatch, SetStateAction } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { AppUser } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SellerMobileNavigation } from "./SellerMobileNavigation";
import { SellerUploadCenterNavigation } from "./SellerUploadCenterNavigation";
import { useSellerSideNavigation } from "./useSellerSideNavigation";
import navigationStyles from "./SellerNavigation.module.css";
import panelStyles from "./SellerShell.module.css";
import styles from "./seller-dashboard.module.css";

export type SellerDashboardSection = "overview" | "statistics" | "products" | "uploads" | "profile" | "blog" | "coupons" | "marketing" | "orders" | "customers" | "shipping" | "payouts" | "bridge" | "sales-configuration";
export type SellerDashboardIconName = SellerDashboardSection | "sales" | "plus" | "search" | "close" | "box";

type SellerNavigationCopy = {
  workspace: string;
  overview: string;
  orders: string;
  products: string;
  newOrders: string;
  productService: string;
  sellService: string;
  salesConfiguration: string;
  reports: string;
  coupons: string;
  marketing: string;
  uploads: string;
  profile: string;
  blog: string;
  payouts: string;
  account: string;
  sellerRole: string;
};

type SellerNavigationUser = Pick<AppUser, "fullName" | "email" | "role" | "permissions">;
type NavigationItem = { id: SellerDashboardSection; label: string };

export function SellerNavigation({
  locale,
  section,
  currentLabel,
  user,
  copy,
  newOrderCount,
  canManageOrders,
  hasAnalytics,
  onSelect,
  Icon,
  productServiceOpen,
  setProductServiceOpen,
  sellServiceOpen,
  setSellServiceOpen
}: {
  locale: Locale;
  section: SellerDashboardSection;
  currentLabel: string;
  user: SellerNavigationUser;
  copy: SellerNavigationCopy;
  newOrderCount: number;
  canManageOrders: boolean;
  hasAnalytics: boolean;
  onSelect: (section: SellerDashboardSection) => void;
  Icon: ComponentType<{ name: SellerDashboardIconName }>;
  productServiceOpen: boolean;
  setProductServiceOpen: Dispatch<SetStateAction<boolean>>;
  sellServiceOpen: boolean;
  setSellServiceOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const menuNavigation = useSellerSideNavigation();
  const sellServiceNavigation: NavigationItem[] = [
    ...(canManageOrders ? [{ id: "orders" as const, label: copy.orders }] : []),
    ...(user.permissions?.includes("coupons_manage") ? [{ id: "coupons" as const, label: copy.coupons }] : []),
    ...(user.permissions?.includes("products_manage") ? [{ id: "marketing" as const, label: copy.marketing }] : []),
    ...(hasAnalytics ? [{ id: "statistics" as const, label: copy.reports }] : []),
    { id: "sales-configuration", label: copy.salesConfiguration }
  ];
  const secondaryNavigation: NavigationItem[] = [
    { id: "uploads", label: copy.uploads },
    ...(user.role === "seller-admin" || user.role === "platform-admin" ? [{ id: "profile" as const, label: copy.profile }] : []),
    ...(user.permissions?.includes("blog_manage") ? [{ id: "blog" as const, label: copy.blog }] : []),
    { id: "payouts", label: copy.payouts }
  ];
  const isSellServiceSection = sellServiceNavigation.some((item) => item.id === section) || section === "customers" || section === "shipping" || section === "bridge";
  return <SellerMobileNavigation locale={locale} title={copy.workspace} currentLabel={currentLabel} shortcuts={[
    { label: copy.overview, icon: <Icon name="overview" />, active: section === "overview", onClick: () => onSelect("overview") },
    ...(canManageOrders ? [{ label: copy.orders, icon: <Icon name="orders" />, active: section === "orders", count: newOrderCount, onClick: () => onSelect("orders") }] : []),
    { label: copy.products, icon: <Icon name="products" />, active: section === "products", onClick: () => onSelect("products") }
  ]}>
    <aside className={`${styles.rail} ${panelStyles.rail} ${panelStyles.glassRail}`} data-navigation-surface data-mobile-open={true}>
      <span className={panelStyles.railSparkles} aria-hidden="true"><i /></span>
      <nav ref={menuNavigation} id="seller-panel-navigation" className={navigationStyles.navigation} data-glass="true" aria-label={copy.workspace} data-mobile-open={true}>
        <button className={navigationStyles.item} type="button" aria-current={section === "overview" ? "page" : undefined} onClick={() => onSelect("overview")} data-state="default">
          <Icon name="overview" />
          <span>{copy.overview}</span>
        </button>
        <div className={navigationStyles.group} data-active={section === "products"} data-open={productServiceOpen}>
          <button className={navigationStyles.groupTrigger} type="button" aria-expanded={productServiceOpen} aria-controls="product-service-navigation" onClick={() => setProductServiceOpen((current) => !current)}>
            <Icon name="products" />
            <span>{copy.productService}</span>
            <span className={navigationStyles.chevron} aria-hidden="true">⌄</span>
          </button>
          <div className={navigationStyles.subNavigation} id="product-service-navigation">
            <button className={navigationStyles.item} type="button" aria-current={section === "products" ? "page" : undefined} onClick={() => onSelect("products")} data-state="default">
              <Icon name="products" />
              <span>{copy.products}</span>
            </button>
          </div>
        </div>
        {sellServiceNavigation.length > 0 ? <div className={navigationStyles.group} data-active={isSellServiceSection} data-open={sellServiceOpen}>
          <button className={navigationStyles.groupTrigger} type="button" aria-expanded={sellServiceOpen} aria-controls="sell-service-navigation" onClick={() => setSellServiceOpen((current) => !current)}>
            <Icon name="sales" />
            <span>{copy.sellService}</span>
            <span className={navigationStyles.chevron} aria-hidden="true">⌄</span>
          </button>
          <div className={navigationStyles.subNavigation} id="sell-service-navigation">
            {sellServiceNavigation.map((item) => <button className={navigationStyles.item} type="button" key={item.id} aria-current={section === item.id || (item.id === "orders" && section === "customers") || (item.id === "sales-configuration" && (section === "shipping" || section === "bridge")) ? "page" : undefined} onClick={() => onSelect(item.id)} data-state="default">
              <Icon name={item.id} />
              <span>{item.label}</span>
              {item.id === "orders" ? <strong className={navigationStyles.count} aria-label={`${newOrderCount.toLocaleString(locale)} ${copy.newOrders}`} title={`${newOrderCount.toLocaleString(locale)} ${copy.newOrders}`}>
                {newOrderCount.toLocaleString(locale)}
              </strong> : null}
            </button>)}
          </div>
        </div> : null}
        {secondaryNavigation.map((item) => <button className={navigationStyles.item} type="button" key={item.id} aria-current={section === item.id ? "page" : undefined} onClick={() => onSelect(item.id)} data-state="default">
          <Icon name={item.id} />
          <span>{item.label}</span>
        </button>)}
        <Link className={navigationStyles.item} href={`/${locale}/seller-dashboard/comments` as Route}>
          <Icon name="blog" />
          <span>{locale === "fa" ? "دیدگاه‌ها" : locale === "ar" ? "التعليقات" : "Comments"}</span>
        </Link>
        <Link className={navigationStyles.item} href={`/${locale}/account` as Route}>
          <Icon name="overview" />
          <span>{locale === "fa" ? "حساب شخصی و خریدها" : locale === "ar" ? "حسابي ومشترياتي" : "My account and purchases"}</span>
        </Link>
        <SellerUploadCenterNavigation locale={locale} />
      </nav>
      <div className={styles.accountBlock} data-mobile-open={true}>
        <span>{copy.account}</span>
        <strong>{user.fullName}</strong>
        <small>{user.email}</small>
        <small>{copy.sellerRole}</small>
        <LogoutButton locale={locale} />
      </div>
    </aside>
  </SellerMobileNavigation>;
}
