import { useLayoutEffect, type RefObject } from "react";
import type { Locale } from "@/lib/i18n";
import type { AdminSection } from "./AdminPanelRoute";
import styles from "./AdminBoxDisclosures.module.css";

const STORAGE_PREFIX = "topgsm:admin-boxes:v1:";
const BOX_SELECTOR = "section, article, aside, form, [data-admin-box-key], div[class*='panel' i], div[class*='card' i], div[class*='box' i], div[class*='group' i]";
const BOX_CLASS = /(?:Panel|Card|Box|Group)__|(?:^|[-_])(panel|card|box|group)(?:$|__|\s)/;

function readPreferences(key: string): Record<string, boolean> {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    return Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"));
  } catch {
    return {};
  }
}

function boxAnchor(box: HTMLElement): HTMLElement | null {
  if (box.closest("[role='dialog'], dialog") || box.hasAttribute("data-admin-box-ignore")) return null;
  if (box.tagName === "DIV" && !box.dataset.adminBoxKey && !BOX_CLASS.test(box.className)) return null;
  const first = box.firstElementChild;
  if (!(first instanceof HTMLElement) || box.children.length < 2) return null;
  if (!first.matches("header, h2, h3, h4, div")) return null;
  if (first.querySelector("h1") || first.matches("h1")) return null;
  const heading = first.matches("h2, h3, h4") ? first : first.querySelector("h2, h3, h4");
  if (heading) return first;
  if (box.dataset.adminBoxKey && first.querySelector("strong")) return first;
  if (box.tagName === "ARTICLE" && BOX_CLASS.test(box.className) && first.querySelector("strong")) return first;
  return null;
}

function boxKey(box: HTMLElement, root: HTMLElement, section: AdminSection, subjectId?: string): string {
  const explicit = box.dataset.adminBoxKey ?? box.id ?? box.getAttribute("aria-labelledby");
  if (explicit) return `${section}:${subjectId ?? ""}:${explicit}`;
  const path: string[] = [];
  let current: HTMLElement | null = box;
  while (current && current !== root) {
    const parent: HTMLElement | null = current.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter((child) => child.tagName === current?.tagName);
    path.unshift(`${current.tagName.toLowerCase()}:${siblings.indexOf(current)}`);
    current = parent;
  }
  return `${section}:${subjectId ?? ""}:${path.join("/")}`;
}

function labelFor(box: HTMLElement): string {
  return box.querySelector(":scope > header :is(h2, h3, h4, strong), :scope > :is(h2, h3, h4), :scope > div :is(h2, h3, h4, strong)")?.textContent?.trim() ?? "";
}

export function useAdminBoxDisclosures(
  rootRef: RefObject<HTMLElement | null>,
  adminUserId: string,
  section: AdminSection,
  subjectId: string | undefined,
  locale: Locale
) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !adminUserId) return;
    const storageKey = `${STORAGE_PREFIX}${adminUserId}`;
    const preferences = readPreferences(storageKey);
    const translated = {
      en: { open: "Expand", close: "Collapse" },
      fa: { open: "باز کردن", close: "جمع کردن" },
      ar: { open: "توسيع", close: "طي" }
    }[locale];

    function setCollapsed(box: HTMLElement, collapsed: boolean) {
      box.dataset.adminBoxCollapsed = String(collapsed);
      const button = box.querySelector<HTMLButtonElement>(`:scope > .${styles.toggle}`);
      if (!button) return;
      button.setAttribute("aria-expanded", String(!collapsed));
      button.setAttribute("aria-label", `${collapsed ? translated.open : translated.close}: ${labelFor(box)}`);
      button.title = collapsed ? translated.open : translated.close;
    }

    function savePreferences() {
      const keys = Object.keys(preferences);
      for (const oldKey of keys.slice(0, Math.max(0, keys.length - 500))) delete preferences[oldKey];
      try { window.localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Storage may be unavailable; the current page still works. */ }
    }

    function scan() {
      for (const box of root!.querySelectorAll<HTMLElement>(BOX_SELECTOR)) {
        if (box.parentElement === root) continue;
        const anchor = boxAnchor(box);
        if (!anchor) continue;
        const key = boxKey(box, root!, section, subjectId);
        box.dataset.adminBoxPreferenceKey = key;
        box.classList.add(styles.box);
        anchor.classList.add(styles.anchor);
        let button = box.querySelector<HTMLButtonElement>(`:scope > .${styles.toggle}`);
        if (!button) {
          button = document.createElement("button");
          button.type = "button";
          button.className = styles.toggle;
          button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" /></svg>';
          box.append(button);
        }
        setCollapsed(box, preferences[key] ?? false);
      }
      for (const disclosure of root!.querySelectorAll<HTMLElement>("[data-admin-filter-disclosure]")) {
        if (disclosure.dataset.adminFilterRestored) continue;
        disclosure.dataset.adminFilterRestored = "true";
        const key = boxKey(disclosure, root!, section, subjectId);
        disclosure.dataset.adminFilterPreferenceKey = key;
        const desired = preferences[key];
        if (desired === undefined || (disclosure.dataset.open === "false") === desired) continue;
        disclosure.querySelector<HTMLButtonElement>(":scope > button[aria-expanded]")?.click();
      }
      for (const disclosure of root!.querySelectorAll<HTMLDetailsElement>("details")) {
        if (disclosure.dataset.adminDetailPreferenceKey || !disclosure.querySelector(":scope > summary")) continue;
        const key = `details:${boxKey(disclosure, root!, section, subjectId)}`;
        disclosure.dataset.adminDetailPreferenceKey = key;
        if (preferences[key] !== undefined) disclosure.open = preferences[key];
      }
    }

    let frame = 0;
    const scheduleScan = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        scan();
      });
    };
    const observer = new MutationObserver(scheduleScan);
    observer.observe(root, { childList: true, subtree: true });
    scan();

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const filterButton = target.closest<HTMLButtonElement>("[data-admin-filter-disclosure] > button[aria-expanded]");
      if (filterButton && root.contains(filterButton)) {
        const key = filterButton.parentElement?.dataset.adminFilterPreferenceKey;
        if (key) {
          preferences[key] = filterButton.getAttribute("aria-expanded") === "true";
          savePreferences();
        }
        return;
      }
      const button = target.closest<HTMLButtonElement>(`.${styles.toggle}`);
      const box = button?.parentElement;
      if (!button || !box || !root.contains(box)) return;
      event.stopPropagation();
      const collapsed = box.dataset.adminBoxCollapsed !== "true";
      setCollapsed(box, collapsed);
      const key = box.dataset.adminBoxPreferenceKey;
      if (!key) return;
      if (collapsed) preferences[key] = true;
      else delete preferences[key];
      savePreferences();
    };
    const onInvalid = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      let box = target.closest<HTMLElement>(`.${styles.box}[data-admin-box-collapsed='true']`);
      while (box && root.contains(box)) {
        setCollapsed(box, false);
        const key = box.dataset.adminBoxPreferenceKey;
        if (key) delete preferences[key];
        box = box.parentElement?.closest<HTMLElement>(`.${styles.box}[data-admin-box-collapsed='true']`) ?? null;
      }
      savePreferences();
    };
    const onDetailToggle = (event: Event) => {
      const disclosure = event.target;
      if (!(disclosure instanceof HTMLDetailsElement)) return;
      const key = disclosure.dataset.adminDetailPreferenceKey;
      if (!key) return;
      preferences[key] = disclosure.open;
      savePreferences();
    };
    root.addEventListener("click", onClick);
    root.addEventListener("invalid", onInvalid, true);
    root.addEventListener("toggle", onDetailToggle, true);
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      root.removeEventListener("click", onClick);
      root.removeEventListener("invalid", onInvalid, true);
      root.removeEventListener("toggle", onDetailToggle, true);
    };
  }, [rootRef, adminUserId, section, subjectId, locale]);
}
