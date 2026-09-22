"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { DesignIcon } from "@/components/DesignIcon";
import type { Locale } from "@/lib/i18n";
import styles from "./BlogArticle.module.css";

const COPY = {
  fa: { share: "کپی لینک مقاله", copied: "لینک کپی شد", error: "لینک کپی نشد؛ از نوار آدرس کپی کنید.", contents: "در این مقاله" },
  en: { share: "Copy article link", copied: "Link copied", error: "Could not copy. Copy the address from your browser.", contents: "In this article" },
  ar: { share: "نسخ رابط المقال", copied: "تم نسخ الرابط", error: "تعذّر النسخ. انسخ الرابط من شريط العنوان.", contents: "في هذا المقال" }
};

export function ArticleProductImage({ image }: { image?: { url: string; width: number; height: number } }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className={styles.productImage}>{image && failedUrl !== image.url
    ? <Image unoptimized src={image.url} alt="" width={image.width} height={image.height} sizes="64px" onError={() => setFailedUrl(image.url)} />
    : <DesignIcon name="layers" />}</span>;
}

export function ShareArticle({ locale }: { locale: Locale }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const copy = COPY[locale];
  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);
  async function share() {
    setBusy(true);
    try {
      const url = new URL(window.location.href);
      url.hash = "";
      await navigator.clipboard.writeText(url.href);
      setStatus("copied");
    } catch { setStatus("error"); }
    finally { setBusy(false); }
  }
  return <div className={styles.shareWrap}>
    <button className={styles.share} type="button" onClick={share} disabled={busy} aria-busy={busy}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></svg>
      {status === "copied" ? copy.copied : copy.share}
    </button>
    <span className={status === "error" ? styles.shareError : "sr-only"} role="status">{status === "copied" ? copy.copied : status === "error" ? copy.error : ""}</span>
  </div>;
}

export function ArticleContents({ locale, headings }: { locale: Locale; headings: Array<{ id: string; title: string }> }) {
  const [active, setActive] = useState("");
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const article = document.getElementById("article-body");
    if (!article) return;
    const elements = headings.map(({ id }) => document.getElementById(id)).filter((element): element is HTMLElement => Boolean(element));
    let frame = 0;
    function update() {
      frame = 0;
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / rect.height));
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
      const current = elements.filter((element) => element.getBoundingClientRect().top <= 160).at(-1);
      setActive(current?.id ?? "");
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(article);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [headings]);
  if (!headings.length) return null;
  return <details className={styles.contents}>
    <summary>{COPY[locale].contents}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
    <nav aria-label={COPY[locale].contents}>
    <div className={styles.progress} aria-hidden="true"><span ref={bar} /></div>
    <ol>{headings.map((heading, index) => <li key={heading.id}>
      <a href={`#${heading.id}`} aria-current={active === heading.id ? "location" : undefined}>
        <span>{new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(index + 1)}</span>{heading.title}
      </a>
    </li>)}</ol>
    </nav>
  </details>;
}
