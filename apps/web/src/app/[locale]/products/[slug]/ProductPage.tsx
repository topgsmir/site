"use client";

import type { Route } from "next";
import axios from "axios";
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
import { api, API_BASE } from "@/lib/api/client";
import { marketingVisitFor, rememberMarketingVisit } from "@/lib/marketing-attribution";
import { ProductComments } from "@/components/comments/ProductComments";
import { OfferPicker } from "@/components/product/OfferPicker";
import { DigitalOfferTable } from "@/components/product/DigitalOfferTable";
import { PublicHeader } from "@/components/PublicHeader";
import { productPageCopy } from "./product-copy";
import { DigitalProductHeading, DigitalProductDescription } from "@/components/product/DigitalProductDetails";
import { digitalProductCopy, downloadAllowance } from "@/components/product/digital-product-copy";
import { ProductDescription } from "@/components/product/ProductDescription";

type ProductCopy = ReturnType<typeof getDictionary>["product"];
type ButtonState = "idle" | "loading" | "success" | "error";
type DigitalAccess = {
  orderId: string | null;
  files: Array<{ downloadUrl: string; maxDownloads: number; downloadCount: number }>;
};

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
  accountHref,
  signedInBuyer = false,
  visitId
}: {
  product: PublicProduct;
  locale: Locale;
  copy: ProductCopy;
  editHref?: Route;
  bridgeCheckout?: ReactNode;
  accountHref?: string | null;
  signedInBuyer?: boolean;
  visitId?: string;
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
  const [downloadChoices, setDownloadChoices] = useState<Array<{ href: string; available: boolean }>>([]);
  const [accessOrderId, setAccessOrderId] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!visitId) return;
    rememberMarketingVisit(product.id, visitId);
    const items = readCart();
    let changed = false;
    for (const item of items) if (item.productId === product.id && item.visitId !== visitId) { item.visitId = visitId; changed = true; }
    if (changed) writeCart(items);
  }, [product.id, visitId]);
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? firstAvailableOffer;
  const unavailable = !selectedOffer || selectedOffer.physical?.inStock === false;
  const isFreeDigital = isDigital && Boolean(selectedOffer && /^0(?:\.0+)?$/.test(selectedOffer.price));
  const productImage = product.image?.variants.find((item) => item.name === "large") ?? product.image?.variants[0];
  const requirements = isBridge ? product.bridge?.fields ?? [] : selectedOffer?.service?.inputs ?? [];
  const total = selectedOffer ? isFreeDigital ? d.free : formatPrice(multiplyCurrencyAmount(selectedOffer.price, quantity), selectedOffer.currency, locale) : "";
  const actionLabel = isDigital ? buttonState === "loading" ? d.checking : d.download : buttonState === "success" ? c.viewCart : buttonState === "idle" && isService
    ? unavailable ? c.unavailable : c.orderService : buttonLabel(buttonState, unavailable, copy);

  function selectOffer(id: string) {
    if (isDigital && buttonState === "loading") return;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setSelectedOfferId(id);
    setButtonState("idle");
    setCartError("");
    setDownloadChoices([]);
    setAccessOrderId(null);
  }

  useEffect(() => {
    return () => { if (resetTimer.current) clearTimeout(resetTimer.current); };
  }, []);

  useEffect(() => {
    if (downloadChoices.length > 1) document.getElementById("download-choices")?.focus();
  }, [downloadChoices]);

  function addToCart(goToCart = false) {
    if (buttonState === "success") {
      router.push(`/${locale}/cart`);
      return;
    }
    if (!selectedOffer || unavailable || isBridge || (buttonState === "loading" && !goToCart)) return;
    setButtonState("loading");
    setCartError("");

    try {
      const items = readCart();
      const existing = items.find((item) => item.offerId === selectedOffer.id);
      if ((existing?.quantity ?? 0) + (isDigital && existing ? 0 : quantity) > 100) {
        setCartError(c.limit);
        setButtonState("error");
        return;
      }
      const attribution = (visitId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitId) ? visitId : undefined) ?? marketingVisitFor(product.id);
      if (existing) {
        if (!isDigital) existing.quantity += quantity;
        existing.productName = product.title;
        if (attribution) existing.visitId = attribution;
      } else {
        if (items.length >= 50) {
          setButtonState("error");
          return;
        }
        items.push({ productId: product.id, productName: product.title, offerId: selectedOffer.id, quantity, ...(attribution ? { visitId: attribution } : {}) });
      }
      writeCart(items);
      if (goToCart) {
        router.push(`/${locale}/cart`);
        return;
      }
      setButtonState("success");
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setButtonState("idle"), 2500);
    } catch {
      setButtonState("error");
    }
  }

  async function downloadDigital() {
    if (!selectedOffer || unavailable || buttonState === "loading") return;
    const returnPath = `/${locale}/products/${encodeURIComponent(product.slug)}`;
    if (!signedInBuyer) {
      if (accountHref) {
        setCartError(d.buyerOnly);
        setButtonState("error");
      } else {
        router.push(`/${locale}/login?next=${encodeURIComponent(returnPath)}`);
      }
      return;
    }
    setButtonState("loading");
    setCartError("");
    setDownloadChoices([]);
    setAccessOrderId(null);
    if (isFreeDigital) {
      try {
        await api.get("/auth/me");
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          setButtonState("idle");
          router.push(`/${locale}/login?next=${encodeURIComponent(returnPath)}`);
        } else {
          setCartError(d.accessFailed);
          setButtonState("error");
        }
        return;
      }
      const files = Array.from({ length: selectedOffer.digital?.fileCount ?? 1 }, (_, index) => ({
        href: `${API_BASE}/orders/free-download/${selectedOffer.id}?fileIndex=${index}`,
        available: true
      }));
      if (files.length === 1) window.location.assign(files[0]!.href);
      else setDownloadChoices(files);
      setButtonState("idle");
      return;
    }
    try {
      const { data } = await api.get<DigitalAccess>(`/orders/digital-access/${selectedOffer.id}`);
      if (!data.orderId) {
        addToCart(true);
        return;
      }
      setAccessOrderId(data.orderId);
      const files = data.files.map((file) => ({
        href: `${API_BASE}${file.downloadUrl}`,
        available: file.maxDownloads <= 0 || file.downloadCount < file.maxDownloads
      }));
      if (files.length === 1 && files[0]!.available) {
        window.location.assign(files[0]!.href);
      } else if (files.some((file) => file.available)) {
        setDownloadChoices(files);
      } else {
        setCartError(d.limitReached);
        setButtonState("error");
        return;
      }
      setButtonState("idle");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setButtonState("idle");
        router.push(`/${locale}/login?next=${encodeURIComponent(returnPath)}`);
      } else {
        setCartError(d.accessFailed);
        setButtonState("error");
      }
    }
  }

  const typeLabel = isBridge ? c.bridge : copy[product.type as Exclude<PublicProduct["type"], "bridge">];
  const category = product.category ?? copy.uncategorized;
  const fulfilmentRows: Array<{ label: string; value: string }> = [];
  if (selectedOffer?.digital && !isFreeDigital) {
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

  const purchaseAction = <button
    className={styles.addButton}
    type="button"
    onClick={isDigital ? () => { void downloadDigital(); } : () => addToCart()}
    disabled={unavailable || buttonState === "loading"}
    data-state={buttonState}
    aria-busy={buttonState === "loading"}
    aria-describedby={buttonState === "error" ? "cart-feedback" : undefined}
  >{actionLabel}</button>;

  const purchaseFeedback = <>
    {!isDigital || buttonState === "error" ? <p id="cart-feedback" className={buttonState === "error" ? styles.errorMessage : styles.purchaseNote}
      role={buttonState === "error" ? "alert" : "status"} aria-live="polite">
      {buttonState === "error" ? cartError || copy.addFailed : buttonState === "success" ? c.added : copy.priceAvailability}
    </p> : null}
    {isDigital && accessOrderId && buttonState === "error" ? <Link href={`/${locale}/orders/${accessOrderId}` as Route}>{d.viewOrder}</Link> : null}
    {isDigital && downloadChoices.length > 1 ? <div id="download-choices" className={styles.downloadChoices} role="group" aria-label={d.chooseFile} tabIndex={-1}>
      <span>{d.chooseFile}</span>
      {downloadChoices.map((file, index) => file.available
        ? <a key={file.href} href={file.href} target="_blank" rel="noopener noreferrer">{d.file} {new Intl.NumberFormat(locale).format(index + 1)}</a>
        : <span key={file.href}>{d.file} {new Intl.NumberFormat(locale).format(index + 1)} · {d.limitReached}</span>)}
    </div> : null}
  </>;

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
            {isDigital ? <DigitalProductDescription description={product.description} locale={locale} /> : isPhysical ? <figure className={styles.mediaStage}>
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

          <aside className={styles.purchasePanel} id="purchase" aria-labelledby="purchase-title" tabIndex={-1}>
            {isDigital ? <DigitalOfferTable
              offers={offers}
              optionNames={product.options.map((option) => option.name)}
              value={selectedOffer?.id ?? ""}
              onChange={selectOffer}
              locale={locale}
              disabled={buttonState === "loading"}
              action={purchaseAction}
            >{purchaseFeedback}</DigitalOfferTable> : <>
            <h2 id="purchase-title">{isService ? c.orderService : copy.chooseOffer}</h2>
            {isBridge ? bridgeCheckout : <>
            <p>{copy.offerHelp}</p>
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
                <div><span>{copy.availability}</span><strong className={styles.availability} data-available={!unavailable}>{unavailable ? c.unavailable : isService ? c.ready : copy.inStock}</strong></div>
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

            {purchaseAction}
            {purchaseFeedback}
            {isPhysical ? <div className={styles.deliveryNote}><DesignIcon name="bag" /><div><strong>{c.shipping}</strong><p>{c.shippingBody}</p></div></div> : selectedOffer?.service ? <p className={styles.purchaseNote}>{c.estimateNote}</p> : null}
            </>}
            </>}
          </aside>
        </section>

        {isService ? <section className={styles.requirements} aria-labelledby="requirements-title">
          <div><p className={styles.eyebrow}>{c.requirements}</p><h2 id="requirements-title">{c.preparation}</h2><p>{c.requirementsNote}</p></div>
          <div>{requirements.length ? <ul>{requirements.map((field) => <li key={field.key}><DesignIcon name="check" /><div><strong>{field.label}</strong>{field.helpText ? <p>{field.helpText}</p> : null}</div><span>{field.required ? c.required : c.optional}</span></li>)}</ul> : <p>{c.noRequirements}</p>}</div>
        </section> : null}

        <section className={styles.details} aria-labelledby={isDigital ? "download-details-title" : "overview-title"}>
          {!isDigital ? <article className={styles.description}>
            <h2 id="overview-title">{isService ? c.overview : copy.overview}</h2>
            <ProductDescription description={product.description} fallback={copy.noDescription} />
          </article> : null}

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

        {isPhysical || isService ? <section className={styles.questions} aria-labelledby="questions-title"><h2 id="questions-title">{c.questions}</h2>
          <div><details><summary>{isPhysical ? c.shipping : c.preparation}</summary><p>{isPhysical ? c.shippingBody : c.serviceFaq}</p></details>
          <details><summary>{isPhysical ? c.compatibility : c.timeFaq}</summary><p>{isPhysical ? c.compatibilityBody : c.timeAnswer}</p></details></div>
        </section> : null}

        <ProductComments productId={product.id} locale={locale} />

        <section className={styles.support} aria-labelledby="support-title">
          <div>
            <h2 id="support-title">{copy.supportTitle}</h2>
            {!isDigital ? <p>{copy.supportBody}</p> : null}
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

      {!isDigital ? <aside className={styles.mobileCart} aria-label={isService ? c.orderService : copy.addToCart}>
        {isBridge ? <><span>{c.bridge}</span><a href="#purchase">{c.configure}</a></> : <>
        <span>{selectedOffer ? total : copy.outOfStock}</span>
        <button
          type="button"
          onClick={() => addToCart()}
          disabled={unavailable || buttonState === "loading"}
          data-state={buttonState}
        >
          {actionLabel}
        </button>
        </>}
      </aside> : null}
    </div>
  );
}
