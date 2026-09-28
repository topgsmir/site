import { RichText } from "@/components/blog/RichText";
import { productDescriptionDocument } from "@/lib/product-description";
import styles from "./ProductDescription.module.css";

export function ProductDescription({ description, fallback }: { description: string | null | undefined; fallback: string }) {
  const document = productDescriptionDocument(description);
  if (document) return <RichText document={document} className={styles.prose} />;
  return <>{(description?.trim() || fallback).split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</>;
}
