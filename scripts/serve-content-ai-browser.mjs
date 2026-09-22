import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "apps/web/package.json"));
const store = resolve(root, "node_modules/.pnpm");
const esbuildPackage = readdirSync(store).find((name) => name.startsWith("esbuild@"));
if (!esbuildPackage) throw new Error("Bootstrap the workspace before running the browser fixture");
const { build } = require(resolve(store, esbuildPackage, "node_modules/esbuild"));
const out = resolve(root, "tmp/content-ai-browser");
mkdirSync(out, { recursive: true });
await build({ entryPoints: [resolve(root, "scripts/fixtures/content-ai-browser.tsx")], bundle: true, outfile: resolve(out, "app.js"), jsx: "automatic", tsconfig: resolve(root, "apps/web/tsconfig.json"), loader: { ".module.css": "local-css" }, nodePaths: [resolve(root, "apps/web/node_modules")], alias: { "next/link": resolve(root, "scripts/fixtures/content-ai-next-link.tsx"), "next/image": resolve(root, "scripts/fixtures/content-ai-next-image.tsx") }, define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_URL": '"http://127.0.0.1:4179/api"' } });
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>:root{--ink:#202420;--muted:#686c68;--paper:#f7f7f2;--paper-bright:#fff;--line:#dce0da;--signal:#4a7955}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,sans-serif}*{box-sizing:border-box}button,input,textarea,select{font:inherit}main{min-width:0}#root>main{max-width:900px;margin:auto;padding:20px}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
createServer((request, response) => {
  if (request.url === "/app.js" || request.url === "/app.css") {
    response.setHeader("Content-Type", request.url.endsWith(".css") ? "text/css" : "text/javascript");
    response.end(readFileSync(resolve(out, request.url.slice(1))));
  } else { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); }
}).listen(4179, "127.0.0.1", () => console.log("Authoring component fixture: http://127.0.0.1:4179"));
