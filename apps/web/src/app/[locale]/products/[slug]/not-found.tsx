import Link from "next/link";
import styles from "./ProductPage.module.css";

export default function ProductNotFound() {
  return (
    <main className={styles.notFound}>
      <h1>Product not found</h1>
      <p>محصول پیدا نشد · المنتج غير موجود</p>
      <p>The product may be unpublished or its address may have changed.</p>
      <nav aria-label="Choose language">
        <Link href="/fa">فارسی</Link>
        <Link href="/en">English</Link>
        <Link href="/ar">العربية</Link>
      </nav>
    </main>
  );
}
