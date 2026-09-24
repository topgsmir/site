"use client";

import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlogSidebarContent, BlogSidebarDocument, RelatedProductSummary } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { DesignIcon } from "@/components/DesignIcon";
import styles from "./BlogSidebarWorkspace.module.css";

const UI = {
  fa: { title: "تبلیغ کنار مقاله", intro: "متن، لینک و محصولات پیش‌فرض ستون کناری مقاله‌های بلاگ را مدیریت کنید.", language: "زبان محتوا", view: "مشاهده بلاگ", save: "ذخیره و انتشار", saving: "در حال ذخیره…", saved: "تبلیغ ستون کناری منتشر شد.", dirty: "تغییرات ذخیره‌نشده", clean: "همه تغییرات ذخیره شده", enabled: "نمایش ستون تبلیغ در مقاله‌ها", heading: "عنوان", description: "توضیح", button: "متن دکمه", destination: "لینک مقصد", destinationHint: "مسیر سایت مثل /fa/products یا یک لینک https://", products: "محصولات پیش‌فرض", productsHint: "اگر برای یک مقاله محصول مرتبط انتخاب نشده باشد، حداکثر سه محصول زیر نمایش داده می‌شود.", search: "جست‌وجوی محصول…", remove: "حذف", up: "بالاتر", down: "پایین‌تر", empty: "هنوز محصولی انتخاب نشده است.", preview: "پیش‌نمایش", shop: "فروشگاه تاپ جی‌اس‌ام", loadError: "تنظیمات ستون کناری بارگذاری نشد.", saveError: "تنظیمات ذخیره نشد. دوباره تلاش کنید.", conflict: "این تنظیمات در جای دیگری تغییر کرده است. نسخه تازه را بارگذاری کنید.", retry: "بارگذاری دوباره", discard: "تغییرات ذخیره نشده‌اند. آن‌ها را کنار می‌گذارید؟", productsError: "جست‌وجوی محصولات انجام نشد." },
  en: { title: "Article sidebar promotion", intro: "Manage the copy, destination, and default products shown beside blog articles.", language: "Content language", view: "View blog", save: "Save and publish", saving: "Saving…", saved: "The sidebar promotion is live.", dirty: "Unsaved changes", clean: "All changes saved", enabled: "Show the promotion beside articles", heading: "Heading", description: "Description", button: "Button label", destination: "Destination", destinationHint: "A site path such as /en/products or an https:// URL", products: "Default products", productsHint: "When an article has no related products, up to three products below are shown.", search: "Search products…", remove: "Remove", up: "Move up", down: "Move down", empty: "No default products selected yet.", preview: "Preview", shop: "TOP GSM STORE", loadError: "The sidebar settings could not be loaded.", saveError: "The settings could not be saved. Try again.", conflict: "These settings changed elsewhere. Reload the latest version.", retry: "Reload", discard: "Discard your unsaved changes?", productsError: "Products could not be searched." },
  ar: { title: "إعلان جانب المقال", intro: "أدر النص والرابط والمنتجات الافتراضية التي تظهر بجانب مقالات المدونة.", language: "لغة المحتوى", view: "عرض المدونة", save: "حفظ ونشر", saving: "جارٍ الحفظ…", saved: "تم نشر إعلان الشريط الجانبي.", dirty: "تغييرات غير محفوظة", clean: "تم حفظ كل التغييرات", enabled: "عرض الإعلان بجانب المقالات", heading: "العنوان", description: "الوصف", button: "نص الزر", destination: "الوجهة", destinationHint: "مسار مثل /ar/products أو رابط https://", products: "المنتجات الافتراضية", productsHint: "عندما لا يحدد المقال منتجات مرتبطة، تظهر حتى ثلاثة من المنتجات أدناه.", search: "ابحث عن منتج…", remove: "إزالة", up: "للأعلى", down: "للأسفل", empty: "لم تحدد منتجات افتراضية بعد.", preview: "معاينة", shop: "متجر توب جي إس إم", loadError: "تعذر تحميل إعدادات الشريط الجانبي.", saveError: "تعذر حفظ الإعدادات. حاول مرة أخرى.", conflict: "تغيرت هذه الإعدادات في مكان آخر. حمّل النسخة الأحدث.", retry: "إعادة التحميل", discard: "هل تريد تجاهل التغييرات غير المحفوظة؟", productsError: "تعذر البحث في المنتجات." }
} as const;

const DEFAULTS: Record<Locale, BlogSidebarContent> = {
  fa: { enabled: true, title: "برای قدم بعدی شما", description: "محصولات و خدمات موبایل را ببینید و پیشنهاد فروشندگان را مقایسه کنید.", ctaLabel: "مشاهده فروشگاه", ctaHref: "/fa/products" },
  en: { enabled: true, title: "Your next step, here.", description: "Explore mobile products and services. Compare offers from sellers.", ctaLabel: "Explore the store", ctaHref: "/en/products" },
  ar: { enabled: true, title: "خطوتك التالية تبدأ هنا", description: "تصفّح منتجات وخدمات الهواتف وقارن عروض البائعين.", ctaLabel: "تصفّح المتجر", ctaHref: "/ar/products" }
};

type ProductOption = Pick<RelatedProductSummary, "id" | "title" | "slug">;

export function BlogSidebarWorkspace({ locale }: { locale: Locale }) {
  const c = UI[locale];
  const [contentLocale, setContentLocale] = useState<Locale>(locale);
  const [doc, setDoc] = useState<BlogSidebarDocument | null>(null);
  const [draft, setDraft] = useState<BlogSidebarContent>(DEFAULTS[locale]);
  const [products, setProducts] = useState<RelatedProductSummary[]>([]);
  const [saved, setSaved] = useState("");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [message, setMessage] = useState("");
  const requestId = useRef(0);
  const serialized = useMemo(() => JSON.stringify({ content: draft, productIds: products.map((product) => product.id) }), [draft, products]);
  const dirty = Boolean(doc && serialized !== saved);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true); setError(""); setSearchError(""); setMessage(""); setOptions([]); setQuery("");
    try {
      const { data } = await api.get<BlogSidebarDocument>(`/admin/blog-sidebar?locale=${contentLocale}`);
      if (id !== requestId.current) return;
      const content = data.content ?? DEFAULTS[contentLocale];
      setDoc(data); setDraft(content); setProducts(data.products);
      setSaved(JSON.stringify({ content, productIds: data.products.map((product) => product.id) }));
    } catch { if (id === requestId.current) { setDoc(null); setError(c.loadError); } }
    finally { if (id === requestId.current) setLoading(false); }
  }, [contentLocale, c.loadError]);

  useEffect(() => { void load(); return () => { requestId.current += 1; }; }, [load]);
  useEffect(() => {
    if (!dirty) return;
    let leaving = false;
    const warn = (event: BeforeUnloadEvent) => { if (!leaving) event.preventDefault(); };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (window.confirm(c.discard)) leaving = true;
      else { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", navigate, true); };
  }, [dirty, c.discard]);
  useEffect(() => {
    const search = query.normalize("NFKC").trim();
    if (!search) { setOptions([]); setSearching(false); return; }
    let current = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get<{ items: ProductOption[] }>("/blog/manage/product-options", { params: { search, limit: 8 } });
        if (current) { setOptions(data.items); setSearchError(""); }
      } catch { if (current) { setOptions([]); setSearchError(c.productsError); } }
      finally { if (current) setSearching(false); }
    }, 300);
    return () => { current = false; window.clearTimeout(timer); };
  }, [query, c.productsError]);

  const update = <K extends keyof BlogSidebarContent>(key: K, value: BlogSidebarContent[K]) => {
    setDraft((current) => ({ ...current, [key]: value })); setMessage("");
  };
  const move = (index: number, offset: number) => {
    setProducts((current) => { const next = [...current]; [next[index], next[index + offset]] = [next[index + offset]!, next[index]!]; return next; });
    setMessage("");
  };

  async function save() {
    if (!doc || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const { data } = await api.put<BlogSidebarDocument>(`/admin/blog-sidebar?locale=${contentLocale}`, {
        version: doc.version,
        content: draft,
        productIds: products.map((product) => product.id)
      });
      setDoc(data); setDraft(data.content ?? draft); setProducts(data.products);
      setSaved(JSON.stringify({ content: data.content ?? draft, productIds: data.products.map((product) => product.id) }));
      setMessage(c.saved);
    } catch (failure) {
      setError(axios.isAxiosError(failure) && failure.response?.status === 409 ? c.conflict : c.saveError);
    } finally { setSaving(false); }
  }

  return <section className={styles.workspace} dir={locale === "en" ? "ltr" : "rtl"} aria-labelledby="blog-sidebar-title">
    <header className={styles.header}><div><span>TOP GSM / BLOG</span><h1 id="blog-sidebar-title">{c.title}</h1><p>{c.intro}</p></div><a className={styles.outlineButton} href={`/${contentLocale}/blog`} target="_blank" rel="noopener noreferrer">{c.view}<DesignIcon name="arrow" /></a></header>
    <div className={styles.toolbar}><label>{c.language}<select value={contentLocale} disabled={loading || saving} onChange={(event) => { if (!dirty || window.confirm(c.discard)) { setDoc(null); setContentLocale(event.target.value as Locale); } }}><option value="fa">فارسی</option><option value="en">English</option><option value="ar">العربية</option></select></label><span data-dirty={dirty}>{dirty ? c.dirty : doc ? c.clean : ""}</span><button className={styles.primary} type="submit" form="blog-sidebar-form" disabled={loading || saving || !doc || (!dirty && doc.version > 0)}>{saving ? c.saving : c.save}</button></div>
    <div className={styles.feedback} aria-live="polite">{error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => void load()} disabled={saving}>{c.retry}</button></div>}{message && <p className={styles.success} role="status"><DesignIcon name="check" />{message}</p>}</div>
    {loading ? <div className={styles.loading} role="status"><span /><span /></div> : doc ? <div className={styles.layout}>
      <form id="blog-sidebar-form" className={styles.form} onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset disabled={saving}><legend>{c.title}</legend><div className={styles.fields} dir={contentLocale === "en" ? "ltr" : "rtl"}>
          <label className={styles.toggle}><span>{c.enabled}</span><input type="checkbox" checked={draft.enabled} onChange={(event) => update("enabled", event.target.checked)} /></label>
          <Field label={c.heading} value={draft.title} max={120} required onChange={(value) => update("title", value)} />
          <Field label={c.description} value={draft.description} max={500} multiline onChange={(value) => update("description", value)} />
          <div className={styles.linkFields}><Field label={c.button} value={draft.ctaLabel} max={60} required onChange={(value) => update("ctaLabel", value)} /><Field label={c.destination} value={draft.ctaHref} max={2048} required dir="ltr" hint={c.destinationHint} onChange={(value) => update("ctaHref", value)} /></div>
          <section className={styles.products} aria-labelledby="blog-sidebar-products"><div><h2 id="blog-sidebar-products">{c.products}</h2><span>{products.length}/3</span></div><p>{c.productsHint}</p><label className={styles.field}><span>{c.search}</span><input value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} aria-busy={searching} /></label>
            {searchError ? <p className={styles.searchError} role="alert">{searchError}</p> : null}
            {options.some((option) => !products.some((product) => product.id === option.id)) ? <div className={styles.results}>{options.filter((option) => !products.some((product) => product.id === option.id)).map((option) => <button type="button" key={option.id} disabled={products.length >= 3} onClick={() => { setProducts((current) => [...current, { ...option, startingPrices: [] }]); setQuery(""); setOptions([]); setMessage(""); }}>{option.title}</button>)}</div> : null}
            <ol className={styles.selected}>{products.map((product, index) => <li key={product.id}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><strong>{product.title}</strong><div><button type="button" disabled={index === 0} onClick={() => move(index, -1)}>{c.up}</button><button type="button" disabled={index === products.length - 1} onClick={() => move(index, 1)}>{c.down}</button><button type="button" onClick={() => { setProducts((current) => current.filter((item) => item.id !== product.id)); setMessage(""); }}>{c.remove}</button></div></li>)}</ol>
            {!products.length ? <p className={styles.empty}>{c.empty}</p> : null}
          </section>
        </div></fieldset>
      </form>
      <aside className={styles.preview} aria-label={c.preview} data-disabled={!draft.enabled}><header><span>{c.preview}</span><span>{contentLocale.toUpperCase()}</span></header><div dir={contentLocale === "en" ? "ltr" : "rtl"} className={styles.promo}><div className={styles.shopLabel}><span>{c.shop}</span><DesignIcon name="bag" /></div><h2>{draft.title}</h2><p>{draft.description}</p><span className={styles.previewButton}>{draft.ctaLabel}<DesignIcon name="arrow" /></span></div><div className={styles.previewProducts}>{products.map((product, index) => <div key={product.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{product.title}</strong><DesignIcon name="arrow" /></div>)}</div></aside>
    </div> : null}
  </section>;
}

function Field({ label, value, onChange, max, required = false, multiline = false, dir, hint }: { label: string; value: string; onChange: (value: string) => void; max: number; required?: boolean; multiline?: boolean; dir?: "ltr"; hint?: string }) {
  const props = { value, required, maxLength: max, dir, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <label className={styles.field}><span>{label}</span>{multiline ? <textarea rows={4} {...props} /> : <input {...props} />}{hint ? <small>{hint}</small> : null}</label>;
}
