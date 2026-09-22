# Product and blog AI authoring

## Enable

Deploy the additive `20260922210000_content_ai` migration before the updated API. Regenerate Prisma through the normal bootstrap/build process. Existing sellers receive neither AI permission and neither writing capability is assigned a model automatically.

In **Admin → AI → Models**, test a model profile and assign it under **Writing models** to blog writing, product writing, or both. In seller permissions, grant **Blog AI** (`blog_ai`) and/or **Product AI** (`products_ai`). The seller also needs `blog_manage` or `products_manage`. Active members of an approved, non-invited, non-suspended seller account share these grants. Platform owners can use both; platform staff with blog management can use blog writing only.

## Editor behavior

Open **Writing assistant**, enter factual notes or use current content, optionally supply a focus keyword/audience, and generate. Blog generation requests Persian, English and Arabic independently. A failed language can be retried without losing successful previews or changing the source used for that generation. Product writing targets the existing Persian catalog; the admin-only translation editors target English or Arabic.

Review the draft and warnings, choose fields, and apply. This only updates editor state: normal save, moderation and publication rules still apply. The assistant blocks applying over intervening edits until the author explicitly acknowledges reviewing them. Undo restores the immediately preceding editor state only while no subsequent content edits have occurred. Blog body replacement retains uploaded inline images at the end of the new body, cover attachment and related products. Blank generated alt text preserves the author's existing text. Category/tag suggestions must match existing terms; suggested tags are merged with existing selections up to the existing 20-tag limit. HTML export contains safely escaped article markup. Switch the blog editor from HTML to visual mode before using the assistant.

The prompt prioritizes useful search intent, factual specificity, natural Persian/Arabic/English and bounded SEO fields. It forbids invented product claims and formulaic filler. Generated prose still requires human fact-checking; this feature does not promise ranking improvements. No external research or image analysis is performed.

## API and cost controls

- `GET /api/ai/authoring/blog` and `/product`: authenticated availability, returning `allowed` and `configured` without provider credentials.
- `POST` to the same paths: `locale`, `source` (20–16,000 characters), optional `keyword`, `audience`, `coverDescription`, `categories`, and `tags`. One request generates one language. The response is `{ locale, status: "ready", draft }`; errors use the existing HTTP error envelope.
- The draft contains title, slug, excerpt, SEO title/description, alt text, category/tag suggestions, warnings, safe rich text, a plain product description and escaped HTML. Client input cannot select a provider, actor or seller.
- Each provider request consumes the shared atomic `ai_run` user and IP buckets before calling the provider. A three-language blog consumes three requests. Existing admin security-policy settings apply (default 20 requests per user and 60 per IP per 15 minutes). There are no automatic paid retries.
- Existing provider timeout/output bounds apply. Audit events record capability, actor, language, tokens and estimated cost when prices/usage are known, with 90-day expiry. Notes, generated content and credentials are not stored in these audit records. Malformed paid output is still accounted for.
- No publishing rights are added and no product prices, stock, fulfillment, translations publication state or other seller data are read or mutated by authoring endpoints.

## Verification

- `pnpm --filter topgsm-api test` covers service authorization, safe output, bounded input, provider failure and limiter order.
- After building the API, `node scripts/test-content-ai-database.mjs` creates a local disposable database, deploys every migration, tests grants/status/revocation and concurrent rate-limit buckets, and drops only that database. It refuses remote servers.
- `node --test scripts/content-ai-editor.test.mjs` tests field selection, image/alt preservation and multilingual taxonomy matching.
- `node scripts/serve-content-ai-browser.mjs` serves the actual authoring components and blog editor on `127.0.0.1:4179`, using the existing esbuild installation. Run `scripts/content-ai-browser.test.js` through Playwright's `browser_run_code` filename interface, or run `node scripts/run-content-ai-browser.mjs` with an installed Playwright/Firefox runtime (`CONTENT_AI_PLAYWRIGHT_PATH` can point to an existing Playwright package). The browser test mocks API responses; it does not call a paid AI provider or save production content.

Rollback: disable the writing model profiles or revoke seller AI grants, then roll back application code. Leave the additive enum values/capability records in place; removing PostgreSQL enum labels is unnecessary and riskier than leaving unused values.
