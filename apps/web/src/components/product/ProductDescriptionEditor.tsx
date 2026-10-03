"use client";

import { useEditor } from "@tiptap/react";
import type { RichTextDocument, RichTextNode } from "@topgsm/shared-types";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { BLOG_EDITOR_COPY } from "@/components/blog/BlogEditorCopy";
import { RichTextVisualEditor, richTextExtensions } from "@/components/blog/RichTextVisualEditor";
import { PRODUCT_RICH_TEXT_PREFIX, productDescriptionDocument, productDescriptionFromText, productDescriptionText } from "@/lib/product-description";
import { safeExternalHref } from "@/lib/safe-navigation";
import styles from "./ProductDescriptionEditor.module.css";

const EXTRA = {
  fa: { strike: "خط‌خورده", inlineCode: "کد درون‌خطی", subheading: "زیرتیتر", orderedList: "فهرست شماره‌دار", quote: "نقل‌قول", codeBlock: "بلوک کد", rule: "جداکننده", link: "پیوند", linkPrompt: "پیوند http، https، mailto یا tel را وارد کنید", invalidLink: "این نوع نشانی برای پیوند مجاز نیست.", tooLong: "توضیحات باید کمتر از ۱۰٬۰۰۰ نویسه باشد.", preview: "پیش‌نمایش", code: "کد", codeHint: "HTML مجاز: متن، تیتر، فهرست، پیوند و جدول. اسکریپت و نشانی ناامن ذخیره نمی‌شوند.", table: "جدول", addRow: "افزودن سطر", addColumn: "افزودن ستون", deleteTable: "حذف جدول", alignment: "تراز", alignStart: "ابتدای سطر", alignCenter: "وسط", alignEnd: "انتهای سطر", alignJustify: "دوطرفه", undo: "بازگشت", redo: "انجام مجدد" },
  en: { strike: "Strikethrough", inlineCode: "Inline code", subheading: "Subheading", orderedList: "Numbered list", quote: "Quote", codeBlock: "Code block", rule: "Divider", link: "Link", linkPrompt: "Enter an http, https, mailto or tel link", invalidLink: "This link type is not allowed.", tooLong: "Description must be under 10,000 characters.", preview: "Preview", code: "Code", codeHint: "Allowed HTML: text, headings, lists, links and tables. Scripts and unsafe URLs are not saved.", table: "Table", addRow: "Add row", addColumn: "Add column", deleteTable: "Delete table", alignment: "Align", alignStart: "Start", alignCenter: "Center", alignEnd: "End", alignJustify: "Justify", undo: "Undo", redo: "Redo" },
  ar: { strike: "مشطوب", inlineCode: "شفرة ضمنية", subheading: "عنوان فرعي", orderedList: "قائمة مرقمة", quote: "اقتباس", codeBlock: "كتلة شفرة", rule: "فاصل", link: "رابط", linkPrompt: "أدخل رابط http أو https أو mailto أو tel", invalidLink: "هذا النوع من الروابط غير مسموح.", tooLong: "يجب ألا يتجاوز الوصف ١٠٬٠٠٠ حرف.", preview: "معاينة", code: "الشفرة", codeHint: "HTML المسموح: النص والعناوين والقوائم والروابط والجداول. لا تُحفظ السكربتات والروابط غير الآمنة.", table: "جدول", addRow: "إضافة صف", addColumn: "إضافة عمود", deleteTable: "حذف الجدول", alignment: "محاذاة", alignStart: "البداية", alignCenter: "الوسط", alignEnd: "النهاية", alignJustify: "ضبط", undo: "تراجع", redo: "إعادة" }
} as const;

function removeUnsafeLinks(node: RichTextNode): RichTextNode {
  return {
    ...node,
    ...(node.marks ? { marks: node.marks.flatMap((mark) => {
      if (mark.type !== "link") return [mark];
      const href = safeExternalHref(mark.attrs?.href);
      return href ? [{ type: "link", attrs: { href } }] : [];
    }) } : {}),
    ...(node.content ? { content: node.content.map(removeUnsafeLinks) } : {})
  };
}

export function ProductDescriptionEditor({ value, onChange, locale, language = locale, label, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  language?: Locale;
  label: string;
  disabled?: boolean;
}) {
  const lastEmitted = useRef(value);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"preview" | "code">("preview");
  const [htmlSource, setHtmlSource] = useState("");
  const copy = BLOG_EDITOR_COPY[locale];
  const extra = EXTRA[locale];
  const editor = useEditor({
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": label, "aria-multiline": "true" } },
    extensions: richTextExtensions(label, false, true),
    content: productDescriptionDocument(value) ?? productDescriptionFromText(productDescriptionText(value)),
    onUpdate: ({ editor: current }) => {
      const text = current.getText().trim();
      const next = text ? `${PRODUCT_RICH_TEXT_PREFIX}${JSON.stringify(current.getJSON() as RichTextDocument)}` : "";
      lastEmitted.current = next;
      setError(next.length > 10_000 ? extra.tooLong : "");
      onChange(next);
    }
  });
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    editor.commands.setContent(productDescriptionDocument(value) ?? productDescriptionFromText(productDescriptionText(value)), { emitUpdate: false });
    let cancelled = false;
    if (mode === "code") queueMicrotask(() => { if (!cancelled) setHtmlSource(editor.getHTML()); });
    lastEmitted.current = value;
    return () => { cancelled = true; };
  }, [editor, mode, value]);
  useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);
  function updateCode(source: string) {
    setHtmlSource(source);
    if (!editor) return;
    editor.commands.setContent(source, { emitUpdate: false });
    const sanitized = removeUnsafeLinks(editor.getJSON() as RichTextDocument) as RichTextDocument;
    editor.commands.setContent(sanitized, { emitUpdate: false });
    const next = editor.getText().trim() ? `${PRODUCT_RICH_TEXT_PREFIX}${JSON.stringify(sanitized)}` : "";
    lastEmitted.current = next;
    setError(next.length > 10_000 ? extra.tooLong : "");
    onChange(next);
  }
  return <div aria-label={label}>
    <div className={styles.modes} role="group" aria-label={label}>
      <button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>{extra.preview}</button>
      <button type="button" aria-pressed={mode === "code"} onClick={() => { if (editor) setHtmlSource(editor.getHTML()); setMode("code"); }}>{extra.code}</button>
    </div>
    {mode === "preview" ? <RichTextVisualEditor editor={editor} compact language={language} articleTools labels={{
      body: label, bold: copy.bold, italic: copy.italic, heading: copy.heading, list: copy.list,
      ...extra
    }} onInvalidLink={() => setError(extra.invalidLink)} /> : <div className={styles.codeEditor}>
      <textarea dir="ltr" lang="en" spellCheck={false} aria-label={`${label} HTML`} value={htmlSource} disabled={disabled} onChange={(event) => updateCode(event.target.value)} />
      <p>{extra.codeHint}</p>
    </div>}
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
