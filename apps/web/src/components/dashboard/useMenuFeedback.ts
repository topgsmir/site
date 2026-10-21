"use client";

import { useEffect, type RefObject } from "react";
import styles from "./NavigationEffects.module.css";

export function useMenuFeedback<T extends HTMLElement>(root: RefObject<T | null>, mountedElement?: HTMLElement | null) {
  useEffect(() => {
    const element = mountedElement ?? root.current;
    if (!element) return;
    element.setAttribute("data-menu-feedback", "true");
    const sparks = new Set<HTMLElement>();
    const click = (event: MouseEvent) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const target = (event.target as Element).closest<HTMLElement>("a,button,summary");
      if (!target || !element.contains(target) || target.matches(":disabled,[aria-disabled=true]")) return;
      const rect = target.getBoundingClientRect();
      const spark = document.createElement("span");
      spark.className = styles.spark;
      spark.setAttribute("aria-hidden", "true");
      spark.style.left = `${(event.detail ? event.clientX - rect.left : rect.width / 2) - 17}px`;
      spark.style.top = `${(event.detail ? event.clientY - rect.top : rect.height / 2) - 17}px`;
      target.append(spark);
      sparks.add(spark);
      target.animate([{ boxShadow: "inset 0 0 0 1px currentColor, 0 0 12px currentColor" }, { boxShadow: "none" }], { duration: 420, easing: "ease-out" });
      const animation = spark.animate([{ opacity: .9, transform: "scale(.3) rotate(0deg)" }, { opacity: 0, transform: "scale(1.5) rotate(55deg)" }], { duration: 480, easing: "ease-out" });
      void animation.finished.catch(() => {}).finally(() => { spark.remove(); sparks.delete(spark); });
    };
    element.addEventListener("click", click);
    return () => { element.removeEventListener("click", click); element.removeAttribute("data-menu-feedback"); sparks.forEach((spark) => spark.remove()); };
  }, [root, mountedElement]);
}
