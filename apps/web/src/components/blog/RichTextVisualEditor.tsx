"use client";

import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditorState, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DesignIcon } from "@/components/DesignIcon";
import { safeExternalHref } from "@/lib/safe-navigation";
import { RICH_TEXT_EDITOR_COPY } from "./RichTextEditorCopy";
import { RichTextEditorIcon } from "./RichTextEditorIcon";
import styles from "./RichTextVisualEditor.module.css";

type Editor = NonNullable<ReturnType<typeof useEditor>>;
const OWNED_IMAGE = /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[a-z0-9-]{1,80}\.webp$/i;
const OwnedImage = TiptapImage.extend({
  parseHTML() {
    return [{ tag: "img[src]", getAttrs: (element) => OWNED_IMAGE.test(element.getAttribute("src") ?? "") ? null : false }];
  },
  // Images must come through the owned-media upload flow, including Markdown input.
  addInputRules() { return []; }
});

export function richTextExtensions(placeholder: string, allowImages = true, articleLayout = false) {
  return [
    // The stored document contract does not support underline marks.
    StarterKit.configure({ heading: { levels: [2, 3] }, link: false, underline: false }),
    Link.configure({ openOnClick: false, defaultProtocol: "https", protocols: ["http", "https", "mailto", "tel"], isAllowedUri: (url) => Boolean(safeExternalHref(url)) }),
    ...(allowImages ? [OwnedImage.configure({ allowBase64: false })] : []),
    ...(articleLayout ? [TextAlign.configure({ types: ["paragraph", "heading"], alignments: ["start", "center", "end", "justify", "left", "right"] }), TableKit.configure({ table: { renderWrapper: true } })] : []),
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

type RichTextVisualEditorProps = {
  editor: Editor | null;
  labels: RichTextEditorLabels;
  language: "fa" | "en" | "ar";
  locale?: "fa" | "en" | "ar";
  compact?: boolean;
  articleTools?: boolean;
  disabled?: boolean;
  onUpload?: (file: File, alt: string) => Promise<{ src: string } | null>;
};

export function RichTextVisualEditor(props: RichTextVisualEditorProps) {
  // Mount the subscription with a ready instance so initial content and editability
  // are available before the first user transaction.
  if (!props.editor) return <div className={styles.loading} aria-label={props.labels.body} aria-busy="true" />;
  return <ReadyRichTextVisualEditor {...props} editor={props.editor} />;
}

function ReadyRichTextVisualEditor({ editor, labels, language, locale = language, compact = false, articleTools = false, disabled = false, onUpload }: Omit<RichTextVisualEditorProps, "editor"> & { editor: Editor }) {
  const copy = RICH_TEXT_EDITOR_COPY[locale];
  const id = useId();
  const [more, setMore] = useState(false);
  const [help, setHelp] = useState(false);
  const [panel, setPanel] = useState<"link" | "table" | "image" | null>(null);
  const [href, setHref] = useState("");
  const [linkText, setLinkText] = useState("");
  const [insertingLink, setInsertingLink] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const panelInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const linkButton = useRef<HTMLButtonElement>(null);
  const uploadPending = useRef(false);
  const formatting = useEditorState({ editor, selector: () => {
    // Read the live prop: after a language change, the subscription snapshot can
    // still reference the destroyed instance until the first transaction.
    const current = editor;
    if (!current || current.isDestroyed || !current.schema) return null;
    return {
    editable: current?.isEditable ?? false,
    bold: current?.isActive("bold") ?? false,
    italic: current?.isActive("italic") ?? false,
    strike: current?.isActive("strike") ?? false,
    code: current?.isActive("code") ?? false,
    block: current?.isActive("heading", { level: 2 }) ? "h2" : current?.isActive("heading", { level: 3 }) ? "h3" : "paragraph",
    list: current?.isActive("bulletList") ?? false,
    orderedList: current?.isActive("orderedList") ?? false,
    quote: current?.isActive("blockquote") ?? false,
    codeBlock: current?.isActive("codeBlock") ?? false,
    link: current?.isActive("link") ?? false,
    table: current?.isActive("table") ?? false,
    image: current?.isActive("image") ?? false,
    text: current?.getText({ blockSeparator: "\n" }) ?? "",
    textAlign: (current ? current.getAttributes(current.isActive("heading") ? "heading" : "paragraph").textAlign as string | undefined : undefined) ?? "start",
    undo: current?.can().undo() ?? false,
    redo: current?.can().redo() ?? false
    };
  } });
  const readOnly = disabled || !formatting?.editable;
  const locked = readOnly || uploading;
  useEffect(() => { if (panel) panelInput.current?.focus(); }, [panel]);

  function closePanel(focus = true) {
    if (uploadPending.current) return;
    setPanel(null);
    setImageError("");
    if (focus) editor?.commands.focus();
  }
  function editLink() {
    if (!editor || locked) return;
    editor.chain().extendMarkRange("link").run();
    setHref(editor.getAttributes("link").href as string ?? "");
    setLinkText("");
    setInsertingLink(editor.state.selection.empty);
    setLinkError(false);
    setPanel("link");
  }
  function applyLink() {
    if (!editor || locked) return;
    const safeHref = safeExternalHref(href.trim());
    if (!safeHref) { setLinkError(true); panelInput.current?.focus(); return; }
    if (insertingLink) {
      editor.chain().focus().insertContent({ type: "text", text: linkText.trim() || safeHref, marks: [{ type: "link", attrs: { href: safeHref } }] })
        .setMeta("preventAutolink", true).command(({ tr }) => { tr.removeStoredMark(editor.schema.marks.link); return true; }).run();
    } else editor.chain().focus().extendMarkRange("link").setLink({ href: safeHref }).run();
    setPanel(null);
  }
  async function insertImage() {
    if (!editor || locked || uploadPending.current || !imageFile || !onUpload) return;
    // Map the insertion point through edits made while the upload is pending.
    let bookmark = editor.state.selection.getBookmark();
    const mapSelection = ({ transaction }: { transaction: Editor["state"]["tr"] }) => {
      bookmark = bookmark.map(transaction.mapping);
    };
    editor.on("transaction", mapSelection);
    uploadPending.current = true;
    setUploading(true); setImageError("");
    try {
      const result = await onUpload(imageFile, alt.trim());
      if (editor.isDestroyed) return;
      if (!result || !OWNED_IMAGE.test(result.src)) throw new Error("Image unavailable");
      editor.chain().focus().command(({ tr }) => { tr.setSelection(bookmark.resolve(tr.doc)); return true; }).setImage({ src: result.src, alt: alt.trim() }).run();
      setPanel(null); setImageFile(null);
    } catch { if (!editor.isDestroyed) setImageError(copy.uploadError); }
    finally { editor.off("transaction", mapSelection); uploadPending.current = false; setUploading(false); }
  }
  const physicalAlignment = formatting?.textAlign;
  const selectedAlignment = physicalAlignment === "left"
    ? language === "en" ? "start" : "end"
    : physicalAlignment === "right" ? language === "en" ? "end" : "start" : physicalAlignment ?? "start";
  const text = formatting?.text.trim() ?? "";
  const number = new Intl.NumberFormat(locale);
  const words = text ? text.split(/\s+/u).length : 0;
  function tool(label: string, content: ReactNode, action: () => void, active?: boolean, unavailable = false, shortcut?: string) {
    return <button type="button" disabled={locked || unavailable} aria-label={label} title={shortcut ? `${label} (${shortcut})` : label} aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()} onClick={() => { closePanel(false); action(); }}>{content}</button>;
  }
  return <div className={styles.surface} data-compact={compact} data-readonly={readOnly} dir={locale === "en" ? "ltr" : "rtl"} lang={locale}
    onKeyDownCapture={(event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !locked) { event.preventDefault(); editLink(); }
      if (event.key === "Escape" && panel && !uploading) { event.preventDefault(); closePanel(false); linkButton.current?.focus(); }
    }}>
    <div className={styles.toolbar} role="group" aria-label={labels.body}>
      <div className={styles.toolGroup}>
        {tool(labels.undo ?? copy.undo, <RichTextEditorIcon name="undo" />, () => editor?.chain().focus().undo().run(), undefined, !formatting?.undo, "Ctrl/⌘ Z")}
        {tool(labels.redo ?? copy.redo, <RichTextEditorIcon name="redo" />, () => editor?.chain().focus().redo().run(), undefined, !formatting?.redo, "Ctrl/⌘ Shift Z")}
      </div>
      <select className={styles.blockSelect} aria-label={copy.style} value={formatting?.block ?? "paragraph"} disabled={locked}
        onChange={(event) => event.target.value === "paragraph" ? editor?.chain().focus().setParagraph().run() : editor?.chain().focus().setHeading({ level: event.target.value === "h2" ? 2 : 3 }).run()}>
        <option value="paragraph">{copy.paragraph}</option><option value="h2">{labels.heading} · H2</option><option value="h3">{labels.subheading} · H3</option>
      </select>
      <div className={styles.toolGroup}>
        {tool(labels.bold, <strong>B</strong>, () => editor?.chain().focus().toggleBold().run(), formatting?.bold, false, "Ctrl/⌘ B")}
        {tool(labels.italic, <em>I</em>, () => editor?.chain().focus().toggleItalic().run(), formatting?.italic, false, "Ctrl/⌘ I")}
        {tool(labels.list, <RichTextEditorIcon name="bulletList" />, () => editor?.chain().focus().toggleBulletList().run(), formatting?.list)}
        {tool(labels.orderedList, <RichTextEditorIcon name="orderedList" />, () => editor?.chain().focus().toggleOrderedList().run(), formatting?.orderedList)}
      </div>
      <button ref={linkButton} type="button" aria-label={labels.link} disabled={locked} aria-pressed={formatting?.link} aria-expanded={panel === "link"} aria-controls={panel === "link" ? `${id}-panel` : undefined} title={`${labels.link} (Ctrl/⌘ K)`} onMouseDown={(event) => event.preventDefault()} onClick={editLink}><RichTextEditorIcon name="link" /><span>{labels.link}</span></button>
      {articleTools ? <button type="button" aria-label={labels.table} disabled={locked || formatting?.table} aria-expanded={panel === "table"} onClick={() => setPanel(panel === "table" ? null : "table")}><RichTextEditorIcon name="table" /><span>{labels.table}</span></button> : null}
      {onUpload && labels.image ? <>
        <button type="button" disabled={locked} onClick={() => fileInput.current?.click()}><DesignIcon name="upload" />{labels.image}</button>
        <input ref={fileInput} className={styles.fileInput} tabIndex={-1} aria-label={labels.image} type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} onChange={(event) => {
          const file = event.target.files?.[0]; event.currentTarget.value = "";
          if (!file) return;
          setImageFile(file); setAlt(""); setPanel("image");
          setImageError(!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024 ? copy.imageFileError : "");
        }} />
      </> : null}
      <button className={styles.more} type="button" aria-label={copy.more} disabled={locked} aria-expanded={more} aria-controls={`${id}-more`} onClick={() => { closePanel(false); setMore(!more); }}>{copy.more}<span aria-hidden="true">{more ? "−" : "+"}</span></button>
    </div>
    {more ? <div id={`${id}-more`} className={styles.secondary} role="group" aria-label={copy.more}>
      {tool(labels.strike, <s>S</s>, () => editor?.chain().focus().toggleStrike().run(), formatting?.strike)}
      {tool(labels.inlineCode, "</>", () => editor?.chain().focus().toggleCode().run(), formatting?.code)}
      {tool(labels.quote, <>“ {labels.quote}</>, () => editor?.chain().focus().toggleBlockquote().run(), formatting?.quote)}
      {tool(labels.codeBlock, <>{'{ }'} {labels.codeBlock}</>, () => editor?.chain().focus().toggleCodeBlock().run(), formatting?.codeBlock)}
      {tool(labels.rule, <>— {labels.rule}</>, () => editor?.chain().focus().setHorizontalRule().run())}
      {tool(copy.clear, copy.clear, () => {
        const chain = editor?.chain().focus().unsetAllMarks().clearNodes();
        if (articleTools) chain?.unsetTextAlign();
        chain?.run();
      })}
      {articleTools ? <label className={styles.alignment}><span>{labels.alignment}</span><select aria-label={labels.alignment} disabled={locked} value={selectedAlignment} onChange={(event) => editor?.chain().focus().setTextAlign(event.target.value).run()}>
        <option value="start">{labels.alignStart}</option><option value="center">{labels.alignCenter}</option><option value="end">{labels.alignEnd}</option><option value="justify">{labels.alignJustify}</option>
      </select></label> : null}
    </div> : null}
    {formatting?.table ? <div className={styles.contextBar} role="group" aria-label={labels.table}>
      <span className={styles.contextLabel}>{labels.table}</span>
      {tool(labels.addRow ?? "", labels.addRow, () => editor?.chain().focus().addRowAfter().run())}
      {tool(labels.addColumn ?? "", labels.addColumn, () => editor?.chain().focus().addColumnAfter().run())}
      {tool(copy.deleteRow, copy.deleteRow, () => editor?.chain().focus().deleteRow().run())}
      {tool(copy.deleteColumn, copy.deleteColumn, () => editor?.chain().focus().deleteColumn().run())}
      {tool(copy.header, copy.header, () => editor?.chain().focus().toggleHeaderRow().run())}
      {tool(labels.deleteTable ?? "", <><DesignIcon name="trash" />{labels.deleteTable}</>, () => editor?.chain().focus().deleteTable().run())}
      <small>{copy.tableHint}</small>
    </div> : null}
    {formatting?.image && onUpload ? <div className={styles.contextBar}>
      {tool(copy.editImage, copy.editImage, () => { setImageFile(null); setAlt(editor?.getAttributes("image").alt as string ?? ""); setPanel("image"); })}
      {tool(copy.removeImage, copy.removeImage, () => editor?.chain().focus().deleteSelection().run())}
    </div> : null}
    {panel ? <div className={styles.panel} id={`${id}-panel`} role="group" aria-label={panel === "link" ? labels.link : panel === "table" ? copy.insertTable : copy.imageAlt}
      onKeyDown={(event) => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); if (panel === "link") applyLink(); } }}>
      {panel === "link" ? <>
        <label className={styles.grow}><span>{copy.url}</span><input ref={panelInput} dir="ltr" type="text" inputMode="url" placeholder="https://example.com" value={href} maxLength={2048} disabled={locked} aria-invalid={linkError} aria-describedby={linkError ? `${id}-link-error` : undefined} onChange={(event) => { setHref(event.target.value); setLinkError(false); }} /></label>
        {insertingLink ? <label className={styles.grow}><span>{copy.linkText}</span><input value={linkText} maxLength={2000} disabled={locked} onChange={(event) => setLinkText(event.target.value)} /></label> : null}
        <button className={styles.primary} type="button" disabled={locked} onClick={applyLink}>{copy.apply}</button>
        {formatting?.link ? <button type="button" disabled={locked} onClick={() => { editor?.chain().focus().extendMarkRange("link").unsetLink().run(); setPanel(null); }}>{copy.removeLink}</button> : null}
        {linkError ? <p id={`${id}-link-error`} className={styles.error} role="alert">{copy.invalidLink}</p> : null}
      </> : panel === "table" ? <>
        <label><span>{copy.rows}</span><input ref={panelInput} type="number" min={1} max={10} value={rows} disabled={locked} onChange={(event) => setRows(Number(event.target.value))} /></label>
        <label><span>{copy.columns}</span><input type="number" min={1} max={6} value={columns} disabled={locked} onChange={(event) => setColumns(Number(event.target.value))} /></label>
        <button className={styles.primary} type="button" disabled={locked || !Number.isInteger(rows) || rows < 1 || rows > 10 || !Number.isInteger(columns) || columns < 1 || columns > 6} onClick={() => { editor?.chain().focus().insertTable({ rows, cols: columns, withHeaderRow: true }).run(); setPanel(null); }}>{copy.insertTable}</button>
      </> : <>
        {imageFile ? <strong className={styles.filename} dir="auto">{imageFile.name}</strong> : null}
        <label className={styles.grow}><span>{copy.imageAlt}</span><input ref={panelInput} value={alt} maxLength={300} disabled={locked} onChange={(event) => setAlt(event.target.value)} aria-describedby={`${id}-image-hint`} /></label>
        <button className={styles.primary} type="button" disabled={locked || Boolean(imageError && imageError === copy.imageFileError)} onClick={() => {
          if (imageFile) void insertImage();
          else { editor?.chain().focus().updateAttributes("image", { alt: alt.trim() }).run(); setPanel(null); }
        }}>{uploading ? copy.uploading : imageFile ? copy.insertImage : copy.apply}</button>
        <p id={`${id}-image-hint`} className={styles.hint}>{copy.imageHint}</p>
        {imageError ? <p className={styles.error} role="alert">{imageError}</p> : null}
      </>}
      <button type="button" disabled={uploading} onClick={() => closePanel()}>{copy.cancel}</button>
    </div> : null}
    <div className={styles.editor} dir={language === "en" ? "ltr" : "rtl"} lang={language} onPointerDown={() => closePanel(false)}><EditorContent editor={editor} /></div>
    <footer className={styles.status}>
      <span>{number.format(words)} {copy.words}<span aria-hidden="true"> · </span>{number.format(Array.from(text).length)} {copy.characters}</span>
      {readOnly ? <span>{copy.readOnly}</span> : <button type="button" aria-expanded={help} aria-controls={`${id}-help`} onClick={() => setHelp(!help)}>{copy.help}</button>}
    </footer>
    {help ? <p className={styles.shortcutHelp} id={`${id}-help`}>{copy.helpText}</p> : null}
  </div>;
}
