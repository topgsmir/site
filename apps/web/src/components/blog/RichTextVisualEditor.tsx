"use client";

import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditorState, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { DesignIcon } from "@/components/DesignIcon";
import { safeExternalHref } from "@/lib/safe-navigation";
import styles from "./RichTextVisualEditor.module.css";

type Editor = NonNullable<ReturnType<typeof useEditor>>;

export function richTextExtensions(placeholder: string, allowImages = true) {
  return [
    StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
    Link.configure({ openOnClick: false, protocols: ["http", "https", "mailto", "tel"] }),
    ...(allowImages ? [TiptapImage.configure({ allowBase64: false })] : []),
    Placeholder.configure({ placeholder })
  ];
}

export type RichTextEditorLabels = {
  body: string; bold: string; italic: string; strike: string; inlineCode: string;
  heading: string; subheading: string; list: string; orderedList: string;
  quote: string; codeBlock: string; rule: string; link: string; linkPrompt: string;
  image?: string;
};

export function RichTextVisualEditor({ editor, labels, language, compact = false, onUpload, onInvalidLink }: {
  editor: Editor | null;
  labels: RichTextEditorLabels;
  language: "fa" | "en" | "ar";
  compact?: boolean;
  onUpload?: (file: File) => void;
  onInvalidLink?: () => void;
}) {
  const formatting = useEditorState({ editor, selector: ({ editor: current }) => ({
    bold: current?.isActive("bold") ?? false,
    italic: current?.isActive("italic") ?? false,
    strike: current?.isActive("strike") ?? false,
    code: current?.isActive("code") ?? false,
    heading: current?.isActive("heading", { level: 2 }) ?? false,
    subheading: current?.isActive("heading", { level: 3 }) ?? false,
    list: current?.isActive("bulletList") ?? false,
    orderedList: current?.isActive("orderedList") ?? false,
    quote: current?.isActive("blockquote") ?? false,
    codeBlock: current?.isActive("codeBlock") ?? false,
    link: current?.isActive("link") ?? false
  }) });
  function editLink() {
    if (!editor) return;
    const existing = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt(labels.linkPrompt, existing ?? "https://");
    if (href === null) return;
    if (!href.trim()) { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    const safeHref = safeExternalHref(href.trim());
    if (!safeHref) { onInvalidLink?.(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: safeHref }).run();
  }
  return <div className={styles.surface} data-compact={compact}>
    <div className={styles.toolbar} role="group" aria-label={labels.body}>
      <button type="button" aria-pressed={formatting?.bold} aria-label={labels.bold} title={labels.bold} onClick={() => editor?.chain().focus().toggleBold().run()}><strong>B</strong></button>
      <button type="button" aria-pressed={formatting?.italic} aria-label={labels.italic} title={labels.italic} onClick={() => editor?.chain().focus().toggleItalic().run()}><em>I</em></button>
      <button type="button" aria-pressed={formatting?.strike} aria-label={labels.strike} title={labels.strike} onClick={() => editor?.chain().focus().toggleStrike().run()}><s>S</s></button>
      <button type="button" aria-pressed={formatting?.code} aria-label={labels.inlineCode} title={labels.inlineCode} onClick={() => editor?.chain().focus().toggleCode().run()}>&lt;/&gt;</button>
      <span className={styles.divider} aria-hidden="true" />
      <button type="button" aria-pressed={formatting?.heading} aria-label={labels.heading} title={labels.heading} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <button type="button" aria-pressed={formatting?.subheading} aria-label={labels.subheading} title={labels.subheading} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
      <button type="button" aria-pressed={formatting?.list} onClick={() => editor?.chain().focus().toggleBulletList().run()}>• {labels.list}</button>
      <button type="button" aria-pressed={formatting?.orderedList} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>1. {labels.orderedList}</button>
      <button type="button" aria-pressed={formatting?.quote} title={labels.quote} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>“ ”</button>
      <button type="button" aria-pressed={formatting?.codeBlock} title={labels.codeBlock} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>{"{ }"}</button>
      <button type="button" aria-label={labels.rule} title={labels.rule} onClick={() => editor?.chain().focus().setHorizontalRule().run()}>—</button>
      <button type="button" aria-pressed={formatting?.link} title={labels.link} onClick={editLink}>↗ {labels.link}</button>
      {onUpload && labels.image ? <label className={styles.upload}><DesignIcon name="layers" />{labels.image}<input aria-label={labels.image} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ""; }} /></label> : null}
    </div>
    <div className={styles.editor} dir={language === "en" ? "ltr" : "rtl"} lang={language}><EditorContent editor={editor} /></div>
  </div>;
}
