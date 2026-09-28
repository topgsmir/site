"use client";

import { useEditor } from "@tiptap/react";
import type { RichTextDocument } from "@topgsm/shared-types";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { BLOG_EDITOR_COPY } from "@/components/blog/BlogEditorCopy";
import { RichTextVisualEditor, richTextExtensions } from "@/components/blog/RichTextVisualEditor";
import { PRODUCT_RICH_TEXT_PREFIX, productDescriptionDocument, productDescriptionFromText, productDescriptionText } from "@/lib/product-description";

const EXTRA = {
  fa: { strike: "خط‌خورده", inlineCode: "کد درون‌خطی", subheading: "زیرتیتر", orderedList: "فهرست شماره‌دار", quote: "نقل‌قول", codeBlock: "بلوک کد", rule: "جداکننده", link: "پیوند", linkPrompt: "پیوند http، https، mailto یا tel را وارد کنید", invalidLink: "این نوع نشانی برای پیوند مجاز نیست.", tooLong: "توضیحات باید کمتر از ۱۰٬۰۰۰ نویسه باشد." },
  en: { strike: "Strikethrough", inlineCode: "Inline code", subheading: "Subheading", orderedList: "Numbered list", quote: "Quote", codeBlock: "Code block", rule: "Divider", link: "Link", linkPrompt: "Enter an http, https, mailto or tel link", invalidLink: "This link type is not allowed.", tooLong: "Description must be under 10,000 characters." },
  ar: { strike: "مشطوب", inlineCode: "شفرة ضمنية", subheading: "عنوان فرعي", orderedList: "قائمة مرقمة", quote: "اقتباس", codeBlock: "كتلة شفرة", rule: "فاصل", link: "رابط", linkPrompt: "أدخل رابط http أو https أو mailto أو tel", invalidLink: "هذا النوع من الروابط غير مسموح.", tooLong: "يجب ألا يتجاوز الوصف ١٠٬٠٠٠ حرف." }
} as const;

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
  const copy = BLOG_EDITOR_COPY[locale];
  const extra = EXTRA[locale];
  const editor = useEditor({
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": label, "aria-multiline": "true" } },
    extensions: richTextExtensions(label, false),
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
    lastEmitted.current = value;
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);
  return <div aria-label={label}>
    <RichTextVisualEditor editor={editor} compact language={language} labels={{
      body: label, bold: copy.bold, italic: copy.italic, heading: copy.heading, list: copy.list,
      ...extra
    }} onInvalidLink={() => setError(extra.invalidLink)} />
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
