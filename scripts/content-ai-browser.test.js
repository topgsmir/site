// Run with the Playwright browser_run_code tool after serve-content-ai-browser.mjs.
async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const click = (locator) => locator.evaluate((element) => element.click());
  const doc = (text) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
  const inlineImage = { type: "image", attrs: { src: "/media/00000000-0000-4000-8000-000000000001/lg.webp" } };
  let englishAttempts = 0;
  let savedPayload = null;
  let saves = 0;
  let publications = 0;
  const generated = (locale) => ({ title: `Polished ${locale}`, slug: `polished-${locale}`, excerpt: "Useful excerpt", seoTitle: "Useful repair guide", seoDescription: "Factual repair instructions and supplied limitations.", coverAltText: "", category: "Repairs", tags: ["Phones"], warnings: ["Verify the model number."], description: "Polished product description. No charger included.", content: doc("Polished article body. No charger included. <script>alert(1)</script>"), html: "<p>Polished article body.</p>" });
  const translation = (locale) => ({ locale, title: `Original ${locale}`, slug: `original-${locale}`, excerpt: "Original excerpt", seoTitle: "Original SEO", seoDescription: "Original search description", coverAltText: "Real image description", content: { type: "doc", content: [...doc("Original article facts and limitations.").content, inlineImage] } });
  const taxonomy = { categories: [{ id: "category", translations: [{ locale: "en", name: "Repairs", slug: "repairs" }] }], tags: [{ id: "tag", translations: [{ locale: "en", name: "Phones", slug: "phones" }] }] };
  const post = { id: "test-post", optimisticVersion: 1, state: "draft", translations: ["fa", "en", "ar"].map(translation), cover: { id: "cover", variants: [] }, category: null, tags: [], relatedProducts: [{ id: "related", title: "Related product", slug: "related", startingPrices: [] }], moderationNote: null };
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = request.url().split("/api/")[1];
    if (path.startsWith("ai/authoring/")) {
      if (request.method() === "GET") return route.fulfill({ json: { allowed: true, configured: true } });
      const input = request.postDataJSON();
      if (path.endsWith("blog") && input.locale === "en" && ++englishAttempts === 1) return route.fulfill({ status: 502, json: { message: "Provider failed" } });
      return route.fulfill({ json: { locale: input.locale, status: "ready", draft: generated(input.locale) } });
    }
    if (path.endsWith("/taxonomy")) return route.fulfill({ json: taxonomy });
    if (path.includes("/changes")) return route.fulfill({ json: { items: [], nextCursor: null } });
    if (path.endsWith("/submit")) { publications++; return route.fulfill({ json: post }); }
    if (request.method() === "PATCH") { saves++; savedPayload = request.postDataJSON(); return route.fulfill({ json: { ...post, ...savedPayload } }); }
    return route.fulfill({ json: post });
  });

  await page.goto("http://127.0.0.1:4179/product");
  await click(page.getByText("Writing assistant", { exact: true }));
  await click(page.getByRole("button", { name: "Use current content", exact: true }));
  await click(page.getByRole("button", { name: "Generate draft", exact: true }));
  await page.getByRole("heading", { name: "Polished fa", exact: true }).waitFor();
  await click(page.getByRole("button", { name: "Apply selected fields", exact: true }));
  
  check(await page.getByLabel("Product title", { exact: true }).inputValue() === "Polished fa", "Product apply failed");
  await click(page.getByRole("button", { name: "Undo application", exact: true }));
  check(await page.getByLabel("Product title", { exact: true }).inputValue() === "Original product", "Product undo failed");
  await page.getByLabel("Product title", { exact: true }).fill("My newer edit");
  check(await page.getByRole("button", { name: "Apply selected fields", exact: true }).isDisabled(), "Intervening edit was not protected");
  await click(page.getByRole("button", { name: "I reviewed my edits; allow application", exact: true }));
  await click(page.getByRole("button", { name: "Apply selected fields", exact: true }));
  await page.getByLabel("Product title", { exact: true }).fill("Edit after application");
  check(await page.getByRole("button", { name: "Undo application", exact: true }).isDisabled(), "Undo would overwrite a later edit");
  check(saves === 0 && publications === 0, "AI unexpectedly saved or published");

  await page.goto("http://127.0.0.1:4179/");
  const summary = page.getByText("دستیار نوشتن", { exact: true });
  await click(summary);
  const panel = summary.locator("../..");
  await panel.getByLabel("یادداشت یا پیش‌نویس شما").fill("Facts about this repair service. No charger included. Use the supplied model only.");
  await click(panel.getByRole("button", { name: "ساخت پیش‌نویس", exact: true }));
  await panel.getByRole("heading", { name: "Polished fa", exact: true }).waitFor();
  await click(panel.getByRole("button", { name: /انگلیسی/ }));
  await panel.getByRole("button", { name: "تلاش دوباره برای این زبان", exact: true }).waitFor();
  check(await panel.getByRole("button", { name: /فارسی آماده/ }).count() === 1, "Persian success was lost after English failed");
  await click(panel.getByRole("button", { name: "تلاش دوباره برای این زبان", exact: true }));
  await panel.getByRole("heading", { name: "Polished en", exact: true }).waitFor();
  check(englishAttempts === 2, "Failed language was not independently retried");
  await click(panel.getByRole("button", { name: "اعمال فیلدهای انتخاب‌شده", exact: true }));
  check(await page.getByRole("textbox", { name: "عنوان مقاله", exact: true }).inputValue() === "Polished fa", "Blog apply failed");
  await click(panel.getByRole("button", { name: "برگرداندن متن قبلی", exact: true }));
  check(await page.getByRole("textbox", { name: "عنوان مقاله", exact: true }).inputValue() === "Original fa", "Blog undo failed");
  await click(panel.getByRole("button", { name: "اعمال فیلدهای انتخاب‌شده", exact: true }));
  check(saves === 0 && publications === 0, "AI bypassed explicit save/publish");
  await click(page.getByRole("button", { name: "ذخیره پیش‌نویس", exact: true }));
  await page.getByText("تغییرات ذخیره شد", { exact: true }).waitFor();
  check(savedPayload.translations.length === 3 && savedPayload.translations.every((item) => item.title === `Polished ${item.locale}`), "Not all languages were saved");
  check(savedPayload.translations.every((item) => item.content.content.some((node) => node.type === "image")), "Inline images were lost");
  check(savedPayload.translations.every((item) => item.coverAltText === "Real image description"), "Existing alt text was erased");
  check(savedPayload.coverAssetId === "cover" && savedPayload.relatedProductIds[0] === "related", "Cover or related products changed");
  check(savedPayload.categoryId === "category" && savedPayload.tagIds[0] === "tag", "Taxonomy did not match existing terms");
  check(publications === 0, "Save automatically published");
  check(await panel.locator("script").count() === 0, "Unsafe provider markup entered the DOM");
  // A narrow iframe gives a real CSS viewport without resizing the host browser window.
  await page.evaluate(() => {
    document.getElementById("root").style.display = "none";
    const frame = document.createElement("iframe"); frame.id = "authoring-mobile";
    frame.style.cssText = "width:390px;height:844px;border:0;display:block"; frame.src = "/";
    document.body.append(frame);
  });
  const mobile = page.frameLocator("#authoring-mobile");
  const mobileSummary = mobile.getByText("دستیار نوشتن", { exact: true });
  await click(mobileSummary);
  const mobilePanel = mobileSummary.locator("../..");
  await mobilePanel.getByLabel("یادداشت یا پیش‌نویس شما").fill("Facts about this repair service. No charger included. Use the supplied model only.");
  await click(mobilePanel.getByRole("button", { name: "ساخت پیش‌نویس", exact: true }));
  await mobilePanel.getByRole("heading", { name: "Polished fa", exact: true }).waitFor();
  const dimensions = await mobilePanel.evaluate((element) => ({ width: element.getBoundingClientRect().width, scroll: element.scrollWidth, client: element.clientWidth }));
  check(dimensions.width <= 390 && dimensions.scroll <= dimensions.client + 1, "AI panel overflows on mobile");
  return { productApplyUndoConflict: "passed", multilingualRetry: "passed", blogApplyUndoSave: "passed", mediaAndTaxonomy: "passed", noAutomaticPublication: "passed", safeMarkup: "passed", mobile: dimensions };
}
