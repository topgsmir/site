"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { getDictionary, Locale } from "@/lib/i18n";
import type { PublicProduct, PublicProductOffer, PublicProductVariant } from "./product.server";
import styles from "./ProductPage.module.css";

type ProductCopy = ReturnType<typeof getDictionary>["product"];
type ButtonState = "idle" | "loading" | "success" | "error";
type CartItem = { productId: string; offerId: string; quantity: number };

type SelectableOffer = PublicProductOffer & {
  variantId: string;
  variantName: string;
  variantOptions: Array<{ name: string; value: string }>;
};

const CART_KEY = "topgsm-cart-v1";
const CART_EVENT = "topgsm:cart-updated";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.productId === "string" &&
    UUID_PATTERN.test(item.productId) &&
    typeof item.offerId === "string" &&
    UUID_PATTERN.test(item.offerId) &&
    Number.isInteger(item.quantity) &&
    Number(item.quantity) > 0 &&
    Number(item.quantity) <= 99
  );
}

function readCart(): CartItem[] {
  const raw = window.localStorage.getItem(CART_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isCartItem).slice(0, 100);
}

function cartQuantity(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function variantLabel(variant: PublicProductVariant, copy: ProductCopy) {
  if (variant.name) return variant.name;
  if (variant.options.length) return variant.options.map((option) => option.value).join(" · ");
  return copy.variant;
}

function flattenOffers(product: PublicProduct, copy: ProductCopy): SelectableOffer[] {
  return product.variants.flatMap((variant) =>
    variant.offers.map((offer) => ({
      ...offer,
      variantId: variant.id,
      variantName: variantLabel(variant, copy),
      variantOptions: variant.options
    }))
  );
}

function formatPrice(price: string, currency: string, locale: Locale) {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return `${price} ${currency}`;
  try {
    return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en", {
      style: "currency",
      currency,
      maximumFractionDigits: 4
    }).format(numericPrice);
  } catch {
    return `${price} ${currency}`;
  }
}

function fulfilmentLabel(product: PublicProduct, copy: ProductCopy) {
  if (product.type === "digital") return copy.digitalDelivery;
  if (product.type === "physical") return copy.physicalDelivery;
  return copy.serviceDelivery;
}

function buttonLabel(state: ButtonState, unavailable: boolean, copy: ProductCopy) {
  if (unavailable) return copy.outOfStock;
  if (state === "loading") return copy.adding;
  if (state === "success") return copy.added;
  if (state === "error") return copy.addFailed;
  return copy.addToCart;
}

export function ProductPage({
  product,
  locale,
  copy
}: {
  product: PublicProduct;
  locale: Locale;
  copy: ProductCopy;
}) {
  const offers = useMemo(() => flattenOffers(product, copy), [copy, product]);
  const firstAvailableOffer = offers.find((offer) => offer.physical?.inStock !== false) ?? offers[0];
  const [selectedOfferId, setSelectedOfferId] = useState(firstAvailableOffer?.id ?? "");
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [cartCount, setCartCount] = useState(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? firstAvailableOffer;
  const unavailable = !selectedOffer || selectedOffer.physical?.inStock === false;

  useEffect(() => {
    const updateCount = () => {
      try {
        setCartCount(cartQuantity(readCart()));
      } catch {
        setCartCount(0);
      }
    };
    updateCount();
    window.addEventListener("storage", updateCount);
    window.addEventListener(CART_EVENT, updateCount);
    return () => {
      window.removeEventListener("storage", updateCount);
      window.removeEventListener(CART_EVENT, updateCount);
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  function addToCart() {
    if (!selectedOffer || unavailable) return;
    setButtonState("loading");

    try {
      const items = readCart();
      const existing = items.find((item) => item.offerId === selectedOffer.id);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + 1, 99);
      } else {
        items.push({ productId: product.id, offerId: selectedOffer.id, quantity: 1 });
      }
      window.localStorage.setItem(CART_KEY, JSON.stringify(items));
      window.dispatchEvent(new Event(CART_EVENT));
      setButtonState("success");
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setButtonState("idle"), 2500);
    } catch {
      setButtonState("error");
    }
  }

  const typeLabel = product.type === "bridge" ? "Bridge" : copy[product.type];
  const category = product.category ?? copy.uncategorized;
  const countLabel = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en").format(cartCount);
  const fulfilmentRows: Array<{ label: string; value: string }> = [];
  if (selectedOffer?.digital) {
    fulfilmentRows.push({
      label: copy.downloadLimit,
      value: `${selectedOffer.digital.maxDownloads} ${copy.downloads}`
    });
  }
  if (selectedOffer?.physical) {
    fulfilmentRows.push({
      label: copy.weight,
      value: `${selectedOffer.physical.weightGrams} ${copy.grams}`
    });
  }
  if (selectedOffer?.service) {
    fulfilmentRows.push(
      { label: copy.serviceType, value: selectedOffer.service.serviceType },
      { label: copy.estimatedTime, value: `${selectedOffer.service.estimatedHours} ${copy.hours}` }
    );
  }

  return (
    <div className={styles.page} dir={locale === "en" ? "ltr" : "rtl"}>
      <a className={styles.skipLink} href="#product-main">{copy.skipToContent}</a>

      <header className={styles.navigation}>
        <Link className={styles.brand} href={`/${locale}` as Route} aria-label="Top GSM">
          <Image src="/brand/topgsm-logo.jpg" width={40} height={40} alt="" priority />
          <strong>TOP GSM</strong>
        </Link>
        <div className={styles.navigationTools}>
          <nav className={styles.languages} aria-label={copy.language}>
            {(["fa", "en", "ar"] as const).map((code) => (
              <Link
                key={code}
                href={`/${code}/products/${encodeURIComponent(product.slug)}` as Route}
                hrefLang={code}
                aria-current={code === locale ? "page" : undefined}
              >
                {code.toUpperCase()}
              </Link>
            ))}
          </nav>
          <div className={styles.cartIndicator} aria-label={`${countLabel} ${copy.itemCount}`}>
            <span>{copy.cart}</span><strong>{countLabel}</strong>
          </div>
        </div>
      </header>

      <main id="product-main" className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href={`/${locale}` as Route}>{copy.home}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.title}</span>
        </nav>

        <section className={styles.hero} aria-labelledby="product-title">
          <div className={styles.productIntro}>
            <p className={styles.productClass}>{category} · {typeLabel}</p>
            <h1 id="product-title">{product.title}</h1>
            <div className={styles.identityPlate} aria-label={copy.technicalDetails}>
              <div><span>{copy.productType}</span><strong>{typeLabel}</strong></div>
              <div><span>{copy.category}</span><strong>{category}</strong></div>
              <div><span>{copy.productCode}</span><code>{product.id}</code></div>
            </div>
          </div>

          <aside className={styles.purchasePanel} id="purchase" aria-labelledby="purchase-title">
            <h2 id="purchase-title">{copy.chooseOffer}</h2>
            <p>{copy.offerHelp}</p>
            <label htmlFor="product-offer">{copy.chooseOffer}</label>
            <select
              id="product-offer"
              value={selectedOffer?.id ?? ""}
              onChange={(event) => {
                setSelectedOfferId(event.target.value);
                setButtonState("idle");
              }}
              disabled={!offers.length}
            >
              {offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.variantName} · {offer.seller.shopName} · {formatPrice(offer.price, offer.currency, locale)}
                </option>
              ))}
            </select>

            {selectedOffer ? (
              <div className={styles.offerSummary}>
                <div><span>{copy.seller}</span><strong>{selectedOffer.seller.shopName}</strong></div>
                <div><span>{copy.variant}</span><strong>{selectedOffer.variantName}</strong></div>
                <div><span>{copy.availability}</span><strong>{unavailable ? copy.outOfStock : copy.inStock}</strong></div>
                <p className={styles.price}>{formatPrice(selectedOffer.price, selectedOffer.currency, locale)}</p>
              </div>
            ) : null}

            <button
              className={styles.addButton}
              type="button"
              onClick={addToCart}
              disabled={unavailable || buttonState === "loading"}
              data-state={buttonState}
              aria-describedby={buttonState === "error" ? "cart-feedback" : undefined}
            >
              {buttonLabel(buttonState, unavailable, copy)}
            </button>
            <p
              id="cart-feedback"
              className={buttonState === "error" ? styles.errorMessage : styles.purchaseNote}
              role={buttonState === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {buttonState === "error" ? copy.addFailed : copy.priceAvailability}
            </p>
          </aside>
        </section>

        <section className={styles.details} aria-labelledby="overview-title">
          <article className={styles.description}>
            <h2 id="overview-title">{copy.overview}</h2>
            {(product.description?.trim() || copy.noDescription).split(/\n{2,}/).map((paragraph, index) => (
              <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>
            ))}
          </article>

          <div className={styles.specification}>
            <h2>{copy.technicalDetails}</h2>
            <table>
              <tbody>
                <tr><th scope="row">{copy.productType}</th><td data-label={copy.productType}>{typeLabel}</td></tr>
                <tr><th scope="row">{copy.category}</th><td data-label={copy.category}>{category}</td></tr>
                <tr><th scope="row">{copy.fulfilment}</th><td data-label={copy.fulfilment}>{fulfilmentLabel(product, copy)}</td></tr>
                {fulfilmentRows.map((row) => (
                  <tr key={row.label}><th scope="row">{row.label}</th><td data-label={row.label}>{row.value}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.support} aria-labelledby="support-title">
          <div>
            <h2 id="support-title">{copy.supportTitle}</h2>
            <p>{copy.supportBody}</p>
          </div>
          <a href="tel:09925739312">{copy.contactSupport}<span aria-hidden="true">↗</span></a>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <strong>TOP GSM</strong>
          <p>{copy.footerDescription}</p>
        </div>
        <nav aria-label={copy.backHome}>
          <Link href={`/${locale}` as Route}>{copy.home}</Link>
          <Link href={`/${locale}/login` as Route}>{copy.signIn}</Link>
          <a href="tel:09925739312">{copy.contactSupport}</a>
        </nav>
        <small>© {new Date().getFullYear()} Top GSM</small>
      </footer>

      <aside className={styles.mobileCart} aria-label={copy.addToCart}>
        <span>{selectedOffer ? formatPrice(selectedOffer.price, selectedOffer.currency, locale) : copy.outOfStock}</span>
        <button
          type="button"
          onClick={addToCart}
          disabled={unavailable || buttonState === "loading"}
          data-state={buttonState}
        >
          {buttonLabel(buttonState, unavailable, copy)}
        </button>
      </aside>
    </div>
  );
}
