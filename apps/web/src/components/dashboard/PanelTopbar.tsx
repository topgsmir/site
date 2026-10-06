import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import styles from "./PanelShell.module.css";
import { PanelIcon } from "./PanelIcon";

const copy = {
  fa: { admin: "پنل مدیریت", seller: "پنل فروشنده", store: "مشاهده فروشگاه", account: "حساب کاربری" },
  ar: { admin: "لوحة الإدارة", seller: "لوحة البائع", store: "زيارة المتجر", account: "حسابي" },
  en: { admin: "Admin panel", seller: "Seller panel", store: "Visit store", account: "My account" },
};

export function PanelTopbar({ locale, name, audience, canSwitchWorkspace = false }: { locale: Locale; name: string; audience: "admin" | "seller"; canSwitchWorkspace?: boolean }) {
  const c = copy[locale];
  return <header className={styles.topbar}>
    <div className={styles.identity}>
      <span className={styles.avatar} aria-hidden="true">{Array.from(name.trim())[0] ?? "T"}</span>
      <div><strong>{name}</strong><small>{c[audience]}</small></div>
    </div>
    <div className={styles.topbarActions}>
    {canSwitchWorkspace ? <Link className={styles.workspaceLink} href={`/${locale}/${audience === "admin" ? "seller-dashboard" : "admin"}`}>
      {audience === "seller" ? c.admin : locale === "fa" ? "فروشگاه من" : locale === "ar" ? "متجري" : "My shop"}
    </Link> : null}
    <Link className={styles.accountLink} href={`/${locale}/account`} aria-label={c.account} title={c.account}><PanelIcon name="user" /></Link>
    <Link className={styles.store} href={`/${locale}`} aria-label={c.store} title={c.store}>
      <span className={styles.storeIcon}><PanelIcon name="store" /></span>
      <span className={styles.storeLabel}>{c.store}</span>
    </Link>
    </div>
  </header>;
}
