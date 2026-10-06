"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { PublicProductOffer } from "@/app/[locale]/products/[slug]/product.server";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import { digitalProductCopy, downloadAllowance } from "./digital-product-copy";
import styles from "./DigitalOfferTable.module.css";

export type DigitalTableOffer = PublicProductOffer & {
  variantName: string;
  variantOptions: Array<{ name: string; value: string }>;
};

const tableCopy = {
  fa: { title: "انتخاب نسخه و دریافت فایل", offers: "گزینه", variant: "نسخه", seller: "فروشنده", price: "قیمت", selected: "نسخه انتخاب‌شده", select: "انتخاب", empty: "هنوز فایلی برای دریافت موجود نیست.", missing: "ثبت نشده", scroll: "برای دیدن همه مشخصات، جدول را به چپ و راست بکشید." },
  en: { title: "Choose a version to download", offers: "options", variant: "Version", seller: "Seller", price: "Price", selected: "Selected version", select: "Select", empty: "No files are available yet.", missing: "Not provided", scroll: "Scroll the table horizontally to see all specifications." },
  ar: { title: "اختر إصدارًا للتنزيل", offers: "خيارات", variant: "الإصدار", seller: "البائع", price: "السعر", selected: "الإصدار المحدد", select: "اختيار", empty: "لا توجد ملفات متاحة بعد.", missing: "غير محدد", scroll: "مرّر الجدول أفقيًا لعرض جميع المواصفات." }
} satisfies Record<Locale, Record<string, string>>;

export function DigitalOfferTable({ offers, optionNames, value, onChange, locale, disabled = false, action, children }: {
  offers: DigitalTableOffer[];
  optionNames: string[];
  value: string;
  onChange: (id: string) => void;
  locale: Locale;
  disabled?: boolean;
  action: ReactNode;
  children?: ReactNode;
}) {
  const id = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const region = scrollRef.current;
    if (!region) return;
    const update = () => setOverflows(region.scrollWidth > region.clientWidth + 1);
    const observer = new ResizeObserver(update);
    observer.observe(region);
    if (region.firstElementChild) observer.observe(region.firstElementChild);
    return () => observer.disconnect();
  }, [offers, optionNames]);
  const c = tableCopy[locale];
  const d = digitalProductCopy[locale];
  // Keep the catalog's attribute order, including any values retained by older variants.
  const availableNames = new Set(offers.flatMap((offer) => offer.variantOptions.map((option) => option.name)));
  const columns = [...new Set([...optionNames, ...availableNames])];
  const selected = offers.find((offer) => offer.id === value);
  const free = selected && /^0(?:\.0+)?$/.test(selected.price);
  const amount = (offer: DigitalTableOffer) => /^0(?:\.0+)?$/.test(offer.price)
    ? d.free : `${formatCurrencyAmount(offer.price, offer.currency, locale)} ${currencyLabel(offer.currency)}`;

  return <div className={styles.content}>
    <header className={styles.heading}>
      <h2 id="purchase-title">{c.title}</h2>
      <span>{new Intl.NumberFormat(locale).format(offers.length)} {c.offers}</span>
    </header>
    {offers.length ? <>
      {overflows ? <p className={styles.scrollHint} id={`${id}-scroll`}>{c.scroll}</p> : null}
      <div ref={scrollRef} className={styles.scroll} role="region" aria-labelledby="purchase-title" aria-describedby={overflows ? `${id}-scroll` : undefined} tabIndex={overflows ? 0 : undefined}>
        <table className={styles.table}>
          <caption className={styles.visuallyHidden}>{c.title}</caption>
          <thead><tr>
            <th scope="col" className={styles.identity}>{c.variant}</th>
            {columns.map((name) => <th scope="col" key={name}>{name}</th>)}
            <th scope="col">{c.seller}</th>
            <th scope="col" className={styles.amount}>{c.price}</th>
          </tr></thead>
          <tbody>{offers.map((offer) => <tr key={offer.id} data-selected={offer.id === value}>
            <th scope="row" className={styles.identity}>
              <label className={styles.choice}>
                <input type="radio" name={id} value={offer.id} checked={offer.id === value} disabled={disabled}
                  onChange={() => onChange(offer.id)}
                  aria-label={`${c.select} ${offer.variantName} · ${offer.seller.shopName} · ${amount(offer)}`} />
                <bdi>{offer.variantName}</bdi>
              </label>
            </th>
            {columns.map((name) => <td key={name}>
              <bdi>{offer.variantOptions.find((option) => option.name === name)?.value || <span className={styles.missing}>{c.missing}</span>}</bdi>
            </td>)}
            <td><bdi>{offer.seller.shopName}</bdi></td>
            <td className={styles.amount}><bdi>{amount(offer)}</bdi></td>
          </tr>)}</tbody>
        </table>
      </div>
      {selected ? <footer className={styles.footer}>
        <div className={styles.selection} aria-live="polite" aria-atomic="true">
          <strong>{c.selected}: <bdi>{selected.variantName}</bdi></strong>
          <span>{c.seller}: <bdi>{selected.seller.shopName}</bdi>
            {selected.digital && !free ? <> · {d.allowance}: {downloadAllowance(selected.digital.maxDownloads, locale)}</> : null}
          </span>
        </div>
        <div className={styles.action}>
          <strong className={styles.total} aria-live="polite"><bdi>{amount(selected)}</bdi></strong>
          {action}
        </div>
      </footer> : null}
    </> : <p className={styles.help}>{c.empty}</p>}
    <div className={styles.feedback}>{children}</div>
  </div>;
}
