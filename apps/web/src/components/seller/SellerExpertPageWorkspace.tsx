"use client";

import { scheduleEffectTask } from "@/lib/effect-task";
import axios from "axios";
import Link from "next/link";
import type { Route } from "next";
import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import type { ExpertPageBlock, SellerExpertPage, SellerPageProductChoice, SellerPageProductChoices } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./SellerExpertPageWorkspace.module.css";

type Drag = { list: string; from: number; to: number };
type Picker = { blockId: string; query: string; items: SellerPageProductChoice[]; cursor: string | null; loading: boolean; error: string };

const copy = {
  fa: {
    title: "صفحه کارشناس",
    intro: "نام و معرفی پروفایل بالای صفحه می‌ماند. بخش‌ها را بکشید و جابه‌جا کنید و محصولات خودتان را به صفحه اضافه کنید.",
    profile: "ویرایش معرفی",
    preview: "مشاهده صفحه",
    addText: "بخش متن",
    addProducts: "بخش محصولات",
    empty: "هنوز بخشی نساخته‌اید. یک متن بنویسید یا محصولاتتان را بچینید.",
    limit: "صفحه حداکثر ۱۲ بخش دارد.",
    drag: "کشیدن برای جابه‌جایی",
    up: "انتقال به بالا",
    down: "انتقال به پایین",
    remove: "حذف بخش",
    textTitle: "عنوان",
    textBody: "متن",
    textTitlePlaceholder: "مثلاً روش کار من",
    textBodyPlaceholder: "تجربه، خدمات یا توضیحی که مشتری باید قبل از خرید بداند.",
    productsTitle: "عنوان بخش",
    productsTitlePlaceholder: "مثلاً فایل‌های سامسونگ",
    addProduct: "افزودن محصول",
    closeProducts: "بستن فهرست",
    search: "جست‌وجوی محصول",
    noMatches: "محصولی با این عبارت پیدا نشد.",
    more: "نمایش بیشتر",
    added: "در صفحه هست",
    place: "افزودن",
    missing: "این محصول دیگر در فروشگاه شما نیست.",
    removeProduct: "برداشتن",
    dragProduct: "کشیدن محصول",
    hint: "در صفحه عمومی فقط محصولاتی دیده می‌شوند که الان قابل خرید هستند.",
    titleRequired: "برای بخش متن یک عنوان بنویسید.",
    bodyRequired: "متن این بخش را بنویسید.",
    productsRequired: "حداقل یک محصول به این بخش اضافه کنید.",
    sectionFull: "هر بخش حداکثر ۸ محصول دارد.",
    duplicate: "این محصول یک‌بار در صفحه قرار می‌گیرد.",
    save: "ذخیره صفحه",
    saving: "در حال ذخیره…",
    saved: "صفحه ذخیره شد.",
    loadError: "صفحه بارگذاری نشد.",
    saveError: "صفحه ذخیره نشد.",
    productsError: "فهرست محصولات بارگذاری نشد.",
    retry: "تلاش دوباره",
    status: { draft: "پیش‌نویس", pending_review: "در بررسی", active: "", archived: "بایگانی", trashed: "حذف‌شده" }
  },
  en: {
    title: "Expert page",
    intro: "Your name and profile introduction stay at the top. Drag sections into order and place your own products on the page.",
    profile: "Edit introduction",
    preview: "View page",
    addText: "Text section",
    addProducts: "Product section",
    empty: "This page has no sections yet. Write a note or arrange your products.",
    limit: "A page can contain 12 sections.",
    drag: "Drag to reorder",
    up: "Move up",
    down: "Move down",
    remove: "Remove section",
    textTitle: "Title",
    textBody: "Text",
    textTitlePlaceholder: "For example, how I work",
    textBodyPlaceholder: "Experience, services, or what a customer should know before buying.",
    productsTitle: "Section title",
    productsTitlePlaceholder: "For example, Samsung files",
    addProduct: "Add product",
    closeProducts: "Close list",
    search: "Search products",
    noMatches: "No product matches that search.",
    more: "Show more",
    added: "On the page",
    place: "Add",
    missing: "This product is no longer in your shop.",
    removeProduct: "Remove",
    dragProduct: "Drag product",
    hint: "The public page shows only products that can be bought right now.",
    titleRequired: "Add a title for this text section.",
    bodyRequired: "Write the text for this section.",
    productsRequired: "Add at least one product to this section.",
    sectionFull: "Each section can hold 8 products.",
    duplicate: "Each product can appear once on the page.",
    save: "Save page",
    saving: "Saving…",
    saved: "Page saved.",
    loadError: "The page could not be loaded.",
    saveError: "The page could not be saved.",
    productsError: "The product list could not be loaded.",
    retry: "Try again",
    status: { draft: "Draft", pending_review: "In review", active: "", archived: "Archived", trashed: "Removed" }
  },
  ar: {
    title: "صفحة الخبير",
    intro: "يبقى الاسم والنبذة في أعلى الصفحة. اسحب الأقسام لترتيبها وأضف منتجاتك إليها.",
    profile: "تعديل النبذة",
    preview: "عرض الصفحة",
    addText: "قسم نصي",
    addProducts: "قسم منتجات",
    empty: "لم تضف أقساماً بعد. اكتب ملاحظة أو رتّب منتجاتك.",
    limit: "الصفحة تتسع لـ ١٢ قسماً كحد أقصى.",
    drag: "اسحب لإعادة الترتيب",
    up: "نقل لأعلى",
    down: "نقل لأسفل",
    remove: "حذف القسم",
    textTitle: "العنوان",
    textBody: "النص",
    textTitlePlaceholder: "مثلاً طريقة عملي",
    textBodyPlaceholder: "الخبرة أو الخدمات أو ما يجب أن يعرفه العميل قبل الشراء.",
    productsTitle: "عنوان القسم",
    productsTitlePlaceholder: "مثلاً ملفات سامسونج",
    addProduct: "إضافة منتج",
    closeProducts: "إغلاق القائمة",
    search: "البحث في المنتجات",
    noMatches: "لا يوجد منتج يطابق البحث.",
    more: "عرض المزيد",
    added: "موجود في الصفحة",
    place: "إضافة",
    missing: "هذا المنتج لم يعد في متجرك.",
    removeProduct: "إزالة",
    dragProduct: "سحب المنتج",
    hint: "تعرض الصفحة العامة فقط المنتجات المتاحة للشراء الآن.",
    titleRequired: "أضف عنواناً لهذا القسم النصي.",
    bodyRequired: "اكتب نص هذا القسم.",
    productsRequired: "أضف منتجاً واحداً على الأقل إلى هذا القسم.",
    sectionFull: "كل قسم يتسع لـ ٨ منتجات كحد أقصى.",
    duplicate: "يمكن وضع كل منتج مرة واحدة في الصفحة.",
    save: "حفظ الصفحة",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ الصفحة.",
    loadError: "تعذر تحميل الصفحة.",
    saveError: "تعذر حفظ الصفحة.",
    productsError: "تعذر تحميل قائمة المنتجات.",
    retry: "حاول مجدداً",
    status: { draft: "مسودة", pending_review: "قيد المراجعة", active: "", archived: "مؤرشف", trashed: "محذوف" }
  }
} as const;

function reorder<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function requestError(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(" ");
  return typeof message === "string" ? message : fallback;
}

export function SellerExpertPageWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<ExpertPageBlock[]>([]);
  const [known, setKnown] = useState<Record<string, SellerPageProductChoice>>({});
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => scheduleEffectTask(() => {
    let ignore = false;
    void (async () => {
      try {
        const [page, profile] = await Promise.all([
          api.get<SellerExpertPage>("/seller/profile/page"),
          api.get<{ sellerId: string }>("/seller/profile")
        ]);
        if (ignore) return;
        setBlocks(page.data.blocks);
        setKnown(Object.fromEntries(page.data.products.map((product) => [product.id, product])));
        setSellerId(profile.data.sellerId);
        setState("ready");
      } catch {
        if (!ignore) {
          setState("error");
          setMessage(c.loadError);
        }
      }
    })();
    return () => {
      ignore = true;
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }), [c.loadError]);

  function remember(products: SellerPageProductChoice[]) {
    setKnown((current) => {
      const next = { ...current };
      for (const product of products) next[product.id] = product;
      return next;
    });
  }

  async function loadProducts(blockId: string, query: string, cursor: string | null, replace: boolean) {
    const id = ++requestId.current;
    try {
      const response = await api.get<SellerPageProductChoices>("/seller/profile/page/products", {
        params: { ...(query ? { search: query } : {}), ...(cursor ? { cursor } : {}), limit: 20 }
      });
      if (requestId.current !== id) return;
      remember(response.data.items);
      setPicker((current) => {
        if (!current || current.blockId !== blockId) return current;
        const items = replace ? response.data.items : [...current.items, ...response.data.items.filter((item) => !current.items.some((existing) => existing.id === item.id))];
        return { ...current, query, items, cursor: response.data.nextCursor, loading: false, error: "" };
      });
    } catch (error) {
      if (requestId.current !== id) return;
      setPicker((current) => current && current.blockId === blockId ? { ...current, loading: false, error: requestError(error, c.productsError) } : current);
    }
  }

  function openPicker(blockId: string) {
    if (picker?.blockId === blockId) {
      setPicker(null);
      return;
    }
    setPicker({ blockId, query: "", items: [], cursor: null, loading: true, error: "" });
    void loadProducts(blockId, "", null, true);
  }

  function searchProducts(blockId: string, query: string) {
    setPicker((current) => current && current.blockId === blockId ? { ...current, query, loading: true, error: "" } : current);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { void loadProducts(blockId, query.trim(), null, true); }, 250);
  }

  function addBlock(type: ExpertPageBlock["type"]) {
    setMessage("");
    setBlocks((current) => {
      if (current.length >= 12) return current;
      const id = crypto.randomUUID();
      return [...current, type === "text"
        ? { id, type, title: "", body: "" }
        : { id, type, title: "", productIds: [] }];
    });
  }

  function move(list: string, from: number, to: number) {
    if (list === "blocks") {
      setBlocks((current) => reorder(current, from, to));
      return;
    }
    const blockId = list.slice("products:".length);
    setBlocks((current) => current.map((block) => block.type === "products" && block.id === blockId
      ? { ...block, productIds: reorder(block.productIds, from, to) }
      : block));
  }

  function bindDrag(list: string, index: number) {
    return {
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (event.button !== 0) return;
        dragRef.current = { list, from: index, to: index };
        setDrag(dragRef.current);
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const current = dragRef.current;
        if (!current || current.list !== list || current.from !== index) return;
        const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(`[data-sort-list="${list}"]`);
        const to = Number(row?.dataset.sortIndex);
        if (!Number.isInteger(to) || current.to === to) return;
        dragRef.current = { ...current, to };
        setDrag(dragRef.current);
      },
      onPointerUp() {
        const current = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (current && current.list === list && current.from !== current.to) move(list, current.from, current.to);
      },
      onPointerCancel() {
        dragRef.current = null;
        setDrag(null);
      }
    };
  }

  function placedIds() {
    return new Set(blocks.flatMap((block) => block.type === "products" ? block.productIds : []));
  }

  function addProduct(blockId: string, product: SellerPageProductChoice) {
    const placed = placedIds();
    if (placed.has(product.id)) {
      setMessage(c.duplicate);
      return;
    }
    let rejected = false;
    setBlocks((current) => current.map((block) => {
      if (block.type !== "products" || block.id !== blockId) return block;
      if (block.productIds.length >= 8) {
        rejected = true;
        return block;
      }
      return { ...block, productIds: [...block.productIds, product.id] };
    }));
    if (rejected) setMessage(c.sectionFull);
    else {
      remember([product]);
      setMessage("");
    }
  }

  function validationMessage() {
    for (const block of blocks) {
      if (block.type === "text" && block.title.trim().length < 1) return { id: `${block.id}-title`, message: c.titleRequired };
      if (block.type === "text" && block.body.trim().length < 1) return { id: `${block.id}-body`, message: c.bodyRequired };
      if (block.type === "products" && block.productIds.length < 1) return { id: `${block.id}-products`, message: c.productsRequired };
    }
    return null;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validationMessage();
    if (invalid) {
      setState("ready");
      setMessage(invalid.message);
      document.getElementById(invalid.id)?.focus();
      return;
    }
    if (blocks.length > 12) {
      setMessage(c.limit);
      return;
    }
    setState("saving");
    setMessage("");
    try {
      const response = await api.put<SellerExpertPage>("/seller/profile/page", { blocks });
      setBlocks(response.data.blocks);
      setKnown(Object.fromEntries(response.data.products.map((product) => [product.id, product])));
      setState("ready");
      setMessage(c.saved);
    } catch (error) {
      setState("ready");
      setMessage(requestError(error, c.saveError));
    }
  }

  if (state === "loading") return <section className={styles.status} aria-busy="true"><p>{c.title}</p></section>;
  if (state === "error" && blocks.length === 0 && !sellerId) {
    return <section className={styles.status}><p role="alert">{message || c.loadError}</p><button type="button" onClick={() => window.location.reload()}>{c.retry}</button></section>;
  }

  const full = blocks.length >= 12;
  return <section className={styles.workspace} aria-labelledby="expert-page-title">
    <header className={styles.header}>
      <div>
        <h1 id="expert-page-title">{c.title}</h1>
        <p>{c.intro}</p>
      </div>
      <div className={styles.links}>
        <Link href={`/${locale}/seller-dashboard?section=profile` as Route}>{c.profile}</Link>
        {sellerId ? <Link href={`/${locale}/experts/${sellerId}` as Route}>{c.preview}</Link> : null}
      </div>
    </header>
    <form className={styles.form} onSubmit={(event) => void save(event)} aria-busy={state === "saving"}>
      <div className={styles.toolbar}>
        <button type="button" disabled={full || state === "saving"} onClick={() => addBlock("text")}>{c.addText}</button>
        <button type="button" disabled={full || state === "saving"} onClick={() => addBlock("products")}>{c.addProducts}</button>
        <button type="submit" disabled={state === "saving"}>{state === "saving" ? c.saving : c.save}</button>
      </div>
      <p className={styles.feedback} aria-live="polite" data-error={message !== "" && message !== c.saved}>{message}</p>
      {blocks.length === 0 ? <p className={styles.empty}>{c.empty}</p> : <ol className={styles.blocks}>
        {blocks.map((block, index) => {
          const dragging = drag?.list === "blocks" && drag.from === index;
          const dropping = drag?.list === "blocks" && drag.to === index && drag.from !== index;
          return <li key={block.id} className={styles.block} data-sort-list="blocks" data-sort-index={index} data-dragging={dragging} data-drop={dropping}>
            <div className={styles.blockBar}>
              <button className={styles.grip} type="button" aria-label={c.drag} aria-pressed={dragging} {...bindDrag("blocks", index)} disabled={state === "saving"}>
                <span aria-hidden="true" />
              </button>
              <span>{block.type === "text" ? c.addText : c.addProducts}</span>
              <div className={styles.blockActions}>
                <button type="button" aria-label={c.up} disabled={index === 0 || state === "saving"} onClick={() => move("blocks", index, index - 1)}>↑</button>
                <button type="button" aria-label={c.down} disabled={index === blocks.length - 1 || state === "saving"} onClick={() => move("blocks", index, index + 1)}>↓</button>
                <button type="button" onClick={() => { setBlocks((current) => current.filter((item) => item.id !== block.id)); if (picker?.blockId === block.id) setPicker(null); }}>{c.remove}</button>
              </div>
            </div>
            {block.type === "text" ? <>
              <label htmlFor={`${block.id}-title`}>{c.textTitle}</label>
              <input id={`${block.id}-title`} value={block.title} maxLength={120} placeholder={c.textTitlePlaceholder} onChange={(event) => setBlocks((current) => current.map((item) => item.id === block.id && item.type === "text" ? { ...item, title: event.target.value } : item))} />
              <label htmlFor={`${block.id}-body`}>{c.textBody}</label>
              <textarea id={`${block.id}-body`} value={block.body} maxLength={2000} rows={4} placeholder={c.textBodyPlaceholder} onChange={(event) => setBlocks((current) => current.map((item) => item.id === block.id && item.type === "text" ? { ...item, body: event.target.value } : item))} />
            </> : <>
              <label htmlFor={`${block.id}-title`}>{c.productsTitle}</label>
              <input id={`${block.id}-title`} value={block.title} maxLength={120} placeholder={c.productsTitlePlaceholder} onChange={(event) => setBlocks((current) => current.map((item) => item.id === block.id && item.type === "products" ? { ...item, title: event.target.value } : item))} />
              <p className={styles.hint} id={`${block.id}-products`} tabIndex={-1}>{c.hint}</p>
              {block.productIds.length ? <ol className={styles.products}>
                {block.productIds.map((productId, productIndex) => {
                  const product = known[productId];
                  const list = `products:${block.id}`;
                  const productDragging = drag?.list === list && drag.from === productIndex;
                  const productDropping = drag?.list === list && drag.to === productIndex && drag.from !== productIndex;
                  const status = product ? c.status[product.status] : "";
                  return <li key={productId} data-sort-list={list} data-sort-index={productIndex} data-dragging={productDragging} data-drop={productDropping}>
                    <button className={styles.grip} type="button" aria-label={c.dragProduct} aria-pressed={productDragging} {...bindDrag(list, productIndex)} disabled={state === "saving"}><span aria-hidden="true" /></button>
                    <strong>{product?.title ?? c.missing}</strong>
                    {status ? <em>{status}</em> : null}
                    <button type="button" onClick={() => setBlocks((current) => current.map((item) => item.id === block.id && item.type === "products" ? { ...item, productIds: item.productIds.filter((id) => id !== productId) } : item))}>{c.removeProduct}</button>
                  </li>;
                })}
              </ol> : null}
              <button className={styles.addProduct} type="button" aria-expanded={picker?.blockId === block.id} onClick={() => openPicker(block.id)}>{picker?.blockId === block.id ? c.closeProducts : c.addProduct}</button>
              {picker?.blockId === block.id ? <div className={styles.picker}>
                <label className="sr-only" htmlFor={`${block.id}-search`}>{c.search}</label>
                <input id={`${block.id}-search`} type="search" value={picker.query} maxLength={100} placeholder={c.search} onChange={(event) => searchProducts(block.id, event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
                {picker.error ? <p role="alert">{picker.error}</p> : null}
                {picker.loading ? <p>{c.search}</p> : null}
                {!picker.loading && !picker.error && picker.items.length === 0 ? <p>{c.noMatches}</p> : null}
                <ul>
                  {picker.items.map((product) => {
                    const placed = placedIds().has(product.id);
                    const status = c.status[product.status];
                    return <li key={product.id}>
                      <span>{product.title}{status ? <em>{status}</em> : null}</span>
                      <button type="button" disabled={placed} onClick={() => addProduct(block.id, product)}>{placed ? c.added : c.place}</button>
                    </li>;
                  })}
                </ul>
                {picker.cursor ? <button type="button" disabled={picker.loading} onClick={() => void loadProducts(block.id, picker.query.trim(), picker.cursor, false)}>{c.more}</button> : null}
              </div> : null}
            </>}
          </li>;
        })}
      </ol>}
    </form>
  </section>;
}
