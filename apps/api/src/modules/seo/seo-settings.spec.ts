import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { defaultSeoConfiguration, normalizeSeoPath, validateSeoConfiguration } from "./seo-settings.policy";
import { UpdateSeoSettingsDto } from "./seo-settings.dto";
import { SeoSettingsService } from "./seo-settings.service";
import type { PrismaService } from "../../prisma/prisma.service";

describe("SEO configuration validation", () => {
  it("normalizes Persian paths and rejects protected paths and URL bypasses", () => {
    assert.equal(normalizeSeoPath("/fa/products/آموزش/"), "/fa/products/" + encodeURIComponent("آموزش"));
    for (const path of ["//evil.test", "https://evil.test", "/en/admin", "/en/account", "/en/login", "/en/products/a?x=1", "/en/products/../admin", "/en/products/%2e%2e", "/en/products/%252fadmin", "/en/products/a%5cb", "/en/products/a%0Ab", "/en/products/a.html", "/en/products/a%00"]) {
      assert.throws(() => normalizeSeoPath(path), path);
    }
  });
  it("rejects duplicate locales/pages, loops, chains, credential URLs and raw markup", async () => {
    const check = (change: (config: ReturnType<typeof defaultSeoConfiguration>) => void) => { const config = defaultSeoConfiguration(); change(config); assert.throws(() => validateSeoConfiguration(config)); };
    check((config) => { config.locales[1]!.locale = "fa"; });
    check((config) => { config.locales[0]!.socialImage = "javascript:alert(1)"; });
    check((config) => { config.organizationLogo = "https://user:secret@example.com/a.png"; });
    check((config) => { config.redirects = [{ source: "/en", destination: "/en/products", status: 301, enabled: true }, { source: "/en/products", destination: "/en/blog", status: 301, enabled: true }]; });
    check((config) => { config.redirects = [{ source: "/en", destination: "/en/", status: 301, enabled: false }]; });
    check((config) => { config.pages = ["/fa", "/fa/"].map((path) => ({ path, title: "", description: "", socialImage: "", noIndex: false, excludeFromSitemap: false })); });
    for (const change of [
      (body: UpdateSeoSettingsDto) => { body.configuration.googleVerification = '<meta content="abc">'; },
      (body: UpdateSeoSettingsDto) => { body.configuration.locales[0]!.titleTemplate = "%s %s"; },
      (body: UpdateSeoSettingsDto) => { body.configuration.redirects = Array.from({ length: 101 }, () => ({ source: "/en", destination: "/en/blog", status: 301, enabled: true })); },
      (body: UpdateSeoSettingsDto) => { Object.assign(body.configuration, { injected: true }); },
      (body: UpdateSeoSettingsDto) => { Object.assign(body.configuration.locales[0]!, { injected: true }); }
    ]) {
      const body = { version: 0, configuration: defaultSeoConfiguration() };
      change(body);
      const errors = await validate(plainToInstance(UpdateSeoSettingsDto, body), { whitelist: true, forbidNonWhitelisted: true });
      assert.ok(errors.length);
    }
    assert.equal((await validate(plainToInstance(UpdateSeoSettingsDto, { version: 0, configuration: defaultSeoConfiguration() }))).length, 0);
  });
  it("suppresses loops introduced by a later automatic product slug redirect", async () => {
    const config = defaultSeoConfiguration();
    config.redirects = [{ source: "/en/products/current", destination: "/en/products/old", status: 301, enabled: true }];
    const prisma = { seo_settings: { findUnique: async () => ({ version: 1, configuration: config, updated_at: new Date() }) }, product_slug_routes: { findMany: async () => [{ slug: "old", product: { slug: "current" } }] } } as unknown as PrismaService;
    const result = await new SeoSettingsService(prisma).publicConfiguration();
    assert.deepEqual(result.redirects, []);
  });
});
