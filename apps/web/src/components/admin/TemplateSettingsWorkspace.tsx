"use client";
import axios from "axios";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useRef, useState } from "react";
import { defaultTemplateConfiguration, templateIcons, type TemplateConfiguration, type TemplateMenuItem, type TemplateSettingsDocument } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./TemplateSettingsWorkspace.module.css";

const copy = {
  fa: { title: "تنظیمات قالب", intro: "نوار بالای هدر و منوهای سایت را برای هر زبان مدیریت کنید.", language: "زبان محتوا", banner: "نوار و تصویر بالای هدر", navigation: "لینک‌های هدر", categories: "فهرست دسته‌بندی‌ها", save: "ذخیره و انتشار", saving: "در حال ذخیره…", saved: "تنظیمات قالب منتشر شد.", view: "مشاهده سایت", loading: "در حال بارگذاری تنظیمات…", loadError: "تنظیمات بارگذاری نشد.", saveError: "تنظیمات ذخیره نشد.", conflict: "تنظیمات در جلسه دیگری تغییر کرده است. قبل از بارگذاری دوباره، متن تغییرات خود را نگه دارید.", reload: "بارگذاری دوباره", discard: "تغییرات ذخیره نشده‌اند. آن‌ها را کنار می‌گذارید؟", dirty: "تغییرات ذخیره‌نشده", clean: "همه تغییرات ذخیره شده", enabled: "نمایش", text: "متن نوار", label: "عنوان لینک", href: "لینک مقصد", linkLabel: "متن دکمه نوار", image: "تصویر نوار", alt: "توضیح تصویر", imageHint: "JPEG، PNG یا WebP تا ۵ مگابایت؛ برای نوار، تصویر عریض انتخاب کنید. تصویر جای متن نوار نمایش داده می‌شود.", upload: "انتخاب تصویر", uploading: "در حال بارگذاری…", uploadError: "بارگذاری تصویر انجام نشد. تصویر ثابت تا ۵ مگابایت انتخاب کنید.", removeImage: "حذف تصویر", tagline: "متن کوتاه کنار لوگو", categoryTitle: "عنوان فهرست", icon: "آیکون", add: "افزودن لینک", remove: "حذف", up: "بالاتر", down: "پایین‌تر", empty: "هنوز لینکی اضافه نشده است.", newLink: "لینک جدید", destinationHint: "مسیر سایت مثل /fa/products، لینک بخش مثل #services یا آدرس HTTPS.", homepage: "ویرایش تصویر اصلی صفحه", homepageHint: "تصویر بزرگ معرفی صفحه و متن‌های آن در تنظیمات صفحه اصلی قرار دارند.", reset: "پیش‌فرض", resetConfirm: "فرم با تنظیمات پیش‌فرض جایگزین شود؟ تا زمان ذخیره، سایت تغییر نمی‌کند." },
  en: { title: "Template settings", intro: "Manage the header banner and site menus for each language.", language: "Content language", banner: "Header banner", navigation: "Header links", categories: "Category menu", save: "Save & publish", saving: "Saving…", saved: "Template settings published.", view: "View site", loading: "Loading settings…", loadError: "Could not load settings.", saveError: "Could not save settings.", conflict: "Settings changed in another session. Keep a copy of your edits before reloading.", reload: "Reload", discard: "Discard unsaved changes?", dirty: "Unsaved changes", clean: "All changes saved", enabled: "Visible", text: "Banner text", label: "Link label", href: "Destination", linkLabel: "Banner action label", image: "Banner image", alt: "Image description", imageHint: "Static JPEG, PNG, or WebP up to 5 MB. Choose a wide image. The image replaces the banner text.", upload: "Choose image", uploading: "Uploading…", uploadError: "Upload failed. Choose a static image up to 5 MB.", removeImage: "Remove image", tagline: "Logo tagline", categoryTitle: "Menu title", icon: "Icon", add: "Add link", remove: "Remove", up: "Move up", down: "Move down", empty: "No links added yet.", newLink: "New link", destinationHint: "A site path such as /en/products, a section anchor such as #services, or an HTTPS URL.", homepage: "Edit homepage image", homepageHint: "The large homepage image and its text are in homepage settings.", reset: "Defaults", resetConfirm: "Replace this form with defaults? The site stays unchanged until you save." },
  ar: { title: "إعدادات القالب", intro: "أدر الشريط العلوي وقوائم الموقع لكل لغة.", language: "لغة المحتوى", banner: "شريط وصورة الرأس", navigation: "روابط الرأس", categories: "قائمة الفئات", save: "حفظ ونشر", saving: "جارٍ الحفظ…", saved: "نُشرت إعدادات القالب.", view: "عرض الموقع", loading: "جارٍ تحميل الإعدادات…", loadError: "تعذر تحميل الإعدادات.", saveError: "تعذر حفظ الإعدادات.", conflict: "تغيرت الإعدادات في جلسة أخرى. احتفظ بتغييراتك قبل إعادة التحميل.", reload: "إعادة التحميل", discard: "تجاهل التغييرات غير المحفوظة؟", dirty: "تغييرات غير محفوظة", clean: "حُفظت جميع التغييرات", enabled: "عرض", text: "نص الشريط", label: "عنوان الرابط", href: "الوجهة", linkLabel: "نص زر الشريط", image: "صورة الشريط", alt: "وصف الصورة", imageHint: "JPEG أو PNG أو WebP ثابت حتى 5 ميغابايت. اختر صورة عريضة. تظهر الصورة بدلاً من النص.", upload: "اختيار صورة", uploading: "جارٍ الرفع…", uploadError: "تعذر الرفع. اختر صورة ثابتة حتى 5 ميغابايت.", removeImage: "إزالة الصورة", tagline: "النص بجانب الشعار", categoryTitle: "عنوان القائمة", icon: "الأيقونة", add: "إضافة رابط", remove: "إزالة", up: "للأعلى", down: "للأسفل", empty: "لم تُضف روابط بعد.", newLink: "رابط جديد", destinationHint: "مسار مثل /ar/products أو مرساة مثل #services أو رابط HTTPS.", homepage: "تعديل صورة الصفحة الرئيسية", homepageHint: "توجد صورة المقدمة الكبيرة ونصها في إعدادات الصفحة الرئيسية.", reset: "الافتراضي", resetConfirm: "استبدال النموذج بالإعدادات الافتراضية؟ لا يتغير الموقع حتى تحفظ." }
} as const;
type Copy = typeof copy[Locale];
type Section = "banner" | "navigation" | "categories";
const icons = {
  fa: { bag: "فروشگاه", file: "فایل", layers: "دسته‌بندی", headphones: "پشتیبانی", settings: "خدمات", spark: "ویژه", gift: "هدیه" },
  en: { bag: "Shop", file: "File", layers: "Categories", headphones: "Support", settings: "Services", spark: "Featured", gift: "Gift" },
  ar: { bag: "متجر", file: "ملف", layers: "فئات", headphones: "دعم", settings: "خدمات", spark: "مميز", gift: "هدية" }
};

export function TemplateSettingsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [contentLocale, setContentLocale] = useState<Locale>(locale);
  const [doc, setDoc] = useState<TemplateSettingsDocument | null>(null);
  const [draft, setDraft] = useState<TemplateConfiguration>(() => defaultTemplateConfiguration(locale));
  const [baseline, setBaseline] = useState("");
  const [section, setSection] = useState<Section>("banner");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const requestId = useRef(0);
  const dirty = Boolean(doc && JSON.stringify(draft) !== baseline);
  const busy = loading || saving || uploading;
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true); setError(""); setMessage("");
    try {
      const { data } = await api.get<TemplateSettingsDocument>("/admin/settings/template?locale=" + contentLocale);
      if (id !== requestId.current) return;
      setDoc(data); setDraft(data.configuration); setBaseline(JSON.stringify(data.configuration));
    } catch { if (id === requestId.current) { setDoc(null); setError(c.loadError); } }
    finally { if (id === requestId.current) setLoading(false); }
  }, [contentLocale, c.loadError]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => { window.clearTimeout(timer); requestId.current += 1; }; }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.href === window.location.href) return;
      if (!window.confirm(c.discard)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("beforeunload", warn); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", navigate, true); };
  }, [dirty, c.discard]);
  function change(edit: (value: TemplateConfiguration) => void) {
    setDraft((previous) => { const next = structuredClone(previous); edit(next); return next; }); setMessage("");
  }
  async function save() {
    if (!doc || busy) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const { data } = await api.put<TemplateSettingsDocument>("/admin/settings/template?locale=" + contentLocale, { version: doc.version, configuration: draft });
      setDoc(data); setDraft(data.configuration); setBaseline(JSON.stringify(data.configuration)); setMessage(c.saved);
    } catch (failure) {
      const detail: unknown = axios.isAxiosError(failure) ? failure.response?.data?.message : null;
      setError(axios.isAxiosError(failure) && failure.response?.status === 409 ? c.conflict : c.saveError + (typeof detail === "string" ? " " + detail : Array.isArray(detail) ? " " + detail.join("; ") : ""));
    } finally { setSaving(false); }
  }
  async function upload(file?: File) {
    if (!file || busy) return;
    if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError(c.uploadError); return; }
    setUploading(true); setError("");
    try { const body = new FormData(); body.set("file", file); const { data } = await api.post<{url: string}>("/admin/settings/template/images", body); change((value) => { value.banner.image = data.url; }); }
    catch { setError(c.uploadError); }
    finally { setUploading(false); }
  }
  return <section className={styles.workspace} aria-labelledby="template-settings-title">
    <header className={styles.header}><div><h1 id="template-settings-title">{c.title}</h1><p>{c.intro}</p></div><a href={"/" + contentLocale} target="_blank" rel="noopener noreferrer">{c.view}</a></header>
    <div className={styles.toolbar}><label>{c.language}<select value={contentLocale} disabled={busy} onChange={(event) => { if (!dirty || window.confirm(c.discard)) { setDoc(null); setContentLocale(event.target.value as Locale); } }}><option value="fa">فارسی</option><option value="en">English</option><option value="ar">العربية</option></select></label><span>{dirty ? c.dirty : doc ? c.clean : ""}</span><button type="submit" form="template-settings-form" className={styles.primary} disabled={busy || !doc || (!dirty && doc.version > 0)}>{saving ? c.saving : c.save}</button></div>
    {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm(c.discard)) void load(); }}>{c.reload}</button></div>}
    {message && <p className={styles.success} role="status">{message}</p>}
    <nav className={styles.tabs} aria-label={c.title}>{(["banner", "navigation", "categories"] as const).map((key) => <button key={key} type="button" aria-pressed={section === key} onClick={() => setSection(key)}>{c[key]}</button>)}</nav>
    {loading ? <p role="status">{c.loading}</p> : doc && <form id="template-settings-form" className={styles.form} onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy} dir={contentLocale === "en" ? "ltr" : "rtl"}><legend>{c[section]}</legend>
        {section === "banner" && <div className={styles.fields}>
          <label className={styles.toggle}><input type="checkbox" checked={draft.banner.enabled} onChange={(event) => change((value) => { value.banner.enabled = event.target.checked; })} />{c.enabled}</label>
          <Field label={c.text} value={draft.banner.text} max={200} onChange={(text) => change((value) => { value.banner.text = text; })} />
          <Field label={c.href} value={draft.banner.href} max={500} required dir="ltr" onChange={(href) => change((value) => { value.banner.href = href; })} />
          <Field label={c.linkLabel} value={draft.banner.linkLabel} max={60} onChange={(label) => change((value) => { value.banner.linkLabel = label; })} />
          <Field label={c.alt} value={draft.banner.imageAlt} required={Boolean(draft.banner.image)} max={200} onChange={(alt) => change((value) => { value.banner.imageAlt = alt; })} />
          <div className={styles.imageField}><label className={styles.field}><span>{uploading ? c.uploading : c.image}</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label={c.upload} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label><small>{c.imageHint}</small>{draft.banner.image && <><Image unoptimized src={draft.banner.image} alt={draft.banner.imageAlt} width={800} height={72} /><button type="button" onClick={() => change((value) => { value.banner.image = ""; })}>{c.removeImage}</button></>}</div>
          <p className={styles.hint}>{c.destinationHint}</p>
          <div className={styles.homepageHint}><span>{c.homepageHint}</span><Link href={"/" + locale + "/admin/settings/homepage" as Route}>{c.homepage}</Link></div>
        </div>}
        {section === "navigation" && <><MenuEditor locale={locale} c={c} items={draft.navigation} max={8} contentLocale={contentLocale} onChange={(items) => change((value) => { value.navigation = items; })} /></>}
        {section === "categories" && <><div className={styles.categoryHeading}><label className={styles.toggle}><input type="checkbox" checked={draft.categories.enabled} onChange={(event) => change((value) => { value.categories.enabled = event.target.checked; })} />{c.enabled}</label><Field label={c.categoryTitle} value={draft.categories.title} max={60} required onChange={(title) => change((value) => { value.categories.title = title; })} /></div><MenuEditor locale={locale} c={c} items={draft.categories.items} max={12} contentLocale={contentLocale} onChange={(items) => change((value) => { value.categories.items = items; })} /></>}
      </fieldset>
      <button type="button" className={styles.reset} disabled={busy} onClick={() => { if (window.confirm(c.resetConfirm)) { setDraft(defaultTemplateConfiguration(contentLocale)); setMessage(""); } }}>{c.reset}</button>
    </form>}
  </section>;
}
function Field({label,value,onChange,max,required=false,dir}: {label:string;value:string;onChange:(value:string)=>void;max:number;required?:boolean;dir?:"rtl"|"ltr"}) {
  return <label className={styles.field}><span>{label}</span><input value={value} maxLength={max} required={required} dir={dir} onChange={(event) => onChange(event.target.value)} /></label>;
}
function MenuEditor({locale,c,items,onChange,max,contentLocale}: {locale:Locale;c:Copy;items:TemplateMenuItem[];onChange:(items:TemplateMenuItem[])=>void;max:number;contentLocale:Locale}) {
  const update = (index:number,edit:Partial<TemplateMenuItem>) => onChange(items.map((item,i)=>i===index?{...item,...edit}:item));
  const move = (index:number,offset:number) => { const next=[...items]; [next[index],next[index+offset]]=[next[index+offset],next[index]]; onChange(next); };
  return <div className={styles.menuEditor}><p className={styles.hint}>{c.destinationHint}</p>{!items.length && <p>{c.empty}</p>}{items.map((item,index)=><div className={styles.menuRow} key={index}>
    <Field label={c.label} value={item.label} max={60} required onChange={(label)=>update(index,{label})} />
    <Field label={c.href} value={item.href} max={500} required dir="ltr" onChange={(href)=>update(index,{href})} />
    <label className={styles.field}><span>{c.icon}</span><select value={item.icon} onChange={(event)=>update(index,{icon:event.target.value as TemplateMenuItem["icon"]})}>{templateIcons.map((icon)=><option key={icon} value={icon}>{icons[locale][icon]}</option>)}</select></label>
    <div className={styles.rowActions}><label className={styles.toggle}><input type="checkbox" checked={item.enabled} onChange={(event)=>update(index,{enabled:event.target.checked})} />{c.enabled}</label><button type="button" disabled={index===0} aria-label={c.up + " " + (index+1)} onClick={()=>move(index,-1)}>↑</button><button type="button" disabled={index===items.length-1} aria-label={c.down + " " + (index+1)} onClick={()=>move(index,1)}>↓</button><button type="button" aria-label={c.remove + " " + (index+1)} onClick={()=>onChange(items.filter((_,i)=>i!==index))}>{c.remove}</button></div>
  </div>)}<button type="button" disabled={items.length>=max} onClick={()=>onChange([...items,{label:c.newLink,href:"/"+contentLocale+"/products",icon:"bag",enabled:true}])}>{c.add}</button></div>;
}
