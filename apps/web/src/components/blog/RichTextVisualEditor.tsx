"use client";

import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditorState, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { DesignIcon } from "@/components/DesignIcon";
import { safeExternalHref } from "@/lib/safe-navigation";
import styles from "./RichTextVisualEditor.module.css";

type Editor = NonNullable<ReturnType<typeof useEditor>>;

export function richTextExtensions(placeholder: string, allowImages = true, articleLayout = false) {
  return [
    StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
    Link.configure({ openOnClick: false, protocols: ["http", "https", "mailto", "tel"] }),
    ...(allowImages ? [TiptapImage.configure({ allowBase64: false })] : []),
    ...(articleLayout ? [TextAlign.configure({ types: ["paragraph", "heading"], alignments: ["start", "center", "end", "justify", "left", "right"] }), TableKit] : []),
    Placeholder.configure({ placeholder })
  ];
}

export type RichTextEditorLabels = {
  body: string; bold: string; italic: string; strike: string; inlineCode: string;
  heading: string; subheading: string; list: string; orderedList: string;
  quote: string; codeBlock: string; rule: string; link: string; linkPrompt: string;
  image?: string; table?: string; alignment?: string;
  alignStart?: string; alignCenter?: string; alignEnd?: string; alignJustify?: string;
  addRow?: string; addColumn?: string; deleteTable?: string;
  undo?: string; redo?: string;
};

export function RichTextVisualEditor({ editor, labels, language, compact = false, articleTools = false, onUpload, onInvalidLink }: {
  editor: Editor | null;
  labels: RichTextEditorLabels;
  language: "fa" | "en" | "ar";
  compact?: boolean;
  articleTools?: boolean;
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
    link: current?.isActive("link") ?? false,
    table: current?.isActive("table") ?? false,
    textAlign: (current ? current.getAttributes(current.isActive("heading") ? "heading" : "paragraph").textAlign as string | undefined : undefined) ?? "start",
    undo: current?.can().undo() ?? false,
    redo: current?.can().redo() ?? false
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
  function setAlignment(value: string) {
    if (!editor) return;
    editor.chain().focus().setTextAlign(value).run();
  }
  function insertTable() {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }
  const physicalAlignment = formatting?.textAlign;
  const selectedAlignment = physicalAlignment === "left"
    ? language === "en" ? "start" : "end"
    : physicalAlignment === "right" ? language === "en" ? "end" : "start" : physicalAlignment ?? "start";
  return <div className={styles.surface} data-compact={compact}>
    <div className={styles.toolbar} role="group" aria-label={labels.body}>
      {articleTools ? <>
        <button type="button" disabled={!formatting?.undo} aria-label={labels.undo} title={labels.undo} onClick={() => editor?.chain().focus().undo().run()}>↶</button>
        <button type="button" disabled={!formatting?.redo} aria-label={labels.redo} title={labels.redo} onClick={() => editor?.chain().focus().redo().run()}>↷</button>
        <span className={styles.divider} aria-hidden="true" />
      </> : null}
      <button type="button" aria-pressed={formatting?.bold} aria-label={labels.bold} title={labels.bold} onClick={() => editor?.chain().focus().toggleBold().run()}><strong>B</strong></button>
      <button type="button" aria-pressed={formatting?.italic} aria-label={labels.italic} title={labels.italic} onClick={() => editor?.chain().focus().toggleItalic().run()}><em>I</em></button>
      <button type="button" aria-pressed={formatting?.strike} aria-label={labels.strike} title={labels.strike} onClick={() => editor?.chain().focus().toggleStrike().run()}><s>S</s></button>
      <button type="button" aria-pressed={formatting?.code} aria-label={labels.inlineCode} title={labels.inlineCode} onClick={() => editor?.chain().focus().toggleCode().run()}>&lt;/&gt;</button>
      <span className={styles.divider} aria-hidden="true" />
      <button type="button" aria-pressed={formatting?.heading} aria-label={labels.heading} title={labels.heading} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <button type="button" aria-pressed={formatting?.subheading} aria-label={labels.subheading} title={labels.subheading} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
      <button type="button" aria-pressed={formatting?.list} onClick={() => editor?.chain().focus().toggleBulletList().run()}>• {labels.list}</button>
      <button type="button" aria-pressed={formatting?.orderedList} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>1. {labels.orderedList}</button>
      <button type="button" aria-pressed={formatting?.quote} aria-label={labels.quote} title={labels.quote} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>“ ”</button>
      <button type="button" aria-pressed={formatting?.codeBlock} aria-label={labels.codeBlock} title={labels.codeBlock} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>{"{ }"}</button>
      <button type="button" aria-label={labels.rule} title={labels.rule} onClick={() => editor?.chain().focus().setHorizontalRule().run()}>—</button>
      <button type="button" aria-pressed={formatting?.link} title={labels.link} onClick={editLink}>↗ {labels.link}</button>
      {articleTools ? <>
        <button type="button" disabled={formatting?.table} aria-label={labels.table} title={labels.table} onClick={insertTable}>▦ {labels.table}</button>
        {formatting?.table ? <>
          <button type="button" aria-label={labels.addRow} title={labels.addRow} onClick={() => editor?.chain().focus().addRowAfter().run()}>+↕</button>
          <button type="button" aria-label={labels.addColumn} title={labels.addColumn} onClick={() => editor?.chain().focus().addColumnAfter().run()}>+↔</button>
          <button type="button" aria-label={labels.deleteTable} title={labels.deleteTable} onClick={() => editor?.chain().focus().deleteTable().run()}>×▦</button>
        </> : null}
        <label className={styles.alignment}><span>{labels.alignment}</span><select aria-label={labels.alignment} value={selectedAlignment} onChange={(event) => setAlignment(event.target.value)}>
          <option value="start">{labels.alignStart}</option><option value="center">{labels.alignCenter}</option><option value="end">{labels.alignEnd}</option><option value="justify">{labels.alignJustify}</option>
        </select></label>
      </> : null}
      {onUpload && labels.image ? <label className={styles.upload}><DesignIcon name="layers" />{labels.image}<input aria-label={labels.image} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ""; }} /></label> : null}
    </div>
    <div className={styles.editor} dir={language === "en" ? "ltr" : "rtl"} lang={language}><EditorContent editor={editor} /></div>
  </div>;
}
