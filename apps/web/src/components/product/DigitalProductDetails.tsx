import Image from "next/image";
import { DesignIcon } from "@/components/DesignIcon";
import type { PublicProduct } from "@/app/[locale]/products/[slug]/product.server";
import type { Locale } from "@/lib/i18n";
import { digitalProductCopy } from "./digital-product-copy";
import styles from "./DigitalProductDetails.module.css";

export function DigitalProductHeading({ product, locale }: { product: PublicProduct; locale: Locale }) {
  const c = digitalProductCopy[locale];
  return <header className={styles.heading}>
    <p className={styles.eyebrow}><DesignIcon name="file" />{c.library}{product.category ? <><span aria-hidden="true">/</span><span>{product.category}</span></> : null}</p>
    <h1 id="product-title">{product.title}</h1>
    <DigitalProductDescription description={product.description} locale={locale} />
  </header>;
}

export function DigitalProductPreview({ product, locale }: { product: PublicProduct; locale: Locale }) {
  const c = digitalProductCopy[locale];
  const image = product.image?.variants.find((item) => item.name === "large") ?? product.image?.variants[0];
  return <div className={styles.previewColumn}>
    <figure className={styles.preview}>
      <div className={styles.previewLabel}><DesignIcon name="file" /><span>{c.label}</span></div>
      {image ? <Image className={styles.image} unoptimized src={image.url} alt={product.title} width={image.width} height={image.height} priority /> : <div className={styles.fileCover}>
        <DesignIcon name="file" className={styles.fileIcon} />
        <strong>{product.title}</strong>
        <span>{c.noPreview}</span>
      </div>}
      <figcaption><span>{c.preview}</span><span dir="ltr" translate="no">topgsm.</span></figcaption>
    </figure>
    <div className={styles.delivery}><DesignIcon name="file" /><div><strong>{c.delivery}</strong><p>{c.deliveryBody}</p></div></div>
  </div>;
}

function DigitalProductDescription({ description, locale }: { description: string | null; locale: Locale }) {
  const c = digitalProductCopy[locale];
  return <div id="download-description" className={styles.description} aria-label={c.description}>
    {(description?.trim() || c.noDescription).split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
  </div>;
}

export function DigitalDownloadGuide({ locale }: { locale: Locale }) {
  const c = digitalProductCopy[locale];
  return <section className={styles.guide} aria-labelledby="download-guide-title">
    <header><h2 id="download-guide-title">{c.guide}</h2><p>{c.guideIntro}</p></header>
    <ol>{c.steps.map((step, index) => <li key={step.title}>
      <span className={styles.stepNumber} aria-hidden="true">{new Intl.NumberFormat(locale).format(index + 1)}</span>
      <div><h3>{step.title}</h3><p>{step.body}</p></div>
    </li>)}</ol>
  </section>;
}

export function DigitalDownloadQuestions({ locale }: { locale: Locale }) {
  const c = digitalProductCopy[locale];
  return <section className={styles.questions} aria-labelledby="download-questions-title">
    <h2 id="download-questions-title">{c.questions}</h2>
    <div>{[[c.accessQuestion, c.accessAnswer], [c.limitQuestion, c.limitAnswer], [c.compatibilityQuestion, c.compatibilityAnswer]].map(([question, answer]) => <details key={question}>
      <summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p>
    </details>)}</div>
  </section>;
}
