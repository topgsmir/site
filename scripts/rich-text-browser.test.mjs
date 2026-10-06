import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { once } from "node:events";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, extname, basename } from "node:path";

// Uses the existing browser runtime; set PLAYWRIGHT_MODULE when it is not on NODE_PATH.
const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "apps/web/package.json"));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const store = resolve(root, "node_modules/.pnpm");
const esbuildPackage = readdirSync(store).find((name) => name.startsWith("esbuild@"));
assert.ok(esbuildPackage, "Run pnpm bootstrap before browser tests");
const { build } = require(resolve(store, esbuildPackage, "node_modules/esbuild"));
const output = resolve(root, "tmp/rich-text-browser");
mkdirSync(output, { recursive: true });
await build({
  entryPoints: [resolve(root, "scripts/fixtures/rich-text-browser.tsx")], bundle: true, outfile: resolve(output, "app.js"),
  jsx: "automatic", tsconfig: resolve(root, "apps/web/tsconfig.json"), loader: { ".module.css": "local-css", ".woff2": "file", ".woff": "file" },
  nodePaths: [resolve(root, "apps/web/node_modules")],
  alias: { "next/link": resolve(root, "scripts/fixtures/content-ai-next-link.tsx"), "next/image": resolve(root, "scripts/fixtures/content-ai-next-image.tsx") },
  define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_URL": '"/api"', "process.env": "{}" }
});
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  if ([".js", ".css", ".woff2", ".woff"].includes(extname(path))) {
    response.setHeader("Content-Type", path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : "font/woff2");
    response.end(readFileSync(resolve(output, basename(path))));
  } else if (path.startsWith("/media/")) {
    response.setHeader("Content-Type", "image/svg+xml");
    response.end('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><rect width="300" height="150" fill="#dde8e6"/></svg>');
  } else {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>*{box-sizing:border-box}body{margin:0;background:var(--color-dashboard-paper);color:var(--color-dashboard-ink);font-family:"Vazirmatn Variable","Outfit Variable",sans-serif}#root>main{max-width:960px;margin:24px auto;padding:16px}#root>main>header{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:16px}#root>main h1{font-size:22px;margin:4px 0}#root>main small{font-size:12px;color:var(--color-dashboard-muted)}button,input,textarea,select{font:inherit}#root>main>header label{font-size:14px}p{margin-top:0}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  }
});
let browser;
const checks = [];
try {
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on("pageerror", (error) => { errors.push(error.message); console.log("Browser error:", error.stack); });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const body = () => page.locator(".tiptap");
  const saved = () => page.getByTestId("saved-content").textContent();
  await page.goto(origin);
  await body().waitFor();
  await body().click();
  await page.keyboard.press("Control+Home"); await page.keyboard.press("Control+Shift+End");
  await button("Bold").click();
  assert.ok((await saved()).includes('"type":"bold"'));
  await button("Link").click();
  await page.getByLabel("Link address", { exact: true }).fill("javascript:alert(1)");
  await button("Apply").click();
  await page.getByRole("alert").waitFor();
  assert.equal(await body().locator("a").count(), 0);
  await page.getByLabel("Link address", { exact: true }).fill("https://example.com/guide");
  await button("Apply").click();
  assert.equal(await body().locator("a").first().getAttribute("href"), "https://example.com/guide");
  assert.ok(await body().locator("a strong, strong a").count() > 0);
  checks.push("selection preserved through bold and inline link validation");
  await button("Link").click(); await button("Remove link").click();
  assert.equal(await body().locator("a").count(), 0);
  await button("Undo").click();
  assert.ok(await body().locator("a").count() > 0);
  await button("Redo").click();
  assert.equal(await body().locator("a").count(), 0);
  checks.push("remove link, undo and redo");
  await button("More tools").click(); await button("Clear formatting").click();
  assert.equal(await body().locator("strong").count(), 0);
  await page.getByLabel("Text style").selectOption("h2");
  assert.ok(await body().locator("h2").count() > 0);
  await page.getByLabel("Text style").selectOption("paragraph");
  assert.equal(await body().locator("h2").count(), 0);
  checks.push("clear formatting and paragraph/heading conversion");
  await body().click(); await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+k");
  await page.getByLabel("Link address", { exact: true }).fill("https://example.com/new");
  await page.getByLabel("Link text", { exact: true }).fill("New link");
  await page.getByLabel("Link text", { exact: true }).press("Enter");
  assert.equal(await body().locator("a").last().textContent(), "New link");
  await page.keyboard.type(" after");
  assert.equal(await body().locator("a").last().textContent(), "New link");
  checks.push("keyboard link shortcut and insertion at an empty caret");
  await button("Table").click();
  await page.getByLabel("Rows", { exact: true }).fill("2"); await page.getByLabel("Columns", { exact: true }).fill("2");
  await button("Insert table").click();
  assert.equal(await body().locator("tr").count(), 2);
  await button("Add row").click(); assert.equal(await body().locator("tr").count(), 3);
  await button("Add column").click(); assert.equal(await body().locator("tr").first().locator("th,td").count(), 3);
  await button("Delete row").click(); assert.equal(await body().locator("tr").count(), 2);
  await button("Delete column").click(); assert.equal(await body().locator("tr").first().locator("th,td").count(), 2);
  await button("Undo").click(); assert.equal(await body().locator("tr").first().locator("th,td").count(), 3);
  await button("Delete table").click(); assert.equal(await body().locator("table").count(), 0);
  checks.push("table dimensions, add/delete rows and columns, undo and table removal");
  const beforeDisabled = await saved();
  await page.getByRole("checkbox", { name: "Read only" }).check();
  assert.equal(await button("Bold").isDisabled(), true);
  assert.equal(await body().getAttribute("contenteditable"), "false");
  await button("HTML").click();
  assert.equal(await page.getByRole("textbox", { name: "Description HTML" }).isDisabled(), true);
  assert.equal(await saved(), beforeDisabled);
  await page.getByRole("checkbox", { name: "Read only" }).uncheck();
  await page.getByRole("textbox", { name: "Description HTML" }).fill('<h2>Safe title</h2><p><u>Plain</u> <a href="javascript:alert(1)">unsafe</a> <a href="https://example.com">safe</a></p><script>alert(1)</script>');
  await button("Write").click();
  assert.equal(await body().locator("script,u").count(), 0);
  assert.equal(await body().locator("a").count(), 1);
  assert.equal((await saved()).includes("javascript:"), false);
  assert.equal((await saved()).includes('"type":"underline"'), false);
  checks.push("read-only controls and safe HTML round-trip");
  await page.goto(origin + "?article");
  await body().waitFor();
  await body().click(); await page.keyboard.press("Control+End"); await page.keyboard.press("Enter");
  await page.keyboard.type("![remote](https://example.com/tracker.png) ");
  assert.equal(await body().locator("img").count(), 0);
  await page.locator('input[type="file"]').setInputFiles({ name: "phone.png", mimeType: "image/png", buffer: Buffer.from("test") });
  await page.getByRole("textbox", { name: "Image description", exact: true }).fill("Phone repair tools");
  await button("Insert image").click();
  await body().locator("img").waitFor();
  assert.equal(await body().locator("img").getAttribute("alt"), "Phone repair tools");
  await body().locator("img").click();
  await button("Edit image description").click();
  await page.getByRole("textbox", { name: "Image description", exact: true }).fill("Precision repair tools");
  await button("Apply").click();
  assert.equal(await body().locator("img").getAttribute("alt"), "Precision repair tools");
  await body().locator("img").click(); await button("Remove image").click();
  assert.equal(await body().locator("img").count(), 0);
  checks.push("image insert, description edit and removal");
  await page.goto(origin + "?article&upload-fails");
  await body().waitFor();
  await page.locator('input[type="file"]').setInputFiles({ name: "phone.png", mimeType: "image/png", buffer: Buffer.from("test") });
  await button("Insert image").click(); await page.getByRole("alert").waitFor();
  assert.equal(await body().locator("img").count(), 0);
  assert.equal(await button("Insert image").isEnabled(), true);
  checks.push("upload failure preserves retry");
  let savedArticle;
  let finishUpload;
  const uploadGate = new Promise((resolve) => { finishUpload = resolve; });
  const content = (text) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
  const post = { id: "editor-test", optimisticVersion: 1, state: "draft", publicSlugs: {}, archivedAt: null, translations: ["fa", "en", "ar"].map((locale) => ({
    locale, title: locale === "fa" ? "راهنمای تعمیر گوشی" : "Phone repair guide", slug: "phone-repair-" + locale,
    excerpt: "راهنمای انتخاب ابزار و تعمیر گوشی", seoTitle: "Phone repair", seoDescription: "Practical repair instructions", coverAltText: "Repair tools",
    content: content(locale === "fa" ? "پیش از شروع، ابزار مناسب را انتخاب کنید." : "Choose the correct tool before starting.")
  })), cover: null, category: null, tags: [], relatedProducts: [], moderationNote: null };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.includes("ai/authoring")) return route.fulfill({ json: { allowed: false, configured: false } });
    if (path.endsWith("/taxonomy")) return route.fulfill({ json: { categories: [], tags: [] } });
    if (path.endsWith("/changes")) return route.fulfill({ json: { items: [], nextCursor: null } });
    if (path.endsWith("/blog/media")) {
      await uploadGate;
      return route.fulfill({ json: { id: "image", variants: [{ name: "lg", url: "/media/12345678-1234-4234-8234-123456789012/image.webp", width: 300, height: 150 }] } });
    }
    if (request.method() === "PATCH") { savedArticle = request.postDataJSON(); return route.fulfill({ json: { ...post, ...savedArticle } }); }
    return route.fulfill({ json: post });
  });
  await page.goto(origin + "?blog");
  await body().waitFor();
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: resolve(output, "blog-1366.png") });
  await button("English").click();
  await body().fill("Updated English article");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "phone.png", mimeType: "image/png", buffer: Buffer.from("test") });
  await page.getByRole("textbox", { name: "توضیح تصویر", exact: true }).fill("ابزار تعمیر گوشی");
  await button("درج تصویر").click();
  assert.equal(await button("English").isDisabled(), true);
  assert.equal(await button("HTML").isDisabled(), true);
  assert.equal(await button("ذخیره پیش‌نویس").isDisabled(), true);
  finishUpload();
  await body().locator("img").waitFor();
  await button("ذخیره پیش‌نویس").click();
  await page.getByText("تغییرات ذخیره شد", { exact: true }).waitFor();
  const english = savedArticle.translations.find((translation) => translation.locale === "en");
  assert.ok(JSON.stringify(english.content).includes("Updated English article"));
  assert.ok(JSON.stringify(english.content).includes("ابزار تعمیر گوشی"));
  assert.ok(JSON.stringify(savedArticle.translations.find((translation) => translation.locale === "fa").content).includes("پیش از شروع"));
  await button("HTML").click();
  await page.getByRole("textbox", { name: "متن مقاله HTML" }).fill('<h2>Updated heading</h2><p>Updated safe HTML</p><img src="https://remote.example/tracker.png"><script>alert(1)</script>');
  await button("نوشتن").click();
  assert.equal(await body().locator("img,script").count(), 0);
  await button("ذخیره پیش‌نویس").click(); await page.getByText("تغییرات ذخیره شد", { exact: true }).waitFor();
  assert.ok(JSON.stringify(savedArticle.translations.find((translation) => translation.locale === "en").content).includes("Updated heading"));
  checks.push("BlogEditor integration: language isolation, upload/save coordination, HTML sanitization and save payload");
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Blog overflow at " + width);
    await page.screenshot({ path: resolve(output, "blog-" + width + ".png") });
  }
  for (const language of ["fa", "en", "ar"]) {
    for (const [width, height] of [[1366,768], [1440,900], [375,812], [320,740]]) {
      await page.setViewportSize({ width, height });
      await page.goto(origin + "?language=" + language); await body().waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${language} overflow at ${width}`);
      assert.ok((await body().boundingBox()).y < height / 2, `writing starts in first half of ${width} viewport`);
      await page.screenshot({ path: resolve(output, `${language}-${width}.png`) });
      if (language === "en" && width === 320) {
        await button("More tools").click();
        await button("Link").click();
        await page.getByLabel("Link address", { exact: true }).fill("not-a-url");
        await button("Apply").click();
        await page.getByRole("alert").waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Expanded tools and error panel overflow");
        await page.screenshot({ path: resolve(output, "en-320-link-error.png") });
      }
    }
  }
  // A 683 CSS-pixel viewport is the reflow width of a 1366px browser at 200% zoom.
  await page.setViewportSize({ width: 683, height: 384 });
  await page.goto(origin + "?language=fa"); await body().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(output, "fa-200-percent-reflow.png") });
  checks.push("Persian, Arabic and English at 1366, 1440, 375, 320px; 200% equivalent reflow");
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(origin + "?language=fa&empty"); await body().waitFor();
  assert.equal(await saved(), "");
  assert.equal(await body().locator(".is-editor-empty").getAttribute("data-placeholder"), "توضیحات");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.screenshot({ path: resolve(output, "fa-empty-dark.png"), animations: "disabled" });
  checks.push("empty editor placeholder and dark theme");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, screenshots: output }, null, 2));
} finally { await browser?.close(); server.close(); }


