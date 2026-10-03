import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateProductDescriptionTemplateDto, ProductDescriptionTemplatesQueryDto, UpdateProductDescriptionTemplateDto } from "./dto/product-description-template.dto";

const templateSelect = {
  id: true,
  locale: true,
  name: true,
  content: true,
  active: true,
  updated_at: true
} satisfies Prisma.product_description_templatesSelect;

@Injectable()
export class ProductDescriptionTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ProductDescriptionTemplatesQueryDto, activeOnly: boolean) {
    const rows = await this.prisma.product_description_templates.findMany({
      where: { locale: query.locale, ...(activeOnly ? { active: true } : {}) },
      select: templateSelect,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit).map((row) => ({
      id: row.id,
      locale: row.locale,
      name: row.name,
      content: row.content,
      active: row.active,
      updatedAt: row.updated_at.toISOString()
    }));
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }

  async create(body: CreateProductDescriptionTemplateDto, actorId: string) {
    const name = body.name.trim();
    const content = body.content.trim();
    if (!name || !content) throw new BadRequestException("Template name and content are required");
    const row = await this.prisma.product_description_templates.create({
      data: { locale: body.locale, name, content, active: body.active ?? true, created_by_id: actorId, updated_by_id: actorId },
      select: templateSelect
    });
    return { id: row.id, locale: row.locale, name: row.name, content: row.content, active: row.active, updatedAt: row.updated_at.toISOString() };
  }

  async update(id: string, body: UpdateProductDescriptionTemplateDto, actorId: string) {
    if (!Object.keys(body).length) throw new BadRequestException("No template changes supplied");
    const name = body.name?.trim();
    const content = body.content?.trim();
    if (name === "" || content === "") throw new BadRequestException("Template name and content are required");
    const updated = await this.prisma.product_description_templates.updateMany({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        updated_by_id: actorId
      }
    });
    if (!updated.count) throw new NotFoundException("Template not found");
    const row = await this.prisma.product_description_templates.findUniqueOrThrow({ where: { id }, select: templateSelect });
    return { id: row.id, locale: row.locale, name: row.name, content: row.content, active: row.active, updatedAt: row.updated_at.toISOString() };
  }
}
