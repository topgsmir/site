"use client";

import { useId } from "react";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import { DesignIcon } from "@/components/DesignIcon";
import styles from "./OfferPicker.module.css";

type OfferOption = {
  id: string;
  variant: string;
  seller: string;
  price: string;
  currency: string;
  unavailable?: boolean;
};

export function OfferPicker({ offers, value, onChange, locale, label, sellerLabel, unavailableLabel }: {
  offers: OfferOption[];
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  label: string;
  sellerLabel: string;
  unavailableLabel?: string;
}) {
  const name = useId();
  if (!offers.length) return null;

  function content(offer: OfferOption, selected: boolean, selectable: boolean) {
    return <>
      {selectable ? <span className={styles.indicator} aria-hidden="true">{selected ? <DesignIcon name="check" /> : null}</span> : null}
      <span className={styles.identity}>
        <bdi className={styles.variant}>{offer.variant}</bdi>
        <span className={styles.seller}>{sellerLabel}<span aria-hidden="true"> · </span><bdi>{offer.seller}</bdi></span>
      </span>
      <span className={styles.amount}>
        <span className={styles.price} dir="ltr"><bdi>{formatCurrencyAmount(offer.price, offer.currency, locale)}</bdi><bdi className={styles.currency}>{currencyLabel(offer.currency)}</bdi></span>
        {offer.unavailable && unavailableLabel ? <span className={styles.unavailable}>{unavailableLabel}</span> : null}
      </span>
    </>;
  }

  // A single offer is information, not a selection the buyer needs to make.
  if (offers.length === 1) {
    return <div className={styles.single} aria-label={label}>{content(offers[0]!, true, false)}</div>;
  }

  return <fieldset className={styles.picker}>
    <legend>{label}</legend>
    <div className={styles.options}>
      {offers.map((offer) => <label className={styles.option} key={offer.id} data-selected={offer.id === value}>
        <input type="radio" name={name} value={offer.id} checked={offer.id === value} onChange={() => onChange(offer.id)} />
        {content(offer, offer.id === value, true)}
      </label>)}
    </div>
  </fieldset>;
}
