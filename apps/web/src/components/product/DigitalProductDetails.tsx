import Image from "next/image";
import { DesignIcon } from "@/components/DesignIcon";
import type { PublicProduct } from "@/app/[locale]/products/[slug]/product.server";
import type { Locale } from "@/lib/i18n";
import { digitalProductCopy } from "./digital-product-copy";
import { ProductDescription } from "./ProductDescription";
import styles from "./DigitalProductDetails.module.css";

export function DigitalProductHeading({ product, locale }: { product: PublicProduct; locale: Locale }) {
  const c = digitalProductCopy[locale];
  const image = product.image?.variants.find((item) => item.name === "thumb") ?? product.image?.variants[0];
  return <header className={styles.heading}>
    <div className={styles.productIdentity}>
      <div>
        <p className={styles.eyebrow}><DesignIcon name="file" />{c.library}{product.category ? <><span aria-hidden="true">/</span><span>{product.category}</span></> : null}</p>
        <h1 id="product-title">{product.title}</h1>
      </div>
      {image ? <Image className={styles.thumbnail} unoptimized src={image.url} alt={product.title} width={image.width} height={image.height} priority /> : null}
    </div>
    <nav className={styles.sectionLinks} aria-label={c.label}>
      <a href="#download-description">{c.description}</a>
      <a href="#purchase">{c.purchase}</a>
      <a href="#download-details-title">{c.details}</a>
    </nav>
  </header>;
}

export function DigitalProductDescription({ description, locale }: { description: string | null; locale: Locale }) {
  const c = digitalProductCopy[locale];
  return <article id="download-description" className={styles.description} aria-labelledby="download-description-title" tabIndex={-1}>
    <h2 id="download-description-title">{c.description}</h2>
    <ProductDescription description={description} fallback={c.noDescription} />
  </article>;
}
