"use client";

import type { Route } from "next";
import { DesignIcon } from "@/components/DesignIcon";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { getDictionary, Locale } from "@/lib/i18n";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import {
  GoghdiAuthenticationRequiredError,
  goghdiEnabled,
  openGoghdiProductTicket
} from "@/lib/goghdi/goghdi";
import type { PublicProduct, PublicProductOffer, PublicProductVariant } from "./product.server";
import styles from "./ProductPage.module.css";
import { CART_EVENT, cartQuantity, readCart, writeCart } from "@/lib/cart";
import { ProductComments } from "@/components/comments/ProductComments";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HeaderSearch } from "@/components/HeaderSearch";

type ProductCopy = ReturnType<typeof getDictionary>["product"];
type ButtonState = "idle" | "loading" | "success" | "error";
type SupportState = "idle" | "loading" | "error";

type SelectableOffer = PublicProductOffer & {
  variantId: string;
  variantName: string;
  variantOptions: Array<{ name: string; value: string }>;
};


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
  const numberLocale = locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en";
  return `${formatCurrencyAmount(price, currency, numberLocale)} ${currencyLabel(currency)}`;
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
  const router = useRouter();
  const offers = useMemo(() => flattenOffers(product, copy), [copy, product]);
  const firstAvailableOffer = offers.find((offer) => offer.physical?.inStock !== false) ?? offers[0];
  const [selectedOfferId, setSelectedOfferId] = useState(firstAvailableOffer?.id ?? "");
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [cartCount, setCartCount] = useState(0);
  const [supportState, setSupportState] = useState<SupportState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? firstAvailableOffer;
  const unavailable = !selectedOffer || selectedOffer.physical?.inStock === false;
  const productImage = product.image?.variants.find((item) => item.name === "large") ?? product.image?.variants[0];

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
    if (buttonState === "success") {
      router.push(`/${locale}/cart`);
      return;
    }
    if (!selectedOffer || unavailable) return;
    setButtonState("loading");

    try {
      const items = readCart();
      const existing = items.find((item) => item.offerId === selectedOffer.id);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + 1, 100);
        existing.productName = product.title;
      } else {
        if (items.length >= 50) {
          setButtonState("error");
          return;
        }
        items.push({ productId: product.id, productName: product.title, offerId: selectedOffer.id, quantity: 1 });
      }
      writeCart(items);
      setButtonState("success");
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setButtonState("idle"), 2500);
    } catch {
      setButtonState("error");
    }
  }

  async function openProductSupport() {
    if (supportState === "loading") return;
    setSupportState("loading");
    try {
      await openGoghdiProductTicket(product.id);
      setSupportState("idle");
    } catch (error) {
      if (error instanceof GoghdiAuthenticationRequiredError) {
        router.push(`/${locale}/login`);
        return;
      }
      setSupportState("error");
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
          <span className={styles.brandSymbol}><DesignIcon name="layers" /></span>
          <strong dir="ltr" translate="no">topgsm.</strong>
        </Link>
        <div className={styles.navigationTools}>
          <HeaderSearch locale={locale} />
          <LanguageSwitcher
            locale={locale}
            hrefs={{
              fa: `/fa/products/${encodeURIComponent(product.slug)}`,
              en: `/en/products/${encodeURIComponent(product.slug)}`,
              ar: `/ar/products/${encodeURIComponent(product.slug)}`
            }}
          />
          <Link href={`/${locale}/cart` as Route} className={styles.cartIndicator} aria-label={`${countLabel} ${copy.itemCount}`}>
            <span>{copy.cart}</span><strong>{countLabel}</strong>
          </Link>
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
            {productImage ? <Image className={styles.productImage} unoptimized src={productImage.url} alt={product.title} width={productImage.width} height={productImage.height} priority /> : null}
            <p className={styles.productClass}>{category} · {typeLabel}</p>
            <h1 id="product-title">{product.title}</h1>
            <div className={styles.identityPlate} aria-label={copy.technicalDetails}>
              <div><span>{copy.productType}</span><strong>{typeLabel}</strong></div>
              <div><span>{copy.category}</span><strong>{category}</strong></div>
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

        <ProductComments productId={product.id} locale={locale} />

        <section className={styles.support} aria-labelledby="support-title">
          <div>
            <h2 id="support-title">{copy.supportTitle}</h2>
            <p>{copy.supportBody}</p>
          </div>
          {goghdiEnabled ? (
            <button
              type="button"
              onClick={() => void openProductSupport()}
              disabled={supportState === "loading"}
            >
              {supportState === "loading" ? copy.openingSupport : copy.contactSupport}
              <span aria-hidden="true">↗</span>
            </button>
          ) : (
            <a href="tel:09925739312">{copy.contactSupport}<span aria-hidden="true">↗</span></a>
          )}
          {supportState === "error" ? <p className={styles.supportError} role="alert">{copy.supportError}</p> : null}
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <strong dir="ltr" translate="no">topgsm.</strong>
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
