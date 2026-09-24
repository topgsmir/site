"use client";

import type { Route } from "next";
import { DesignIcon } from "@/components/DesignIcon";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { getDictionary, Locale } from "@/lib/i18n";
import { currencyLabel, formatCurrencyAmount, multiplyCurrencyAmount } from "@/lib/currency";
import type { PublicProduct, PublicProductOffer, PublicProductVariant } from "./product.server";
import styles from "./ProductPage.module.css";
import { readCart, writeCart } from "@/lib/cart";
import { ProductComments } from "@/components/comments/ProductComments";
import { OfferPicker } from "@/components/product/OfferPicker";
import { PublicHeader } from "@/components/PublicHeader";
import { productPageCopy } from "./product-copy";
import { DigitalProductHeading, DigitalProductPreview, DigitalDownloadGuide, DigitalDownloadQuestions } from "@/components/product/DigitalProductDetails";
import { digitalProductCopy, downloadAllowance } from "@/components/product/digital-product-copy";

type ProductCopy = ReturnType<typeof getDictionary>["product"];
type ButtonState = "idle" | "loading" | "success" | "error";

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
  return copy.service;
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
  copy,
  editHref,
  bridgeCheckout,
  accountHref
}: {
  product: PublicProduct;
  locale: Locale;
  copy: ProductCopy;
  editHref?: Route;
  bridgeCheckout?: ReactNode;
  accountHref?: string | null;
}) {
  const c = productPageCopy[locale];
  const d = digitalProductCopy[locale];
  const isDigital = product.type === "digital";
  const isPhysical = product.type === "physical";
  const isService = product.type === "service" || product.type === "bridge";
  const isBridge = product.type === "bridge";
  const router = useRouter();
  const offers = useMemo(() => flattenOffers(product, copy), [copy, product]);
  const firstAvailableOffer = offers.find((offer) => offer.physical?.inStock !== false) ?? offers[0];
  const [selectedOfferId, setSelectedOfferId] = useState(firstAvailableOffer?.id ?? "");
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [quantity, setQuantity] = useState(1);
  const [cartError, setCartError] = useState("");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? firstAvailableOffer;
  const unavailable = !selectedOffer || selectedOffer.physical?.inStock === false;
  const productImage = product.image?.variants.find((item) => item.name === "large") ?? product.image?.variants[0];
  const requirements = isBridge ? product.bridge?.fields ?? [] : selectedOffer?.service?.inputs ?? [];
  const total = selectedOffer ? formatPrice(multiplyCurrencyAmount(selectedOffer.price, quantity), selectedOffer.currency, locale) : "";
  const actionLabel = buttonState === "success" ? c.viewCart : buttonState === "idle" && isService
    ? unavailable ? c.unavailable : c.orderService : buttonLabel(buttonState, unavailable, copy);

  function selectOffer(id: string) {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setSelectedOfferId(id);
    setButtonState("idle");
    setCartError("");
  }

  useEffect(() => {
    return () => { if (resetTimer.current) clearTimeout(resetTimer.current); };
  }, []);

  function addToCart() {
    if (buttonState === "success") {
      router.push(`/${locale}/cart`);
      return;
    }
    if (!selectedOffer || unavailable || isBridge || buttonState === "loading") return;
    setButtonState("loading");
    setCartError("");

    try {
      const items = readCart();
      const existing = items.find((item) => item.offerId === selectedOffer.id);
      if ((existing?.quantity ?? 0) + quantity > 100) {
        setCartError(c.limit);
        setButtonState("error");
        return;
      }
      if (existing) {
        existing.quantity += quantity;
        existing.productName = product.title;
      } else {
        if (items.length >= 50) {
          setButtonState("error");
          return;
        }
        items.push({ productId: product.id, productName: product.title, offerId: selectedOffer.id, quantity });
      }
      writeCart(items);
      setButtonState("success");
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setButtonState("idle"), 2500);
    } catch {
      setButtonState("error");
    }
  }

  const typeLabel = isBridge ? c.bridge : copy[product.type as Exclude<PublicProduct["type"], "bridge">];
  const category = product.category ?? copy.uncategorized;
  const fulfilmentRows: Array<{ label: string; value: string }> = [];
  if (selectedOffer?.digital) {
    fulfilmentRows.push({
      label: d.allowance,
      value: downloadAllowance(selectedOffer.digital.maxDownloads, locale)
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
    <div className={styles.page} data-product-type={product.type} dir={locale === "en" ? "ltr" : "rtl"}>
      <a className={styles.skipLink} href="#product-main">{copy.skipToContent}</a>

      <PublicHeader
        locale={locale}
        accountHref={accountHref}
        current="shop"
        languageHrefs={{
          fa: `/fa/products/${encodeURIComponent(product.slug)}`,
          en: `/en/products/${encodeURIComponent(product.slug)}`,
          ar: `/ar/products/${encodeURIComponent(product.slug)}`
        }}
      />

      <main id="product-main" className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href={`/${locale}` as Route}>{copy.home}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/${locale}/products?type=${product.type}` as Route}>{c.catalog}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.title}</span>
          {editHref ? <Link className={styles.editAction} href={editHref}>
            {locale === "fa" ? "ویرایش محصول" : locale === "ar" ? "تعديل المنتج" : "Edit product"}
          </Link> : null}
        </nav>

        {isDigital ? <DigitalProductHeading product={product} locale={locale} /> : null}
        {isPhysical ? <header className={styles.physicalHeading}>
          <p className={styles.eyebrow}>{c.equipment} <span> / {category}</span></p>
          <h1 id="product-title">{product.title}</h1>
          <p>{c.physicalIntro}</p>
        </header> : null}

        <section className={styles.hero} aria-labelledby="product-title">
          <div className={styles.productIntro}>
            {isDigital ? <DigitalProductPreview product={product} locale={locale} /> : isPhysical ? <figure className={styles.mediaStage}>
              <span className={styles.mediaCategory}>{category}</span>
              {productImage ? <Image className={styles.equipmentImage} unoptimized src={productImage.url} alt={product.title} width={productImage.width} height={productImage.height} priority /> : <div className={styles.imagePlaceholder}><DesignIcon name="layers" /><p>{c.noImage}</p></div>}
              <figcaption>{c.imageCaption}<span>{typeLabel}</span></figcaption>
            </figure> : <>
              <p className={styles.productClass}>{isService ? c.expertise : category} · {typeLabel}</p>
              <h1 id="product-title">{product.title}</h1>
              {isService ? <p className={styles.serviceLead}>{c.serviceIntro}</p> : null}
              {productImage ? <Image className={isService ? styles.serviceImage : styles.productImage} unoptimized src={productImage.url} alt={product.title} width={productImage.width} height={productImage.height} priority /> : null}
            </>}
            {isService ? <section className={styles.workflow} aria-labelledby="workflow-title">
              <h2 id="workflow-title">{c.workflow}</h2>
              <ol>{c.steps.map((step, index) => <li key={step}><span className={styles.stepNumber} aria-hidden="true">{new Intl.NumberFormat(locale).format(index + 1).padStart(locale === "en" ? 2 : 1, "0")}</span><div><h3>{step}</h3><p>{c.stepBodies[index]}</p></div></li>)}</ol>
            </section> : !isDigital ? <div className={styles.identityPlate} aria-label={copy.technicalDetails}>
              <div><span>{copy.productType}</span><strong>{typeLabel}</strong></div>
              <div><span>{copy.category}</span><strong>{category}</strong></div>
            </div> : null}
          </div>

          <aside className={styles.purchasePanel} id="purchase" aria-labelledby="purchase-title">
            <h2 id="purchase-title">{isDigital ? d.purchase : isService ? c.orderService : copy.chooseOffer}</h2>
            {isBridge ? bridgeCheckout : <>
            <p>{isDigital ? d.offerHelp : copy.offerHelp}</p>
            <OfferPicker
              offers={offers.map((offer) => ({ id: offer.id, variant: offer.variantName, seller: offer.seller.shopName, price: offer.price, currency: offer.currency, unavailable: offer.physical?.inStock === false }))}
              value={selectedOffer?.id ?? ""}
              onChange={selectOffer}
              locale={locale}
              label={copy.chooseOffer}
              sellerLabel={isService ? c.provider : copy.seller}
              unavailableLabel={c.unavailable}
            />

            {selectedOffer ? (
              <div className={styles.offerSummary}>
                <div><span>{copy.availability}</span><strong className={styles.availability} data-available={!unavailable}>{unavailable ? c.unavailable : isDigital ? d.ready : isService ? c.ready : copy.inStock}</strong></div>
                {isDigital && selectedOffer.digital ? <div aria-live="polite"><span>{d.allowance}</span><strong>{downloadAllowance(selectedOffer.digital.maxDownloads, locale)}</strong></div> : null}
                {selectedOffer.service ? <div><span>{c.turnaround}</span><strong>{new Intl.NumberFormat(locale).format(selectedOffer.service.estimatedHours)} {copy.hours}</strong></div> : null}
                <span>{isService ? c.orderPrice : c.unitPrice}</span>
                <p className={styles.price}>{formatPrice(selectedOffer.price, selectedOffer.currency, locale)}</p>
              </div>
            ) : <p className={styles.emptyOffers}>{c.empty}</p>}

            {isPhysical && selectedOffer ? <div className={styles.quantityRow}><span id="quantity-label">{c.quantity}</span><div className={styles.quantityControl} role="group" aria-labelledby="quantity-label">
              <button type="button" aria-label={c.decrease} disabled={quantity <= 1 || unavailable} onClick={() => { setQuantity(quantity - 1); setButtonState("idle"); }}>−</button>
              <output aria-live="polite">{new Intl.NumberFormat(locale).format(quantity)}</output>
              <button type="button" aria-label={c.increase} disabled={quantity >= 100 || unavailable} onClick={() => { setQuantity(quantity + 1); setButtonState("idle"); }}>+</button>
            </div></div> : null}
            {isPhysical && quantity > 1 ? <p className={styles.orderTotal}><span>{c.total}</span><strong>{total}</strong></p> : null}

            <button
              className={styles.addButton}
              type="button"
              onClick={addToCart}
              disabled={unavailable || buttonState === "loading"}
              data-state={buttonState}
              aria-busy={buttonState === "loading"}
              aria-describedby={buttonState === "error" ? "cart-feedback" : undefined}
            >
              {actionLabel}
            </button>
            <p
              id="cart-feedback"
              className={buttonState === "error" ? styles.errorMessage : styles.purchaseNote}
              role={buttonState === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {buttonState === "error" ? cartError || copy.addFailed : buttonState === "success" ? c.added : copy.priceAvailability}
            </p>
            {isPhysical ? <div className={styles.deliveryNote}><DesignIcon name="bag" /><div><strong>{c.shipping}</strong><p>{c.shippingBody}</p></div></div> : selectedOffer?.service ? <p className={styles.purchaseNote}>{c.estimateNote}</p> : null}
            </>}
          </aside>
        </section>

        {isService ? <section className={styles.requirements} aria-labelledby="requirements-title">
          <div><p className={styles.eyebrow}>{c.requirements}</p><h2 id="requirements-title">{c.preparation}</h2><p>{c.requirementsNote}</p></div>
          <div>{requirements.length ? <ul>{requirements.map((field) => <li key={field.key}><DesignIcon name="check" /><div><strong>{field.label}</strong>{field.helpText ? <p>{field.helpText}</p> : null}</div><span>{field.required ? c.required : c.optional}</span></li>)}</ul> : <p>{c.noRequirements}</p>}</div>
        </section> : null}

        <section className={styles.details} aria-labelledby={isDigital ? "download-details-title" : "overview-title"}>
          {isDigital ? <DigitalDownloadGuide locale={locale} /> : <article className={styles.description}>
            <h2 id="overview-title">{isService ? c.overview : copy.overview}</h2>
            {(product.description?.trim() || copy.noDescription).split(/\n{2,}/).map((paragraph, index) => (
              <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>
            ))}
          </article>}

          <div className={styles.specification}>
            <h2 id={isDigital ? "download-details-title" : undefined}>{isDigital ? d.details : isService ? c.details : copy.technicalDetails}</h2>
            <table>
              <tbody>
                <tr><th scope="row">{copy.productType}</th><td data-label={copy.productType}>{typeLabel}</td></tr>
                <tr><th scope="row">{copy.category}</th><td data-label={copy.category}>{category}</td></tr>
                <tr><th scope="row">{copy.fulfilment}</th><td data-label={copy.fulfilment}>{fulfilmentLabel(product, copy)}</td></tr>
                {fulfilmentRows.map((row) => (
                  <tr key={row.label}><th scope="row">{row.label}</th><td data-label={row.label}>{row.value}</td></tr>
                ))}
                {selectedOffer?.variantOptions.map((option) => <tr key={option.name}><th scope="row">{option.name}</th><td>{option.value}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>

        {isDigital ? <DigitalDownloadQuestions locale={locale} /> : null}
        {isPhysical || isService ? <section className={styles.questions} aria-labelledby="questions-title"><h2 id="questions-title">{c.questions}</h2>
          <div><details><summary>{isPhysical ? c.shipping : c.preparation}</summary><p>{isPhysical ? c.shippingBody : c.serviceFaq}</p></details>
          <details><summary>{isPhysical ? c.compatibility : c.timeFaq}</summary><p>{isPhysical ? c.compatibilityBody : c.timeAnswer}</p></details></div>
        </section> : null}

        <ProductComments productId={product.id} locale={locale} />

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

      <aside className={styles.mobileCart} aria-label={isService ? c.orderService : copy.addToCart}>
        {isDigital ? <><span>{selectedOffer ? total : copy.outOfStock}</span><a href="#purchase">{d.review}</a></> : isBridge ? <><span>{c.bridge}</span><a href="#purchase">{c.configure}</a></> : <>
        <span>{selectedOffer ? total : copy.outOfStock}</span>
        <button
          type="button"
          onClick={addToCart}
          disabled={unavailable || buttonState === "loading"}
          data-state={buttonState}
        >
          {actionLabel}
        </button>
        </>}
      </aside>
    </div>
  );
}
