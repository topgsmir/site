import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { defaultTemplateConfiguration, type TemplateConfiguration, type TemplateLocale, type TemplateSettingsDocument } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { SaveTemplateSettingsDto } from "./template.dto";

export function validateTemplateConfiguration(configuration: TemplateConfiguration): TemplateConfiguration {
  const value = structuredClone(configuration);
  const links = [value.banner, ...value.navigation, ...value.categories.items];
  for (const link of links) {
    const href = link.href;
    // Decode before checking separators and controls; encoded unsafe schemes must not become links.
    let decoded = href;
    try { for (let i = 0; i < 3; i++) { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; } } catch { throw new BadRequestException("Invalid destination URL"); }
    const unsafe = Array.from(decoded).some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return character === "\\" || /\s/u.test(character) || code <= 0x1f || code === 0x7f;
    });
    if (unsafe) throw new BadRequestException("Invalid destination URL");
    if (/^\/(?!\/)/.test(decoded) || /^#[a-z][a-z0-9-]*$/i.test(decoded)) continue;
    try { const url = new URL(href); if (url.protocol === "https:" && !url.username && !url.password) continue; } catch { /* Controlled error below. */ }
    throw new BadRequestException("Use a same-site path, section anchor, or HTTPS URL");
  }
  if (value.banner.image && !/^\/(?:images\/[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp)|homepage-images\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp)$/.test(value.banner.image)) throw new BadRequestException("Choose an uploaded or bundled image");
  if (value.banner.enabled && !value.banner.text.trim() && !value.banner.image) throw new BadRequestException("An enabled banner needs text or an image");
  if (value.banner.image && !value.banner.imageAlt.trim()) throw new BadRequestException("Add an accessible image description");
  value.tagline = value.tagline.trim(); value.banner.text = value.banner.text.trim(); value.banner.linkLabel = value.banner.linkLabel.trim(); value.banner.imageAlt = value.banner.imageAlt.trim(); value.categories.title = value.categories.title.trim();
  for (const item of [...value.navigation, ...value.categories.items]) item.label = item.label.trim();
  return value;
}
const select = { configuration: true, version: true, updated_at: true } satisfies Prisma.template_settingsSelect;
@Injectable()
export class TemplateSettingsService {
  constructor(private readonly prisma: PrismaService) {}
  async get(locale: TemplateLocale): Promise<TemplateSettingsDocument> {
    const row = await this.prisma.template_settings.findUnique({ where: { locale }, select });
    return { locale, version: row?.version ?? 0, configuration: row ? row.configuration as unknown as TemplateConfiguration : defaultTemplateConfiguration(locale), updatedAt: row?.updated_at.toISOString() ?? null };
  }
  async save(locale: TemplateLocale, input: SaveTemplateSettingsDto, actorId: string): Promise<TemplateSettingsDocument> {
    const configuration = validateTemplateConfiguration(input.configuration);
    const json = configuration as unknown as Prisma.InputJsonValue;
    const conflict = () => new ConflictException("Template settings changed in another session. Reload before saving.");
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.version === 0) await tx.template_settings.create({ data: { locale, configuration: json, version: 1, updated_by_id: actorId } });
        else {
          const result = await tx.template_settings.updateMany({ where: { locale, version: input.version }, data: { configuration: json, version: { increment: 1 }, updated_by_id: actorId } });
          if (result.count !== 1) throw conflict();
        }
        const row = await tx.template_settings.findUniqueOrThrow({ where: { locale }, select });
        return { locale, version: row.version, configuration, updatedAt: row.updated_at.toISOString() };
      });
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict(); throw error; }
  }
}
