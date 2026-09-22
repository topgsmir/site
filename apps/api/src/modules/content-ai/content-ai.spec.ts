import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadGatewayException, ForbiddenException, HttpException, ValidationPipe } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import { ContentAiService } from "./content-ai.service";
import { ContentAiDraftDto, ContentAiKindDto } from "./content-ai.dto";
import { contentAiPrompt, parseContentAiDraft } from "./content-ai-output";
import { ContentAiController } from "./content-ai.controller";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { BROWSER_SESSION_MUTATION } from "../auth/browser-session-mutation.decorator";
import { validateRichText } from "../blog/rich-text.validator";

const valid = () => ({ title: "Phone repair guide", slug: "phone-repair-guide", excerpt: "A useful repair guide.", seoTitle: "Phone repair guide", seoDescription: "Understand the supplied repair steps and limitations.", coverAltText: "A technician at a desk", category: "Repairs", tags: ["Phones"], warnings: [], blocks: [{ type: "heading", level: 2, text: "Before you start" }, { type: "paragraph", text: "Disconnect power before inspecting the supplied phone." }, { type: "bulletList", items: ["Check the model", "Use the supplied tools"] }] });
const user: AppUser = { id: "seller-user", role: "seller-admin", fullName: "Seller", email: null };
const input: ContentAiDraftDto = { locale: "fa", source: "Facts about a phone repair service with supplied limitations." };

function setup() {
  const events: string[] = [];
  const writes: unknown[] = [];
  let permitted = true;
  let output = JSON.stringify(valid());
  let providerFailure = false;
  let blocked = false;
  let revoke = false;
  const prisma = {
    seller_memberships: { findFirst: async (query: unknown) => { writes.push(query); events.push("permission"); return permitted ? { seller_id: "seller" } : null; } },
    ai_capability_bindings: { findUnique: async () => ({ profile: { status: "active" } }) },
    ai_audit_events: {
      create: async (query: unknown) => { writes.push(query); events.push("audit"); return { id: "audit" }; },
      update: async (query: unknown) => { writes.push(query); return {}; }
    }
  };
  const profiles = { activeFor: async (key: string) => { events.push(key); return { id: "model", input_price_per_million_usd: null, output_price_per_million_usd: null }; } };
  const models = { complete: async () => { events.push("provider"); if (revoke) permitted = false; if (providerFailure) throw new Error("secret upstream credentials"); return { text: output, inputTokens: 30, outputTokens: 40 }; } };
  const limits = { consumeAiRun: async (id: string, ip: string) => { events.push(`limit:${id}:${ip}`); if (blocked) throw new HttpException("limited", 429); } };
  const service = new ContentAiService(prisma as never, profiles as never, models as never, limits as never);
  return { service, events, writes, deny: () => { permitted = false; }, output: (value: string) => { output = value; }, fail: () => { providerFailure = true; }, block: () => { blocked = true; }, revoke: () => { revoke = true; } };
}

describe("AI authoring authorization and provider boundary", () => {
  it("requires authentication on both endpoints and browser-origin protection on generation", () => {
    assert.ok(Reflect.getMetadata("__guards__", ContentAiController).includes(AuthenticatedGuard));
    assert.equal(Reflect.getMetadata(BROWSER_SESSION_MUTATION, ContentAiController.prototype.generate), true);
  });
  it("requires both grants on one active, approved, non-suspended seller membership", async () => {
    const test = setup();
    assert.equal(await test.service.canUse(user, "blog"), true);
    assert.deepEqual(test.writes[0], { where: { user_id: user.id, active: true, seller: { invited: false, approved: true, suspended_at: null, AND: [{ permissions: { some: { permission: "blog_manage" } } }, { permissions: { some: { permission: "blog_ai" } } }] } }, select: { seller_id: true } });
    await test.service.canUse({ ...user, role: "seller-staff" }, "product");
    assert.match(JSON.stringify(test.writes[1]), /products_ai/);
    assert.doesNotMatch(JSON.stringify(test.writes[1]), /blog_ai/);
  });
  it("denies buyers and unauthorized members before any provider or limiter call", async () => {
    const test = setup(); test.deny();
    await assert.rejects(test.service.generate(user, "blog", input, "127.0.0.1"), ForbiddenException);
    assert.equal(await test.service.canUse({ ...user, role: "buyer" }, "product"), false);
    assert.deepEqual(test.events, ["permission"]);
  });
  it("permits the platform owner and limits platform staff to their blog role", async () => {
    const test = setup();
    assert.equal(await test.service.canUse({ ...user, role: "platform-admin" }, "product"), true);
    assert.equal(await test.service.canUse({ ...user, role: "platform-staff", platformPermissions: ["blog_manage"] }, "blog"), true);
    assert.equal(await test.service.canUse({ ...user, role: "platform-staff", platformPermissions: ["catalog_view"] }, "product"), false);
    assert.equal(await test.service.canUse({ ...user, role: "platform-staff" }, "blog"), false);
  });
  it("limits before the provider, returns language identity, and audits usage without content", async () => {
    const test = setup();
    const result = await test.service.generate(user, "blog", input, "127.0.0.1");
    assert.equal(result.locale, "fa"); assert.equal(result.status, "ready");
    assert.equal(result.draft.coverAltText, "");
    assert.ok(test.events.indexOf("limit:seller-user:127.0.0.1") < test.events.indexOf("provider"));
    const encoded = JSON.stringify(test.writes);
    assert.match(encoded, /inputTokens/); assert.doesNotMatch(encoded, /Facts about|Phone repair guide/);
  });
  it("preserves supplied cover descriptions and filters taxonomy suggestions", async () => {
    const test = setup();
    const result = await test.service.generate(user, "blog", { ...input, coverDescription: "Technician at a desk", categories: ["Accessories"], tags: ["Phones"] }, "ip");
    assert.equal(result.draft.coverAltText, "A technician at a desk"); assert.equal(result.draft.category, ""); assert.deepEqual(result.draft.tags, ["Phones"]);
  });
  it("does not call a provider after a rate-limit rejection", async () => {
    const test = setup(); test.block();
    await assert.rejects(test.service.generate(user, "product", input, "ip"), (error: unknown) => error instanceof HttpException && error.getStatus() === 429);
    assert.ok(!test.events.includes("provider")); assert.ok(!test.events.includes("audit"));
  });
  it("discards output when seller access is revoked during generation", async () => {
    const test = setup(); test.revoke();
    await assert.rejects(test.service.generate(user, "blog", input, "ip"), ForbiddenException);
  });
  it("contains provider failures and accounts for malformed paid responses", async () => {
    const test = setup(); test.fail();
    await assert.rejects(test.service.generate(user, "blog", input, "ip"), (error: unknown) => error instanceof BadGatewayException && !error.message.includes("secret"));
    const malformed = setup(); malformed.output('{"blocks":');
    await assert.rejects(malformed.service.generate(user, "blog", input, "ip"), BadGatewayException);
    assert.match(JSON.stringify(malformed.writes), /authoring_invalid_output/);
    assert.match(JSON.stringify(malformed.writes), /outputTokens/);
  });
});

describe("AI content validation", () => {
  it("rejects malformed text nodes at the blog save boundary instead of crashing rendering", () => {
    for (const text of [null, {}, [], 42, undefined]) {
      assert.throws(() => validateRichText({ type: "doc", content: [{ type: "text", text }] }), /must contain a string/);
    }
    assert.doesNotThrow(() => validateRichText(parseContentAiDraft(valid()).content));
  });
  it("builds safe rich text and escapes all provider HTML", () => {
    const raw = valid(); raw.blocks[1].text = '<img src=x onerror="alert(1)"> & phone';
    const draft = parseContentAiDraft(raw);
    assert.match(draft.html, /&lt;img/); assert.doesNotMatch(draft.html, /<img/);
    assert.equal(draft.content.content?.[1].content?.[0].text, raw.blocks[1].text);
  });
  it("rejects invalid slugs, executable blocks, excessive text, and missing output", () => {
    for (const raw of [null, { ...valid(), slug: "../bad" }, { ...valid(), seoTitle: "x".repeat(71) }, { ...valid(), blocks: [{ type: "image", src: "javascript:bad" }] }, { ...valid(), blocks: [] }, { ...valid(), blocks: [{ type: "heading", level: 1, text: "Bad" }] }, { ...valid(), title: " " }]) assert.throws(() => parseContentAiDraft(raw));
  });
  it("uses bounded DTOs and rejects actor/profile injection", async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    const metadata = { type: "body" as const, metatype: ContentAiDraftDto };
    await pipe.transform(input, metadata);
    for (const value of [{ ...input, source: "short" }, { ...input, source: "x".repeat(16001) }, { ...input, locale: "xx" }, { ...input, sellerId: "other" }, { ...input, profileId: "other" }, { ...input, tags: Array(201).fill("tag") }]) await assert.rejects(pipe.transform(value, metadata));
    await assert.rejects(pipe.transform({ kind: "database_assistant" }, { type: "param", metatype: ContentAiKindDto }));
  });
  it("separates untrusted source instructions and sets native-language factual writing rules", () => {
    for (const locale of ["fa", "en", "ar"]) {
      const prompt = contentAiPrompt("blog", locale);
      assert.match(prompt, /untrusted source/); assert.match(prompt, /Do not invent/); assert.match(prompt, /keyword-stuff/); assert.match(prompt, /نیم‌فاصله/);
    }
  });
});
