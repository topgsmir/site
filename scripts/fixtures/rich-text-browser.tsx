import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useEditor } from "@tiptap/react";
import { ProductDescriptionEditor } from "../../apps/web/src/components/product/ProductDescriptionEditor";
import { RichTextVisualEditor, richTextExtensions } from "../../apps/web/src/components/blog/RichTextVisualEditor";
import { BLOG_EDITOR_COPY } from "../../apps/web/src/components/blog/BlogEditorCopy";
import { BlogEditor } from "../../apps/web/src/components/blog/BlogEditor";
import "../../apps/web/tokens.css";
import "@fontsource-variable/vazirmatn";
import "@fontsource-variable/outfit";

const params = new URLSearchParams(location.search);
const language = params.get("language") === "fa" ? "fa" : params.get("language") === "ar" ? "ar" : "en";
const sample = language === "en" ? "A practical guide to phone repair\nChoose the correct tool before starting." : "راهنمای تعمیر گوشی\nپیش از شروع، ابزار مناسب را انتخاب کنید.";
function Fixture() {
  const [disabled, setDisabled] = useState(false);
  const [value, setValue] = useState(params.has("empty") ? "" : sample);
  const [json, setJson] = useState("");
  const editor = useEditor({
    immediatelyRender: false, extensions: richTextExtensions("Start writing…", true, true),
    content: "<p>A practical guide to phone repair</p>",
    editorProps: { attributes: { role: "textbox", "aria-label": "Article body", "aria-multiline": "true" } },
    onUpdate: ({ editor: current }) => setJson(JSON.stringify(current.getJSON()))
  });
  const base = BLOG_EDITOR_COPY[language];
  return <main dir={language === "en" ? "ltr" : "rtl"}>
    <header><div><small>TOPGSM / {language === "en" ? "CONTENT" : "محتوا"}</small><h1>{language === "en" ? "Product description" : "توضیحات محصول"}</h1></div><label><input type="checkbox" checked={disabled} onChange={(event) => { setDisabled(event.target.checked); editor?.setEditable(!event.target.checked); }} />Read only</label></header>
    {params.has("article") ? <RichTextVisualEditor editor={editor} language={language} articleTools disabled={disabled} labels={{
      body: "Article body", bold: base.bold, italic: base.italic, heading: base.heading, list: base.list, image: base.image,
      strike: "Strikethrough", inlineCode: "Inline code", subheading: "Subheading", orderedList: "Numbered list", quote: "Quote", codeBlock: "Code block", rule: "Divider", link: "Link", linkPrompt: "Link", table: "Table", addRow: "Add row", addColumn: "Add column", deleteTable: "Delete table",
      alignment: "Align", alignStart: "Start", alignCenter: "Center", alignEnd: "End", alignJustify: "Justify"
    }} onUpload={async () => {
      if (params.has("upload-fails")) throw new Error("Upload failed");
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { src: "/media/12345678-1234-4234-8234-123456789012/image.webp" };
    }} /> : <ProductDescriptionEditor value={value} onChange={setValue} label={language === "en" ? "Description" : "توضیحات"} locale={language} disabled={disabled} />}
    <output data-testid="saved-content" hidden>{params.has("article") ? json : value}</output>
  </main>;
}
createRoot(document.getElementById("root")!).render(params.has("blog") ? <BlogEditor postId="editor-test" backHref="/" /> : <Fixture />);
