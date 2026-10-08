import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { defaultTemplateConfiguration } from "@topgsm/shared-types";
import { validateTemplateConfiguration } from "./template.service";

function configurationWithLink(href: string, target: "banner" | "navigation" | "categories") {
  const configuration = defaultTemplateConfiguration("fa");
  if (target === "banner") configuration.banner.href = href;
  else if (target === "navigation") configuration.navigation[0]!.href = href;
  else configuration.categories.items[0]!.href = href;
  return configuration;
}

for (const target of ["banner", "navigation", "categories"] as const) {
  test(`template ${target} rejects raw and encoded controls and unsafe separators`, () => {
    for (const code of [...Array.from({ length: 32 }, (_, code) => code), 127]) {
      const control = String.fromCharCode(code);
      const encoded = `%${code.toString(16).padStart(2, "0")}`;
      for (const suffix of [control, encoded, encodeURIComponent(encoded)]) {
        assert.throws(() => validateTemplateConfiguration(configurationWithLink(`/fa/products${suffix}`, target)), BadRequestException);
      }
    }
    for (const href of ["//example.org", "/%2fexample.org", "/%252fexample.org", "/fa\\products", "/fa%5cproducts", "/fa products", "/fa%20products", "javascript:alert(1)", "data:text/html,hello", "http://example.org", "https://user:password@example.org", "/invalid%ZZ"]) {
      assert.throws(() => validateTemplateConfiguration(configurationWithLink(href, target)), BadRequestException, href);
    }
  });
  test(`template ${target} accepts site paths, anchors, HTTPS, and Persian text`, () => {
    for (const href of ["/fa/products", "/fa/products?search=تعمیرات", "/fa/products?search=%D9%81%D8%A7%DB%8C%D9%84", "#services", "https://example.org/products"]) {
      const configuration = configurationWithLink(href, target);
      assert.deepEqual(validateTemplateConfiguration(configuration), configuration);
    }
  });
}
