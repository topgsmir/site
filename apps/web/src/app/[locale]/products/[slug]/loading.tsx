import styles from "./ProductPage.module.css";

export default function ProductLoading() {
  return (
    <main className={styles.loadingFrame} aria-busy="true" aria-label="Loading product">
      <div />
      <div />
    </main>
  );
}
