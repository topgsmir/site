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
    // Phone verification is an identity proof flow, never an admin AI capability.
    "GET /auth/otp/pending-phone",
    "GET /payments/zarinpal/callback",
    "GET /payments/zibal/callback",
    "GET /system/restores/:id",
    "POST /admin/staff/setup/:token",
    "POST /auth/login",
    "POST /auth/logout",
    "POST /auth/otp/confirm-pending-phone",
    "POST /auth/otp/request",
    "POST /auth/otp/request-pending-phone",
    "POST /auth/otp/verify",
    "POST /auth/register",
    "POST /captcha/challenge",
    // A public OTP endpoint is excluded for the same reason as auth/otp.
    "POST /comments/guest-verification"
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
  assert.deepEqual(catalog.prepare("admin_user_create", { body: { fullName: "Buyer", email: "buyer@example.com", password: { $secureInput: "Initial password" } } }).body, { fullName: "Buyer", email: "buyer@example.com", password: { $secureInput: "Initial password" } });
  assert.throws(() => catalog.prepare("admin_user_create", { body: { fullName: "Buyer", email: "buyer@example.com", password: "plain-text-secret" } }), BadRequestException);
  assert.deepEqual(catalog.prepare("admin_user_password_change", { path: { id: "user" }, body: { currentPassword: { $secureInput: "Owner password" }, newPassword: { $secureInput: "New user password" } } }).body, { currentPassword: { $secureInput: "Owner password" }, newPassword: { $secureInput: "New user password" } });
  assert.throws(() => catalog.prepare("admin_user_password_change", { path: { id: "user" }, body: { currentPassword: "owner-password", newPassword: "new-password" } }), BadRequestException);
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
  assert.ok(capabilities.every((domain) => domain.examples.length <= 2));
});

test("finds product title tools from Persian and Arabic requests with accurate input hints", () => {
  const catalog = new AdminToolCatalogService();
  for (const query of ["عنوان محصول را تغییر بده", "تغيير عنوان المنتج"]) {
    const matches = catalog.search(query, "catalog", 30);
    assert.ok(matches.some((entry) => entry.name === "admin_product_update"));
    assert.match(catalog.compactPrompt(query), /admin_product_update/);
  }
  const translation = catalog.search("ترجمه عنوان محصول", "catalog", 30).find((entry) => entry.name === "admin_product_translation_update");
  assert.match(translation?.inputHint ?? "", /Both title and description are required/);
  assert.doesNotMatch(translation?.inputHint ?? "", /SEO fields|slug/);
  assert.ok(catalog.search("سفارش ارسال نشده", "orders", 16).some((entry) => entry.name === "admin_order_shipping_update"));
});

test("only read-only JSON GET tools can execute without a separate approval", () => {
  const catalog = new AdminToolCatalogService();
  assert.equal(catalog.canAutoExecute("admin_user_get"), true);
  assert.equal(catalog.canAutoExecute("admin_user_update"), false);
  assert.equal(catalog.canAutoExecute("site_homepage_image_download"), false);
  assert.equal(catalog.canAutoExecute("not_allowlisted"), false);
  const listed = catalog.list();
  assert.equal(listed.find((entry) => entry.name === "admin_user_get")?.requiresApproval, false);
  assert.equal(listed.find((entry) => entry.name === "admin_user_update")?.requiresApproval, true);
  assert.equal(listed.find((entry) => entry.name === "site_homepage_image_download")?.requiresApproval, true);
});
