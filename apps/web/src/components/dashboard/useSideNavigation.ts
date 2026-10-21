"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sideMenuPosition } from "./menu-position";
import { useMenuFeedback } from "./useMenuFeedback";

/** Top-layer panels escape the rail's scrolling region without changing its height. */
export function useSideNavigation() {
  const root = useRef<HTMLElement>(null);
  const [navigationElement, setNavigationElement] = useState<HTMLElement | null>(null);
  const attach = useCallback((element: HTMLElement | null) => { root.current = element; setNavigationElement(element); }, []);
  useMenuFeedback(root, navigationElement);
  useEffect(() => {
    const nav = navigationElement;
    if (!nav) return;
    const pairs = () => Array.from(nav.querySelectorAll<HTMLButtonElement>("button[aria-controls][aria-expanded]")).flatMap((trigger) => {
      const panel = document.getElementById(trigger.getAttribute("aria-controls")!);
      return panel && nav.contains(panel) ? [{ trigger, panel }] : [];
    });
    const close = (trigger: HTMLButtonElement, focus = false) => {
      if (trigger.getAttribute("aria-expanded") === "true") trigger.click();
      if (focus) trigger.focus({ preventScroll: true });
    };
    const position = (trigger: HTMLElement, panel: HTMLElement) => {
      const width = Math.min(240, window.innerWidth - 24);
      panel.style.setProperty("--side-menu-width", `${width}px`);
      panel.style.setProperty("--side-menu-height", `${window.innerHeight - 24}px`);
      const height = Math.min(panel.scrollHeight || 200, window.innerHeight - 24);
      const point = sideMenuPosition(trigger.getBoundingClientRect(), width, height, window.innerWidth, window.innerHeight);
      panel.style.setProperty("--side-menu-left", `${point.left}px`);
      panel.style.setProperty("--side-menu-top", `${point.top}px`);
    };
    const sync = () => {
      for (const { trigger, panel } of pairs()) {
        panel.dataset.sideMenu = "true";
        if (typeof panel.showPopover === "function") panel.setAttribute("popover", "manual");
        const open = trigger.getAttribute("aria-expanded") === "true";
        if (open) {
          position(trigger, panel);
          if (panel.hasAttribute("popover") && !panel.matches(":popover-open")) panel.showPopover();
          position(trigger, panel);
        } else if (panel.matches(":popover-open")) panel.hidePopover();
      }
    };
    const click = (event: MouseEvent) => {
      const target = event.target as Element;
      const clicked = target.closest("button[aria-controls][aria-expanded]");
      for (const { trigger, panel } of pairs()) {
        if (clicked === trigger) continue;
        if (!panel.contains(target) || target.closest("a,button")) close(trigger);
      }
    };
    const outside = (event: PointerEvent) => {
      if (!nav.contains(event.target as Node)) pairs().forEach(({ trigger }) => close(trigger));
    };
    const keyboard = (event: KeyboardEvent) => {
      const pair = pairs().find(({ trigger, panel }) => trigger === event.target || panel.contains(event.target as Node));
      if (!pair) return;
      if (event.key === "Escape") { close(pair.trigger, true); event.preventDefault(); }
      if (event.key === "ArrowLeft" && event.target === pair.trigger) {
        if (pair.trigger.getAttribute("aria-expanded") !== "true") pair.trigger.click();
        requestAnimationFrame(() => pair.panel.querySelector<HTMLElement>("a,button:not(:disabled)")?.focus());
        event.preventDefault();
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(nav, { subtree: true, attributes: true, attributeFilter: ["data-open", "aria-expanded"], childList: true });
    nav.addEventListener("click", click, true);
    nav.addEventListener("keydown", keyboard);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, { capture: true, passive: true });
    sync();
    return () => {
      observer.disconnect();
      nav.removeEventListener("click", click, true);
      nav.removeEventListener("keydown", keyboard);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
      for (const { panel } of pairs()) {
        if (panel.matches(":popover-open")) panel.hidePopover();
        panel.removeAttribute("popover");
        delete panel.dataset.sideMenu;
      }
    };
  }, [navigationElement]);
  return attach;
}
