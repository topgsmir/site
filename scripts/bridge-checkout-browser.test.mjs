import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { once } from "node:events";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Use the existing browser runtime; no new production dependency is needed.
const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "apps/web/package.json"));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const store = resolve(root, "node_modules/.pnpm");
const esbuildPackage = readdirSync(store).find((name) => name.startsWith("esbuild@"));
assert.ok(esbuildPackage, "Run pnpm bootstrap before the browser tests");
const { build } = require(resolve(store, esbuildPackage, "node_modules/esbuild"));
const output = resolve(root, "tmp/bridge-checkout-browser");
mkdirSync(output, { recursive: true });
const server = createServer((request, response) => {
  if (request.url === "/app.js" || request.url === "/app.css") {
    response.setHeader("Content-Type", request.url.endsWith(".js") ? "text/javascript" : "text/css");
    response.end(readFileSync(resolve(output, request.url.slice(1))));
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  }
});
let browser;
try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  await build({ entryPoints: [resolve(root, "scripts/fixtures/bridge-checkout-browser.tsx")], bundle: true, outfile: resolve(output, "app.js"), jsx: "automatic", tsconfig: resolve(root, "apps/web/tsconfig.json"), loader: { ".module.css": "local-css" }, nodePaths: [resolve(root, "apps/web/node_modules")], alias: { "next/link": resolve(root, "scripts/fixtures/content-ai-next-link.tsx") }, define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(`${origin}/api`) } });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  for (const scenario of ["payment-failure", "lost-order-response", "lost-order-unauthorized", "validation-rejection"]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const errors = [];
      const orders = [];
      const payments = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route(`${origin}/api/**`, async (route) => {
        const request = route.request();
        const call = { key: request.headers()["idempotency-key"], body: request.postDataJSON() };
        if (request.url().endsWith("/orders")) {
          orders.push(call);
          if (orders.length === 1 && scenario.startsWith("lost-order")) return route.abort("failed");
          if (orders.length === 2 && scenario === "lost-order-unauthorized") return route.fulfill({ status: 401, json: { message: "Session expired" } });
          if (orders.length === 1 && scenario === "validation-rejection") return route.fulfill({ status: 400, json: { message: "Invalid details" } });
          return route.fulfill({ json: { id: "saved-order" } });
        }
        if (request.url().endsWith("/payments/zarinpal")) {
          payments.push(call);
          if (payments.length === 1 && scenario === "payment-failure") return route.fulfill({ status: 503, json: { message: "Provider unavailable" } });
          return route.fulfill({ json: { paymentUrl: `${origin}/payment-complete` } });
        }
        throw new Error(`Unexpected API call: ${request.url()}`);
      });
      await page.goto(origin);
      await page.getByRole("radio", { name: /Standard/ }).focus();
      await page.keyboard.press("ArrowDown");
      assert.equal(await page.getByRole("radio", { name: /Extended/ }).isChecked(), true);
      await page.getByRole("textbox", { name: "IMEI" }).fill("123456789012345");
      // Synchronous duplicate submits must not create competing purchase attempts.
      await page.locator("form").evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
      await page.getByRole("alert").waitFor();
      assert.equal(orders.length, 1);
      assert.equal(orders[0].body.offerId, "offer-b");
      if (scenario === "validation-rejection") {
        assert.equal(await page.getByRole("textbox", { name: "IMEI" }).isEnabled(), true);
        await page.getByRole("spinbutton", { name: "Quantity" }).fill("2");
      } else {
        assert.equal(await page.getByRole("radio", { name: /Standard/ }).isDisabled(), true);
        assert.equal(await page.getByRole("textbox", { name: "IMEI" }).isDisabled(), true);
        assert.equal(await page.getByRole("spinbutton", { name: "Quantity" }).isDisabled(), true);
      }
      if (scenario === "payment-failure") {
        assert.equal(await page.getByRole("link", { name: "View orders" }).getAttribute("href"), "/en/account/orders");
      }
      await page.getByRole("button", { name: scenario === "payment-failure" ? "Retry payment" : "Buy now", exact: true }).click();
      if (scenario === "lost-order-unauthorized") {
        await page.getByRole("alert").waitFor();
        assert.equal(await page.getByRole("textbox", { name: "IMEI" }).isDisabled(), true);
        await page.getByRole("button", { name: "Buy now", exact: true }).click();
      }
      await page.waitForURL(`${origin}/payment-complete`);
      if (scenario === "payment-failure") {
        assert.equal(orders.length, 1);
        assert.deepEqual(payments[1], payments[0]);
      } else if (scenario.startsWith("lost-order")) {
        for (const retry of orders.slice(1)) assert.deepEqual(retry, orders[0]);
      } else {
        assert.notEqual(orders[1].key, orders[0].key);
        assert.equal(orders[1].body.quantity, 2);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${scenario}: form state, request keys, concurrency and payment continuation`);
    } finally { await context.close(); }
  }
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
