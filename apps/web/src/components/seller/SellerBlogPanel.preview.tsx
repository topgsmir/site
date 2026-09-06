import styles from "./SellerDashboard.module.css";

export function SellerBlogPanelPreview() {
  const states = ["default", "hover", "focus", "active", "disabled", "loading", "error", "success"] as const;
  return <div className={styles.blogStatePreview}>{states.map((state) => <div key={state}><span>{state}</span><button className={`${styles.primaryButton} ${styles.blogAction} ${styles[`is-${state}`] ?? ""}`} data-state={state} disabled={state === "disabled"} type="button">{state === "loading" ? "Saving…" : "Publish post"}</button></div>)}</div>;
}
