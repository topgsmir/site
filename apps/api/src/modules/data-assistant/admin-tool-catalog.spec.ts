import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import * as ts from "typescript";
import { ADMIN_TOOL_CATALOG, AdminToolCatalogService } from "./admin-tool-catalog";

function controllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? controllerFiles(path) : entry.name.endsWith(".controller.ts") ? [path] : [];
  });
}

function decoratorCall(node: ts.Node, name: string) {
  if (!ts.canHaveDecorators(node)) return undefined;
  return ts.getDecorators(node)?.map((decorator) => decorator.expression).find((expression): expression is ts.CallExpression => ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && expression.expression.text === name);
}

function literalRoutes(call: ts.CallExpression | undefined): string[] {
  const argument = call?.arguments[0];
  if (!argument) return [""];
  if (ts.isStringLiteral(argument)) return [argument.text];
  if (ts.isArrayLiteralExpression(argument)) return argument.elements.filter(ts.isStringLiteral).map((element) => element.text);
  return [];
}

function applicationRoutes() {
  const verbs = ["Get", "Post", "Put", "Patch", "Delete"] as const;
  const routes: string[] = [];
  for (const file of controllerFiles(join(process.cwd(), "src"))) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    source.forEachChild((node) => {
      if (!ts.isClassDeclaration(node)) return;
      const controllers = literalRoutes(decoratorCall(node, "Controller"));
      if (!controllers.length) return;
      for (const member of node.members) {
        for (const verb of verbs) {
          const method = decoratorCall(member, verb);
          if (!method) continue;
          for (const controller of controllers) for (const route of literalRoutes(method)) routes.push(`${verb.toUpperCase()} /${[controller, route].filter(Boolean).join("/")}`);
        }
      }
    });
  }
  return [...new Set(routes)].sort();
}

test("catalog exposes a broad unique tool surface without recursive assistant routes", () => {
  assert.ok(ADMIN_TOOL_CATALOG.length >= 150);
  assert.equal(new Set(ADMIN_TOOL_CATALOG.map((entry) => entry.name)).size, ADMIN_TOOL_CATALOG.length);
  assert.ok(ADMIN_TOOL_CATALOG.every((entry) => entry.name.length <= 64));
  assert.ok(ADMIN_TOOL_CATALOG.every((entry) => !entry.path.startsWith("/ai/data")));
  assert.ok(ADMIN_TOOL_CATALOG.filter((entry) => entry.method !== "GET").every((entry) => entry.risk !== "read"));
});

test("catalog covers every ordinary controller route and documents security-flow exclusions", () => {
  const catalogRoutes = new Set(ADMIN_TOOL_CATALOG.map((entry) => `${entry.method} ${entry.path}`));
  const excluded = [
    "GET /payments/zarinpal/callback",
    "GET /system/restores/:id",
    "POST /admin/staff/setup/:token",
    "POST /auth/login",
    "POST /auth/logout",
    "POST /auth/otp/request",
    "POST /auth/otp/verify",
    "POST /auth/register",
    "POST /captcha/challenge"
  ];
  const uncovered = applicationRoutes().filter((route) => !route.includes(" /ai/data/") && !catalogRoutes.has(route));
  assert.deepEqual(uncovered, excluded);
});

test("prepares only the declared route parameters and encodes path values", () => {
  const catalog = new AdminToolCatalogService();
  const prepared = catalog.prepare("admin_user_get", { path: { id: "user/with space" } });
  assert.equal(prepared.method, "GET");
  assert.equal(prepared.path, "/admin/users/user%2Fwith%20space");
  assert.deepEqual(prepared.query, {});
  assert.throws(() => catalog.prepare("admin_user_get", { path: {} }), BadRequestException);
  assert.throws(() => catalog.prepare("admin_user_get", { path: { id: "one", extra: "two" } }), BadRequestException);
  assert.throws(() => catalog.prepare("not_allowlisted", {}), BadRequestException);
});

test("bounds tool input and rejects direct credential-shaped storage fields", () => {
  const catalog = new AdminToolCatalogService();
  assert.throws(() => catalog.prepare("admin_user_update", { path: { id: "user" }, body: { password_hash: "nope" } }), BadRequestException);
  assert.throws(() => catalog.prepare("admin_ai_profile_create", { body: { apiKey: "nope" } }), BadRequestException);
  assert.throws(() => catalog.prepare("site_products_search", { query: { accessToken: "nope" } }), BadRequestException);
  assert.deepEqual(catalog.prepare("admin_ai_profile_create", { body: { apiKey: { $secureInput: "AI API key" } } }).body, { apiKey: { $secureInput: "AI API key" } });
  assert.deepEqual(catalog.prepare("admin_product_image_upload", { path: { productId: "product" }, body: { file: { $fileInput: { label: "Product image", accept: "image/png", maxBytes: 1024 } } } }).body, { file: { $fileInput: { label: "Product image", accept: "image/png", maxBytes: 1024 } } });
  assert.throws(() => catalog.prepare("admin_product_image_upload", { path: { productId: "product" }, body: { file: { $fileInput: { label: "x", accept: "image/png", maxBytes: 0 } } } }), BadRequestException);
  assert.throws(() => catalog.prepare("admin_user_update", { path: { id: "user" }, body: { value: Number.POSITIVE_INFINITY } }), BadRequestException);
  assert.throws(() => catalog.prepare("admin_user_update", { path: { id: "user" }, unexpected: true }), BadRequestException);
});

test("redacts credentials and bounds results before they can reach a model", () => {
  const catalog = new AdminToolCatalogService();
  const result = catalog.sanitizeResult({ id: "safe", email: "person@example.com", apiKey: "secret", nested: { access_token: "secret", value: "visible" }, oversized: "x".repeat(5_000) });
  assert.equal((result.value as Record<string, unknown>).email, "[redacted]");
  assert.equal((result.value as Record<string, unknown>).apiKey, "[redacted]");
  assert.equal(((result.value as Record<string, unknown>).nested as Record<string, unknown>).access_token, "[redacted]");
  assert.equal(((result.value as Record<string, unknown>).nested as Record<string, unknown>).value, "visible");
  assert.equal(result.truncated, true);
});

test("searches the catalog with bounded progressive discovery", () => {
  const catalog = new AdminToolCatalogService();
  const matches = catalog.search("user inspect", "users", 500);
  assert.ok(matches.length > 0);
  assert.ok(matches.length <= 100);
  assert.ok(matches.every((entry) => entry.domain === "users"));
  assert.ok(matches.some((entry) => entry.name === "admin_user_get"));
  assert.equal(catalog.search("user", "not-a-domain", 10).length, 0);
  assert.match(catalog.compactPrompt("product image"), /Domains:/);
  const capabilities = catalog.capabilitySummary();
  assert.equal(capabilities.reduce((sum, domain) => sum + domain.toolCount, 0), ADMIN_TOOL_CATALOG.length);
  assert.ok(capabilities.some((domain) => domain.domain === "catalog" && domain.examples.length > 0));
});
