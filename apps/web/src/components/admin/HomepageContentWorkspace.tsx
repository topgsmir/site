"use client";

import axios from "axios";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HomepageCard, HomepageContent, HomepageDocument, HomepageLink, HomepageSection } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import { defaultHomepage } from "@/components/landing/homepage-defaults";
import { DesignIcon } from "@/components/DesignIcon";
import styles from "./HomepageContentWorkspace.module.css";

const translations = {
  fa: { title: "صفحه اصلی", intro: "متن‌ها، تصاویر و مسیرهای ورود به فروشگاه را از همین‌جا مدیریت کنید.", language: "زبان محتوا", save: "ذخیره و انتشار", saving: "در حال ذخیره…", saved: "تغییرات منتشر شد.", dirty: "تغییرات ذخیره‌نشده", clean: "همه تغییرات ذخیره شده", view: "مشاهده صفحه", preview: "پیش‌نمایش محتوا", loadError: "صفحه بارگذاری نشد. دوباره تلاش کنید.", saveError: "تغییرات ذخیره نشد. دوباره تلاش کنید.", conflict: "این صفحه در جای دیگری ویرایش شده است. متن خود را نگه دارید و نسخه تازه را بارگذاری کنید.", retry: "بارگذاری دوباره", discard: "تغییرات ذخیره نشده‌اند. آن‌ها را کنار می‌گذارید؟", reset: "بازگردانی پیش‌فرض", resetConfirm: "محتوای پیش‌فرض جایگزین فرم شود؟ تا زمان ذخیره، صفحه سایت تغییر نمی‌کند.", hero: "معرفی اصلی", shortcuts: "دسترسی‌های سریع", collections: "مجموعه‌های خدمات", offers: "پیشنهادات داغ", experts: "کارشناسان", latest: "آخرین محصولات", about: "چرا تاپ جی‌اس‌ام؟", footer: "پایین صفحه", stories: "مدیریت استوری‌ها", heading: "عنوان", accent: "خط دوم عنوان", description: "توضیح", eyebrow: "متن بالای عنوان", image: "تصویر", imageAlt: "توضیح تصویر برای دسترس‌پذیری", imageHint: "JPEG، PNG یا WebP تا ۵ مگابایت. تصویر جدید را انتخاب کنید یا از تصاویر آماده استفاده کنید.", upload: "انتخاب تصویر", uploading: "در حال بارگذاری…", uploadError: "تصویر بارگذاری نشد. یک تصویر ثابت تا ۵ مگابایت انتخاب کنید.", bundled: "تصویر آماده", custom: "تصویر فعلی", none: "بدون تصویر", phone: "گوشی و ابزار", firmware: "فایل فلش", hardware: "برد و حافظه", remote: "مودم و شبکه", primary: "دکمه اصلی", secondary: "دکمه دوم", label: "متن دکمه", href: "لینک مقصد", urlHint: "مسیر سایت مثل /fa/products یا یک لینک https://", badge: "برچسب کوتاه", visible: "نمایش این بخش", add: "افزودن کارت", remove: "حذف", up: "بالاتر", down: "پایین‌تر", card: "کارت", points: "دلایل انتخاب", addPoint: "افزودن دلیل", addLink: "افزودن لینک", liveProducts: "محصولات از فروشگاه خوانده می‌شوند. برای تغییر عنوان، قیمت و تصویر محصول به مدیریت محصولات بروید.", liveExperts: "کارشناسان از پروفایل فروشندگان فعال خوانده می‌شوند. برای تغییر نام و تخصص به مدیریت فروشندگان بروید.", manageProducts: "مدیریت محصولات", manageExperts: "مدیریت فروشندگان", previewHint: "این پیش‌نمایش با ویرایش فرم تغییر می‌کند. صفحه سایت پس از ذخیره به‌روز می‌شود.", noCards: "هنوز کارتی اضافه نشده است.", emptyTitle: "عنوان تازه", sectionCount: "بخش‌های قابل نمایش", imageBusy: "ابتدا صبر کنید بارگذاری تصویر تمام شود." },
  en: { title: "Homepage", intro: "Manage the words, imagery, and paths into your storefront.", language: "Content language", save: "Save & publish", saving: "Saving…", saved: "Your changes are published.", dirty: "Unsaved changes", clean: "All changes saved", view: "View homepage", preview: "Content preview", loadError: "Could not load the page. Try again.", saveError: "Could not save changes. Try again.", conflict: "This page was edited elsewhere. Keep a copy of your changes and reload the latest version.", retry: "Reload content", discard: "Discard your unsaved changes?", reset: "Restore defaults", resetConfirm: "Replace this form with default content? The live page stays unchanged until you save.", hero: "Hero", shortcuts: "Quick links", collections: "Service collections", offers: "Featured offers", experts: "Experts", latest: "Latest products", about: "Why Top GSM", footer: "Footer", stories: "Manage stories", heading: "Title", accent: "Second headline line", description: "Description", eyebrow: "Eyebrow", image: "Image", imageAlt: "Accessible image description", imageHint: "JPEG, PNG, or WebP up to 5 MB. Upload a new image or choose a bundled one.", upload: "Choose image", uploading: "Uploading…", uploadError: "Upload failed. Choose a static image up to 5 MB.", bundled: "Bundled image", custom: "Current image", none: "No image", phone: "Phone & tools", firmware: "Firmware", hardware: "Board & memory", remote: "Modem & network", primary: "Primary action", secondary: "Secondary action", label: "Link label", href: "Destination", urlHint: "A site path such as /en/products, or an https:// link", badge: "Short badge", visible: "Show this section", add: "Add card", remove: "Remove", up: "Move up", down: "Move down", card: "Card", points: "Reasons to choose us", addPoint: "Add reason", addLink: "Add link", liveProducts: "Products come from your store. Edit product titles, prices, and images in product management.", liveExperts: "Experts come from active seller profiles. Edit names and specialties in seller management.", manageProducts: "Manage products", manageExperts: "Manage sellers", previewHint: "This preview follows your form. Save to update the live page.", noCards: "No cards added yet.", emptyTitle: "New title", sectionCount: "Visible sections", imageBusy: "Wait for the image upload to finish." },
  ar: { title: "الصفحة الرئيسية", intro: "أدر النصوص والصور وروابط متجرك من هنا.", language: "لغة المحتوى", save: "حفظ ونشر", saving: "جارٍ الحفظ…", saved: "نُشرت التغييرات.", dirty: "تغييرات غير محفوظة", clean: "حُفظت جميع التغييرات", view: "عرض الصفحة", preview: "معاينة المحتوى", loadError: "تعذر تحميل الصفحة. حاول مجددًا.", saveError: "تعذر حفظ التغييرات. حاول مجددًا.", conflict: "عُدّلت الصفحة في جلسة أخرى. احتفظ بنسخة من تغييراتك وأعد التحميل.", retry: "إعادة تحميل المحتوى", discard: "هل تريد تجاهل التغييرات غير المحفوظة؟", reset: "استعادة الافتراضي", resetConfirm: "استبدال النموذج بالمحتوى الافتراضي؟ لن تتغير الصفحة حتى تحفظ.", hero: "المقدمة", shortcuts: "روابط سريعة", collections: "مجموعات الخدمات", offers: "العروض المميزة", experts: "الخبراء", latest: "أحدث المنتجات", about: "لماذا Top GSM", footer: "التذييل", stories: "إدارة القصص", heading: "العنوان", accent: "السطر الثاني للعنوان", description: "الوصف", eyebrow: "النص العلوي", image: "الصورة", imageAlt: "وصف الصورة لإمكانية الوصول", imageHint: "JPEG أو PNG أو WebP حتى 5 ميغابايت. ارفع صورة أو اختر صورة جاهزة.", upload: "اختيار صورة", uploading: "جارٍ الرفع…", uploadError: "تعذر الرفع. اختر صورة ثابتة حتى 5 ميغابايت.", bundled: "صورة جاهزة", custom: "الصورة الحالية", none: "بدون صورة", phone: "الهاتف والأدوات", firmware: "الفلاش", hardware: "اللوحة والذاكرة", remote: "المودم والشبكة", primary: "الإجراء الرئيسي", secondary: "الإجراء الثاني", label: "نص الرابط", href: "الوجهة", urlHint: "مسار مثل /ar/products أو رابط https://", badge: "شارة قصيرة", visible: "عرض هذا القسم", add: "إضافة بطاقة", remove: "إزالة", up: "تحريك للأعلى", down: "تحريك للأسفل", card: "بطاقة", points: "أسباب الاختيار", addPoint: "إضافة سبب", addLink: "إضافة رابط", liveProducts: "تأتي المنتجات من المتجر. عدّل الأسماء والأسعار والصور من إدارة المنتجات.", liveExperts: "يأتي الخبراء من ملفات البائعين النشطين. عدّل الأسماء والتخصصات من إدارة البائعين.", manageProducts: "إدارة المنتجات", manageExperts: "إدارة البائعين", previewHint: "تتبع المعاينة النموذج. احفظ لتحديث الصفحة المنشورة.", noCards: "لم تُضف بطاقات بعد.", emptyTitle: "عنوان جديد", sectionCount: "الأقسام الظاهرة", imageBusy: "انتظر اكتمال رفع الصورة." }
} as const;

type Copy = typeof translations[Locale];
type SectionKey = "hero" | "shortcuts" | "collections" | "offers" | "experts" | "about" | "latest" | "footer";
const sections: SectionKey[] = ["hero", "shortcuts", "collections", "offers", "experts", "about", "latest", "footer"];

export function HomepageContentWorkspace({ locale }: { locale: Locale }) {
  const c = translations[locale];
  const [contentLocale, setContentLocale] = useState<Locale>(locale);
  const [doc, setDoc] = useState<HomepageDocument | null>(null);
  const [draft, setDraft] = useState<HomepageContent>(() => defaultHomepage(locale));
  const [savedContent, setSavedContent] = useState("");
  const [section, setSection] = useState<SectionKey>("hero");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const requestId = useRef(0);
  const dirty = Boolean(doc && JSON.stringify(draft) !== savedContent);
  const busy = saving || uploadCount > 0;
  const invalidateRequests = useCallback(() => { requestId.current += 1; }, []);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true); setError(""); setMessage("");
    try {
      const { data } = await api.get<HomepageDocument>(`/admin/homepage?locale=${contentLocale}`);
      if (id !== requestId.current) return;
      const content = data.content ?? defaultHomepage(contentLocale);
      setDoc(data); setDraft(content); setSavedContent(JSON.stringify(content));
    } catch { if (id === requestId.current) { setDoc(null); setError(c.loadError); } }
    finally { if (id === requestId.current) setLoading(false); }
  }, [contentLocale, c.loadError]);
  useEffect(() => { void load(); return invalidateRequests; }, [load, invalidateRequests]);
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
    // Capture shell navigation too: Next links can leave without a beforeunload event.
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", navigate, true); };
  }, [dirty, c.discard]);
  const change = (update: (value: HomepageContent) => void) => {
    setDraft((current) => { const next = structuredClone(current); update(next); return next; });
    setMessage("");
  };
  const uploadBusy = useCallback((value: boolean) => setUploadCount((count) => Math.max(0, count + (value ? 1 : -1))), []);

  async function save() {
    if (!doc || busy) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const { data } = await api.put<HomepageDocument>(`/admin/homepage?locale=${contentLocale}`, { version: doc.version, content: draft });
      setDoc(data); setSavedContent(JSON.stringify(draft)); setMessage(c.saved);
    } catch (failure) {
      if (axios.isAxiosError(failure) && failure.response?.status === 409) setError(c.conflict);
      else if (axios.isAxiosError(failure) && failure.response?.status === 400) {
        const detail: unknown = failure.response.data?.message;
        setError(`${c.saveError} ${Array.isArray(detail) ? detail.join(" · ") : typeof detail === "string" ? detail : ""}`);
      } else setError(c.saveError);
    } finally { setSaving(false); }
  }

  return <section className={styles.workspace} dir={locale === "en" ? "ltr" : "rtl"} aria-labelledby="homepage-editor-title">
    <header className={styles.header}><div><span className={styles.eyebrow}>TOP GSM / {c.title}</span><h1 id="homepage-editor-title">{c.title}</h1><p>{c.intro}</p></div><a className={styles.outlineButton} href={`/${contentLocale}`} target="_blank" rel="noopener noreferrer">{c.view}<DesignIcon name="arrow" /></a></header>
    <div className={styles.toolbar}><label>{c.language}<select value={contentLocale} disabled={busy || loading} onChange={(event) => { if (!dirty || window.confirm(c.discard)) { setDoc(null); setContentLocale(event.target.value as Locale); } }}><option value="fa">فارسی</option><option value="en">English</option><option value="ar">العربية</option></select></label><span className={styles.saveState} data-dirty={dirty}>{dirty ? c.dirty : doc ? c.clean : ""}</span><button type="submit" form="homepage-content-form" className={styles.primary} disabled={busy || loading || !doc || (!dirty && doc.version > 0)}>{saving ? c.saving : c.save}</button></div>
    <div className={styles.feedback} aria-live="polite">{error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => { if (!dirty || window.confirm(c.discard)) void load(); }} disabled={busy}>{c.retry}</button></div>}{message && <p className={styles.success} role="status"><DesignIcon name="check" />{message}</p>}</div>
    {loading ? <div className={styles.loading} role="status" aria-label={c.retry}><span /><span /><span /></div> : doc && <div className={styles.layout}>
      <nav className={styles.sectionNav} aria-label={c.title}>{sections.map((key, index) => <button key={key} type="button" aria-pressed={section === key} onClick={() => setSection(key)}><span>{new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(index + 1)}</span>{c[key]}</button>)}<Link href={`/${locale}/admin/settings/stories` as Route}>{c.stories}<DesignIcon name="arrow" /></Link></nav>
      <form id="homepage-content-form" className={styles.form} onSubmit={(event) => { event.preventDefault(); void save(); }} aria-busy={busy}>
        <fieldset disabled={busy}><legend className={styles.formTitle}>{c[section]}</legend>
          <div dir={contentLocale === "en" ? "ltr" : "rtl"} className={styles.fields}>
            {section === "hero" && <>
              <Field label={c.eyebrow} value={draft.hero.eyebrow} max={100} onChange={(value) => change((d) => { d.hero.eyebrow = value; })} />
              <Field label={c.heading} value={draft.hero.title} max={100} required onChange={(value) => change((d) => { d.hero.title = value; })} />
              <Field label={c.accent} value={draft.hero.accent} max={100} onChange={(value) => change((d) => { d.hero.accent = value; })} />
              <Field label={c.description} value={draft.hero.description} max={500} multiline onChange={(value) => change((d) => { d.hero.description = value; })} />
              <ImageField c={c} value={draft.hero.image} required disabled={busy} busy={uploadBusy} onChange={(value) => change((d) => { d.hero.image = value; })} />
              <Field label={c.imageAlt} value={draft.hero.imageAlt} max={200} required onChange={(value) => change((d) => { d.hero.imageAlt = value; })} />
              <LinkFields title={c.primary} c={c} link={draft.hero.primary} onChange={(value) => change((d) => { d.hero.primary = value; })} />
              <LinkFields title={c.secondary} c={c} link={draft.hero.secondary} onChange={(value) => change((d) => { d.hero.secondary = value; })} />
            </>}
            {section === "shortcuts" && <CardsEditor c={c} cards={draft.shortcuts} max={6} disabled={busy} busy={uploadBusy} onChange={(value) => change((d) => { d.shortcuts = value; })} />}
            {(section === "collections" || section === "offers") && <><SectionFields c={c} value={draft[section]} onChange={(value) => change((d) => { Object.assign(d[section], value); })} /><CardsEditor c={c} cards={draft[section].items} max={12} disabled={busy} busy={uploadBusy} onChange={(value) => change((d) => { d[section].items = value; })} /></>}
            {(section === "experts" || section === "latest") && <><SectionFields c={c} value={draft[section]} onChange={(value) => change((d) => { Object.assign(d[section], value); })} /><div className={styles.explainer}><DesignIcon name={section === "latest" ? "layers" : "headphones"} /><p>{section === "latest" ? c.liveProducts : c.liveExperts}</p><Link href={`/${locale}/admin/${section === "latest" ? "products" : "vendors"}` as Route}>{section === "latest" ? c.manageProducts : c.manageExperts}<DesignIcon name="arrow" /></Link></div></>}
            {section === "about" && <><SectionFields c={c} value={draft.about} onChange={(value) => change((d) => { Object.assign(d.about, value); })} /><h3>{c.points}</h3>{draft.about.points.map((point, index) => <div key={index} className={styles.pointRow}><Field label={`${c.heading} ${index + 1}`} value={point} max={200} required onChange={(value) => change((d) => { d.about.points[index] = value; })} /><button className={styles.remove} type="button" disabled={draft.about.points.length <= 1} onClick={() => change((d) => { d.about.points.splice(index, 1); })}>{c.remove}</button></div>)}<button type="button" className={styles.add} disabled={draft.about.points.length >= 8} onClick={() => change((d) => { d.about.points.push(c.emptyTitle); })}>+ {c.addPoint}</button><LinkFields c={c} title={c.primary} link={draft.about.link} onChange={(value) => change((d) => { d.about.link = value; })} /></>}
            {section === "footer" && <><Field label={c.description} value={draft.footer.description} max={500} multiline onChange={(value) => change((d) => { d.footer.description = value; })} />{draft.footer.links.map((link, index) => <div className={styles.linkRow} key={index}><LinkFields c={c} title={`${c.label} ${index + 1}`} link={link} onChange={(value) => change((d) => { d.footer.links[index] = value; })} /><button className={styles.remove} type="button" onClick={() => change((d) => { d.footer.links.splice(index, 1); })}>{c.remove}</button></div>)}<button type="button" className={styles.add} disabled={draft.footer.links.length >= 10} onClick={() => change((d) => { d.footer.links.push({ label: c.emptyTitle, href: `/${contentLocale}/products` }); })}>+ {c.addLink}</button></>}
          </div>
        </fieldset>
        <div className={styles.formFooter}><button type="button" className={styles.textButton} disabled={busy} onClick={() => { if (window.confirm(c.resetConfirm)) { setDraft(defaultHomepage(contentLocale)); setMessage(""); } }}>{c.reset}</button><small>{uploadCount > 0 ? c.imageBusy : c.previewHint}</small></div>
      </form>
      <aside className={styles.preview} aria-label={c.preview}><header><span>{c.preview}</span><span>{contentLocale.toUpperCase()}</span></header><div dir={contentLocale === "en" ? "ltr" : "rtl"}><Image src={draft.hero.image} width={400} height={260} alt="" unoptimized /><div className={styles.previewCopy}><small>{draft.hero.eyebrow}</small><h2>{draft.hero.title}<span>{draft.hero.accent}</span></h2><p>{draft.hero.description}</p><span className={styles.previewButton}>{draft.hero.primary.label}</span></div><div className={styles.previewSections}>{(["collections", "offers", "experts", "about", "latest"] as const).map((key) => <span key={key} data-hidden={!draft[key].enabled}>{draft[key].enabled && <DesignIcon name="check" />}{draft[key].title}</span>)}</div></div></aside>
    </div>}
  </section>;
}

function Field({ label, value, onChange, max, required = false, multiline = false, dir, hint }: { label: string; value: string; onChange: (value: string) => void; max: number; required?: boolean; multiline?: boolean; dir?: "ltr"; hint?: string }) {
  const props = { value, required, maxLength: max, dir, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <label className={styles.field}><span>{label}</span>{multiline ? <textarea rows={3} {...props} /> : <input {...props} />}{hint && <small>{hint}</small>}</label>;
}
function LinkFields({ c, title, link, onChange }: { c: Copy; title: string; link: HomepageLink; onChange: (link: HomepageLink) => void }) {
  return <div className={styles.linkFields}><h3>{title}</h3><Field label={c.label} value={link.label} required max={60} onChange={(label) => onChange({ ...link, label })} /><Field label={c.href} value={link.href} required max={2048} dir="ltr" hint={c.urlHint} onChange={(href) => onChange({ ...link, href })} /></div>;
}
function SectionFields({ c, value, onChange }: { c: Copy; value: HomepageSection; onChange: (value: HomepageSection) => void }) {
  return <><label className={styles.toggle}><span>{c.visible}</span><input type="checkbox" checked={value.enabled} onChange={(event) => onChange({ ...value, enabled: event.target.checked })} /></label><Field label={c.heading} value={value.title} max={120} required onChange={(title) => onChange({ ...value, title })} /><Field label={c.description} value={value.description} max={500} multiline onChange={(description) => onChange({ ...value, description })} /></>;
}
function ImageField({ c, value, onChange, busy, disabled, required = false }: { c: Copy; value: string; onChange: (url: string) => void; busy: (value: boolean) => void; disabled: boolean; required?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const choices = [{ url: "/images/repair-studio.png", label: c.phone }, { url: "/images/home/firmware.webp", label: c.firmware }, { url: "/images/home/hardware.webp", label: c.hardware }, { url: "/images/home/remote.webp", label: c.remote }];
  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError(c.uploadError); return; }
    setUploading(true); busy(true);
    try { const form = new FormData(); form.set("file", file); const { data } = await api.post<{ url: string }>("/admin/homepage/images", form); onChange(data.url); }
    catch { setError(c.uploadError); }
    finally { setUploading(false); busy(false); }
  }
  return <div className={styles.imageField}>{value && <Image unoptimized src={value} width={320} height={180} alt="" />}<label className={styles.field}><span>{c.bundled}</span><select value={value} disabled={disabled} onChange={(event) => { onChange(event.target.value); setError(""); }}>{!required && <option value="">{c.none}</option>}{value && !choices.some((item) => item.url === value) && <option value={value}>{c.custom}</option>}{choices.map((choice) => <option key={choice.url} value={choice.url}>{choice.label}</option>)}</select></label><label className={styles.upload}><span>{uploading ? c.uploading : c.upload}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label><small>{c.imageHint}</small>{error && <p className={styles.error} role="alert">{error}</p>}</div>;
}
function CardsEditor({ c, cards, onChange, max, busy, disabled }: { c: Copy; cards: HomepageCard[]; onChange: (value: HomepageCard[]) => void; max: number; busy: (value: boolean) => void; disabled: boolean }) {
  const update = (index: number, key: keyof HomepageCard, value: string) => onChange(cards.map((card, i) => i === index ? { ...card, [key]: value } : card));
  const move = (index: number, offset: number) => { const next = [...cards]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; onChange(next); };
  return <div className={styles.cards}>{!cards.length && <p>{c.noCards}</p>}{cards.map((card, index) => <details className={styles.cardEditor} key={index} open={cards.length === 1 || undefined}><summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{card.title || c.card}</strong><span aria-hidden="true">⌄</span></summary><div className={styles.cardFields}><Field label={c.heading} value={card.title} max={120} required onChange={(value) => update(index, "title", value)} /><Field label={c.description} value={card.description} max={240} multiline onChange={(value) => update(index, "description", value)} /><Field label={c.badge} value={card.label} max={40} onChange={(value) => update(index, "label", value)} /><Field label={c.href} value={card.href} max={2048} required dir="ltr" hint={c.urlHint} onChange={(value) => update(index, "href", value)} /><ImageField c={c} value={card.image} onChange={(value) => update(index, "image", value)} busy={busy} disabled={disabled} /><div className={styles.cardActions}><button type="button" disabled={index === 0} onClick={() => move(index, -1)}>{c.up}</button><button type="button" disabled={index === cards.length - 1} onClick={() => move(index, 1)}>{c.down}</button><button type="button" className={styles.remove} onClick={() => onChange(cards.filter((_, i) => i !== index))}>{c.remove}</button></div></div></details>)}<button type="button" className={styles.add} disabled={cards.length >= max} onClick={() => onChange([...cards, { title: c.emptyTitle, description: "", label: "", href: "/", image: "" }])}>+ {c.add}</button></div>;
}
