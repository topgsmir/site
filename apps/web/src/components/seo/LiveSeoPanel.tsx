"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { analyzeSeo, type SeoInput } from "@/lib/seo-analysis";
import styles from "./LiveSeoPanel.module.css";

const COPY = {
  fa: {
    title: "راهنمای زنده سئو", keyword: "عبارت کلیدی اصلی", keywordHint: "فقط برای بررسی همین صفحه است و ذخیره نمی‌شود.", score: "وضعیت محتوا", good: "خوب", improve: "نیازمند بهبود", words: "واژه", characters: "نویسه", headings: "تیتر", links: "پیوند", images: "تصویر", suggestions: "اقدام‌های پیشنهادی", complete: "همه بررسی‌های فعلی مناسب‌اند.", approximate: "بازه‌های طول، راهنمای تقریبی‌اند؛ پیش‌نمایش نتایج جست‌وجو ممکن است متفاوت باشد.", derived: "توضیح کوتاه محصول و توضیح متا هر دو از پاراگراف اول ساخته می‌شوند و با تغییر آن به‌روز می‌شوند.",
    titleShort: "عنوان را روشن‌تر و کامل‌تر بنویسید.", titleLong: "عنوان را کوتاه کنید و مهم‌ترین واژه‌ها را نگه دارید.", bodyShort: "توضیحات مفید و مشخصات واقعی بیشتری اضافه کنید.", shortShort: "خلاصه را با چند جمله روشن کامل کنید.", shortLong: "خلاصه را کوتاه‌تر کنید.", metaTitleShort: "عنوان جست‌وجو را کامل‌تر بنویسید.", metaTitleLong: "عنوان جست‌وجو را کوتاه‌تر کنید.", metaShort: "توضیح جست‌وجو را با مزیت و موضوع محتوا کامل کنید.", metaLong: "توضیح جست‌وجو را کوتاه‌تر کنید.", keywordMissing: "عبارت کلیدی اصلی را وارد کنید تا جایگاه آن بررسی شود.", keywordTitle: "عبارت کلیدی را به‌صورت طبیعی در عنوان بیاورید.", keywordBody: "عبارت کلیدی را در متن، جایی که برای خواننده مفید است، به‌کار ببرید.", keywordMeta: "عبارت کلیدی را در توضیح جست‌وجو، به‌صورت طبیعی بیاورید.", headingsMissing: "برای بخش‌های اصلی متن تیتر H2 اضافه کنید.", keywordHeading: "اگر مناسب است، عبارت کلیدی را در یکی از تیترها بیاورید.", linksMissing: "در صورت نیاز، یک پیوند مرتبط و معتبر در متن بگذارید.", imagesMissing: "اگر به فهم موضوع کمک می‌کند، تصویر مرتبط اضافه کنید.", coverAltMissing: "برای تصویر جلد، توضیح جایگزین بنویسید."
  },
  en: {
    title: "Live SEO guide", keyword: "Focus phrase", keywordHint: "Used only for this check; it is not saved.", score: "Content status", good: "Good", improve: "Improve", words: "Words", characters: "Characters", headings: "Headings", links: "Links", images: "Images", suggestions: "Suggested actions", complete: "All current checks look good.", approximate: "Length ranges are approximate guidance; search snippets may render differently.", derived: "The product summary and meta description both come from the first paragraph and update with it.",
    titleShort: "Make the title clearer and more complete.", titleLong: "Shorten the title and keep its most useful terms.", bodyShort: "Add more useful details and verified specifications.", shortShort: "Expand the summary with a few clear sentences.", shortLong: "Shorten the summary.", metaTitleShort: "Expand the search title.", metaTitleLong: "Shorten the search title.", metaShort: "Add the topic and useful details to the search description.", metaLong: "Shorten the search description.", keywordMissing: "Enter a focus phrase to check where it appears.", keywordTitle: "Use the focus phrase naturally in the title.", keywordBody: "Use the focus phrase in the body where it helps readers.", keywordMeta: "Use the focus phrase naturally in the search description.", headingsMissing: "Add H2 headings for the main sections.", keywordHeading: "If it fits, use the focus phrase in a heading.", linksMissing: "Add a relevant, reliable link when useful.", imagesMissing: "Add a relevant image if it helps explain the topic.", coverAltMissing: "Write alternative text for the cover image."
  },
  ar: {
    title: "دليل السيو المباشر", keyword: "العبارة الرئيسية", keywordHint: "تُستخدم لهذا الفحص فقط ولا تُحفظ.", score: "حالة المحتوى", good: "جيد", improve: "يحتاج تحسينًا", words: "كلمات", characters: "أحرف", headings: "عناوين", links: "روابط", images: "صور", suggestions: "خطوات مقترحة", complete: "الفحوص الحالية جيدة.", approximate: "حدود الطول إرشادية؛ قد يظهر المقتطف في البحث بشكل مختلف.", derived: "يُنشأ ملخص المنتج ووصف الميتا من الفقرة الأولى ويتحدثان معها.",
    titleShort: "اكتب عنوانًا أوضح وأكثر اكتمالًا.", titleLong: "اختصر العنوان واحتفظ بالكلمات الأهم.", bodyShort: "أضف تفاصيل مفيدة ومواصفات موثوقة.", shortShort: "أكمل الملخص بجمل واضحة.", shortLong: "اختصر الملخص.", metaTitleShort: "أكمل عنوان البحث.", metaTitleLong: "اختصر عنوان البحث.", metaShort: "أضف الموضوع والتفاصيل المفيدة إلى وصف البحث.", metaLong: "اختصر وصف البحث.", keywordMissing: "أدخل العبارة الرئيسية لفحص مواضعها.", keywordTitle: "استخدم العبارة بشكل طبيعي في العنوان.", keywordBody: "استخدم العبارة في النص حيث تفيد القارئ.", keywordMeta: "استخدم العبارة بشكل طبيعي في وصف البحث.", headingsMissing: "أضف عناوين H2 للأقسام الرئيسية.", keywordHeading: "استخدم العبارة في أحد العناوين إن ناسب السياق.", linksMissing: "أضف رابطًا موثوقًا ومناسبًا عند الحاجة.", imagesMissing: "أضف صورة مناسبة إذا ساعدت في الشرح.", coverAltMissing: "اكتب نصًا بديلًا لصورة الغلاف."
  }
} as const;

const CHECK_LABELS = {
  fa: { title: "طول عنوان", short: "طول خلاصه", metaTitle: "طول عنوان جست‌وجو", metaDescription: "طول توضیح جست‌وجو" },
  en: { title: "Title length", short: "Summary length", metaTitle: "Search title length", metaDescription: "Search description length" },
  ar: { title: "طول العنوان", short: "طول الملخص", metaTitle: "طول عنوان البحث", metaDescription: "طول وصف البحث" }
} as const;

export function LiveSeoPanel({ locale, input, htmlSource, keyword: controlledKeyword, onKeywordChange }: { locale: Locale; input: Omit<SeoInput, "keyword">; htmlSource?: string; keyword?: string; onKeywordChange?: (value: string) => void }) {
  const [internalKeyword, setInternalKeyword] = useState("");
  const keyword = controlledKeyword ?? internalKeyword;
  const copy = COPY[locale];
  const result = analyzeSeo({ ...input, keyword }, htmlSource);
  const suggestions = result.checks.filter((check) => check.status === "improve");
  const lengths = result.checks.filter((check) => check.id in CHECK_LABELS[locale]);
  return <section className={styles.panel} aria-label={copy.title} dir={locale === "en" ? "ltr" : "rtl"} lang={locale}>
    <header><h2>{copy.title}</h2><span className={styles.score} aria-label={`${copy.score}: ${result.score}%`}>{result.score}%</span></header>
    <p className={styles.status}>{copy.score}: <strong>{result.score >= 75 ? copy.good : copy.improve}</strong></p>
    <div className={styles.stats}>
      <span>{result.words.toLocaleString(locale)} {copy.words}</span><span>{result.characters.toLocaleString(locale)} {copy.characters}</span>
      <span>{result.headings.toLocaleString(locale)} {copy.headings}</span><span>{result.links.toLocaleString(locale)} {copy.links}</span><span>{result.images.toLocaleString(locale)} {copy.images}</span>
    </div>
    <ul className={styles.lengths}>{lengths.map((check) => <li key={check.id} data-good={check.status === "good"}><span>{CHECK_LABELS[locale][check.id as keyof typeof CHECK_LABELS[typeof locale]]}</span><strong dir="ltr">{check.detail}</strong></li>)}</ul>
    <label className={styles.keyword}><span>{copy.keyword}</span><input value={keyword} onChange={(event) => (onKeywordChange ?? setInternalKeyword)(event.target.value)} maxLength={100} dir="auto" /><small>{copy.keywordHint}</small></label>
    <details className={styles.details}>
      <summary>{copy.suggestions} <span>{suggestions.length.toLocaleString(locale)}</span></summary>
      {suggestions.length ? <ul>{suggestions.map((check) => <li key={check.id}>{copy[check.suggestion as keyof typeof copy]}</li>)}</ul> : <p>{copy.complete}</p>}
    </details>
    {input.kind === "product" ? <p className={styles.note}>{copy.derived}</p> : null}
    <p className={styles.note}>{copy.approximate}</p>
  </section>;
}
