import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ConflictException, ValidationPipe } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { defaultTemplateConfiguration } from "@topgsm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { BROWSER_SESSION_MUTATION } from "../auth/browser-session-mutation.decorator";
import { HomepageImagesService } from "../homepage/homepage-images.service";
import { AdminTemplateController } from "./template.controller";
import { SaveTemplateSettingsDto, TemplateLocaleDto } from "./template.dto";
import { TemplateSettingsService, validateTemplateConfiguration } from "./template.service";

describe("template settings", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const validate = (configuration: unknown) => pipe.transform({ version: 0, configuration }, { type: "body", metatype: SaveTemplateSettingsDto });
  it("validates localized defaults and bounds nested menus", async () => {
    for (const locale of ["fa", "en", "ar"] as const) await validate(defaultTemplateConfiguration(locale));
    const bad = defaultTemplateConfiguration("fa"); bad.navigation = Array.from({ length: 9 }, () => ({ ...bad.navigation[0] }));
    await assert.rejects(validate(bad), BadRequestException);
    const wrong = defaultTemplateConfiguration("fa"); (wrong.banner as unknown as {enabled: string}).enabled = "false";
    await assert.rejects(validate(wrong), BadRequestException);
    const icon = defaultTemplateConfiguration("fa"); (icon.navigation[0] as unknown as {icon: string}).icon = "html";
    await assert.rejects(validate(icon), BadRequestException);
    await assert.rejects(validate({ ...defaultTemplateConfiguration("fa"), css: "unsafe" }), BadRequestException);
    await assert.rejects(pipe.transform({ locale: "zz" }, {type: "query", metatype: TemplateLocaleDto}), BadRequestException);
  });
  it("rejects executable, credential and encoded unsafe links in every menu", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,x", "//evil.test", "/\\evil.test", "/%2f%2fevil.test", "/%255cevil.test", "https://user:pass@evil.test", "/%0aevil", "http://example.com"]) {
      for (const key of ["banner", "navigation", "categories"] as const) {
        const c = defaultTemplateConfiguration("fa");
        if (key === "banner") c.banner.href = href;
        else if (key === "navigation") c.navigation[0].href = href;
        else c.categories.items[0].href = href;
        assert.throws(() => validateTemplateConfiguration(c), BadRequestException, href);
      }
    }
    const c = defaultTemplateConfiguration("en"); c.navigation[0].href = "https://example.com/shop?q=phone";
    assert.doesNotThrow(() => validateTemplateConfiguration(c));
  });
  it("requires accessible, locally served raster images and useful enabled banners", () => {
    for (const image of ["https://example.com/image.png", "/images/../secret.png", "/images/test.svg", "data:image/png,x", "/api/auth/me"]) {
      const c = defaultTemplateConfiguration("fa"); c.banner.image = image; c.banner.imageAlt = "Image";
      assert.throws(() => validateTemplateConfiguration(c), BadRequestException);
    }
    const c = defaultTemplateConfiguration("fa"); c.banner.image = "/images/repair-studio.png";
    assert.throws(() => validateTemplateConfiguration(c), BadRequestException);
    c.banner.imageAlt = "Repair"; assert.doesNotThrow(() => validateTemplateConfiguration(c));
    c.banner.image = ""; c.banner.text = " "; assert.throws(() => validateTemplateConfiguration(c), BadRequestException);
    c.banner.enabled = false; assert.doesNotThrow(() => validateTemplateConfiguration(c));
  });
  it("requires admin access and browser-session protection for all mutations", () => {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, AdminTemplateController), [PlatformAdminGuard]);
    for (const action of ["save", "upload"] as const) assert.equal(Reflect.getMetadata(BROWSER_SESSION_MUTATION, AdminTemplateController.prototype[action]), true);
  });
  it("supplies defaults and refuses stale saves without replacing data", async () => {
    const prisma = { template_settings: { findUnique: async () => null }, $transaction: async (fn: (tx: unknown) => unknown) => fn({template_settings:{updateMany: async () => ({count:0})}}) } as unknown as PrismaService;
    const service = new TemplateSettingsService(prisma);
    assert.deepEqual(await service.get("fa"), {locale:"fa", version:0, updatedAt:null, configuration:defaultTemplateConfiguration("fa")});
    await assert.rejects(service.save("fa", {version:5, configuration:defaultTemplateConfiguration("fa")}, "actor"), ConflictException);
  });
  it("limits writes before persistence and derives editor identity from the verified actor", async () => {
    const calls:string[]=[];
    const controller = new AdminTemplateController({save:async (_locale:unknown,_input:unknown,actor:string)=>{calls.push(actor);}} as unknown as TemplateSettingsService, {} as HomepageImagesService, {consumeMediaAdmin:async()=>{calls.push("limited");}} as never);
    await controller.save({locale:"fa"},{version:0,configuration:defaultTemplateConfiguration("fa")},{headers:{},authenticatedUser:{id:"verified-admin"} as never},"127.0.0.1");
    assert.deepEqual(calls,["limited","verified-admin"]);
  });
});
