import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import { ProductDescriptionTemplatesService } from "./product-description-templates.service";

const id = "00000000-0000-4000-8000-000000000001";
const actorId = "00000000-0000-4000-8000-000000000002";
const row = { id, locale: "fa", name: "معرفی", content: "{title}", active: true, updated_at: new Date("2026-09-30T00:00:00Z") };

describe("product description templates", () => {
  it("scopes seller reads to active templates and bounds the page", async () => {
    let query: Record<string, unknown> | undefined;
    const service = new ProductDescriptionTemplatesService({
      product_description_templates: { findMany: async (input: Record<string, unknown>) => { query = input; return [row, { ...row, id: actorId }]; } }
    } as unknown as PrismaService);
    const result = await service.list({ locale: "fa", limit: 1 }, true);
    assert.deepEqual(query?.where, { locale: "fa", active: true });
    assert.equal(query?.take, 2);
    assert.equal(result.items.length, 1);
    assert.equal(result.nextCursor, id);
    assert.equal(result.items[0]?.updatedAt, "2026-09-30T00:00:00.000Z");
  });

  it("rejects whitespace-only content before writing", async () => {
    const service = new ProductDescriptionTemplatesService({} as PrismaService);
    await assert.rejects(() => service.create({ locale: "fa", name: "Valid", content: "  " }, actorId), BadRequestException);
  });

  it("trims a new template and records its admin actor", async () => {
    let data: Record<string, unknown> | undefined;
    const service = new ProductDescriptionTemplatesService({
      product_description_templates: { create: async (input: { data: Record<string, unknown> }) => { data = input.data; return row; } }
    } as unknown as PrismaService);
    await service.create({ locale: "fa", name: "  معرفی  ", content: "  {title}  " }, actorId);
    assert.deepEqual(data, { locale: "fa", name: "معرفی", content: "{title}", active: true, created_by_id: actorId, updated_by_id: actorId });
  });

  it("cannot update a missing template", async () => {
    const service = new ProductDescriptionTemplatesService({
      product_description_templates: { updateMany: async () => ({ count: 0 }) }
    } as unknown as PrismaService);
    await assert.rejects(() => service.update(id, { active: false }, actorId), NotFoundException);
  });
});
