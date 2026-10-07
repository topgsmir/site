import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { once } from "node:events";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, basename } from "node:path";

// Follow the existing browser test setup without adding a production dependency.
const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "apps/web/package.json"));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const store = resolve(root, "node_modules/.pnpm");
const esbuildPackage = readdirSync(store).find((name) => name.startsWith("esbuild@"));
const { build } = require(resolve(store, esbuildPackage, "node_modules/esbuild"));
const output = resolve(root, "tmp/product-download-browser");
mkdirSync(output, { recursive: true });
const server = createServer((request, response) => {
  if (["/app.js", "/app.css"].includes(request.url) || request.url.endsWith(".woff2")) {
    response.setHeader("Content-Type", request.url.endsWith(".js") ? "text/javascript" : request.url.endsWith(".woff2") ? "font/woff2" : "text/css");
    response.end(readFileSync(resolve(output, basename(request.url))));
  } else {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>*{box-sizing:border-box}body{margin:0}button,input{font:inherit}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  }
});
let browser;
let checks = 0;
try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  await build({
    entryPoints: [resolve(root, "scripts/fixtures/product-download-browser.tsx")], bundle: true,
    outfile: resolve(output, "app.js"), jsx: "automatic", tsconfig: resolve(root, "apps/web/tsconfig.json"),
    loader: { ".module.css": "local-css", ".woff2": "file" }, nodePaths: [resolve(root, "apps/web/node_modules")],
    alias: { "next/link": resolve(root, "scripts/fixtures/content-ai-next-link.tsx"), "next/image": resolve(root, "scripts/fixtures/content-ai-next-image.tsx") },
    plugins: [{ name: "test-navigation", setup(build) {
      build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "test" }));
      build.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: 'export const useRouter = () => ({ push: path => { window.testNavigation = path; }, prefetch: () => {} });' }));
    } }],
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(`${origin}/api`) }
  });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  for (const role of ["buyer", "seller-admin", "seller-staff", "platform-admin", "platform-staff", "guest"]) {
    for (const scenario of role === "guest" ? ["unowned"] : ["unowned", "single", "multiple", "free", "exhausted", "failure"]) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      try {
        const page = await context.newPage();
        const claims = [];
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await context.route("https://files.example/**", (route) => route.fulfill({ body: "download" }));
        await context.route(`${origin}/api/**`, async (route) => {
          const request = route.request();
          const path = new URL(request.url()).pathname;
          if (path === "/api/auth/me") return route.fulfill({ status: role === "guest" ? 401 : 200, json: { id: "account-1", role } });
          if (path === "/api/comments/settings") return route.fulfill({ json: { postingPolicy: "purchasers", guestSmsRequired: false } });
          if (path.startsWith("/api/comments/")) return route.fulfill({ json: { items: [], nextCursor: null } });
          if (path.includes("/digital-access/")) return route.fulfill({ json: {
            orderId: scenario === "unowned" ? null : "a1", files: scenario === "unowned" ? [] : Array.from({ length: scenario === "multiple" ? 2 : 1 }, (_, i) => ({
              downloadUrl: `/orders/a1/items/b1/download?fileIndex=${i}`, maxDownloads: 2, downloadCount: scenario === "exhausted" ? 2 : 0
            }))
          } });
          if (path.includes("/items/")) {
            claims.push({ method: request.method(), index: new URL(request.url()).searchParams.get("fileIndex") });
            return route.fulfill({ status: scenario === "failure" ? 503 : 200, json: { url: "https://files.example/file.zip" } });
          }
          throw new Error(`Unexpected API request: ${request.url()}`);
        });
        await page.goto(`${origin}/?role=${role}&scenario=${scenario}`);
        await page.getByRole("button", { name: "Download", exact: true }).click();
        if (role === "guest" || scenario === "unowned") {
          await page.waitForFunction(() => Boolean(window.testNavigation));
          const path = await page.evaluate(() => window.testNavigation);
          assert.ok(role === "guest" ? path.startsWith("/en/login?next=") : path === "/en/cart");
          if (role !== "guest") {
            const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("topgsm-cart-v1")));
            assert.equal(cart.length, 1);
            assert.equal(cart[0].offerId, "22222222-2222-4222-8222-222222222222");
          }
        } else if (scenario === "free") {
          await page.getByRole("link", { name: "File 2", exact: true }).waitFor();
          assert.match(await page.getByRole("link", { name: "File 2", exact: true }).getAttribute("href"), /free-download\/22222222-2222-4222-8222-222222222222\?fileIndex=1$/);
        } else if (scenario === "exhausted") {
          await page.getByRole("alert").filter({ hasText: "The download limit has been reached." }).waitFor();
          assert.equal(claims.length, 0);
        } else if (scenario === "failure") {
          await page.getByRole("alert").filter({ hasText: "We couldn't check download access." }).waitFor();
          assert.deepEqual(claims, [{ method: "POST", index: "0" }]);
        } else {
          if (scenario === "multiple") await page.getByRole("button", { name: "File 2", exact: true }).click();
          await page.waitForFunction(() => document.querySelector('[aria-busy="false"]'));
          assert.deepEqual(claims, [{ method: "POST", index: scenario === "multiple" ? "1" : "0" }]);
        }
        assert.deepEqual(errors, []);
        checks++;
        if (role === "platform-admin" && scenario === "multiple") {
          await page.goto(`${origin}/?role=${role}&scenario=${scenario}&locale=fa`);
          await page.getByRole("button", { name: "دانلود", exact: true }).click();
          await page.getByRole("button", { name: "فایل ۲", exact: true }).waitFor();
          await page.evaluate(() => document.fonts.ready);
          for (const [width, height] of [[1366, 768], [1440, 900], [375, 812], [320, 740], [683, 384]]) {
            await page.setViewportSize({ width, height });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal overflow at ${width}px`);
            const fileButton = page.getByRole("button", { name: "فایل ۲", exact: true });
            await fileButton.scrollIntoViewIfNeeded();
            const bounds = await fileButton.boundingBox();
            assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y >= 0 && bounds.y + bounds.height <= height + 1, `Download control remains reachable at ${width}px`);
            await page.screenshot({ path: resolve(output, `persian-${width}.png`) });
          }
        }
      } finally { await context.close(); }
    }
  }
  console.log(`${checks} product purchase/download browser scenarios passed; Persian layout checked at 5 viewport sizes (683px approximates 200% desktop reflow).`);
} finally {
  await browser?.close();
  server.close();
}
