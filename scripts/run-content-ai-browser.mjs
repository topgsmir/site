import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { firefox } = require(process.env.CONTENT_AI_PLAYWRIGHT_PATH || "playwright");
const browser = await firefox.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const testFile = resolve(root, "scripts/content-ai-browser.test.js");
  const run = runInThisContext(`(${readFileSync(testFile, "utf8")})`, { filename: testFile });
  console.log(JSON.stringify(await run(page), null, 2));
  const output = resolve(root, "tmp/content-ai-browser");
  mkdirSync(output, { recursive: true });
  await page.locator("#authoring-mobile").screenshot({ path: resolve(output, "mobile.png") });
} finally { await browser.close(); }
