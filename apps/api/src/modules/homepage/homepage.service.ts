import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import type { HomepageContent, HomepageDocument, HomepageLocale } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { SaveHomepageDto } from "./homepage.dto";

function hasUnsafeUrlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return character === "\\" || /\s/u.test(character) || code <= 0x1f || code === 0x7f;
  });
}

/** No HTML, arbitrary CSS, remote image fetching, or executable URL schemes. */
export function validateHomepageLinks(content: HomepageContent) {
  const cards = [...content.shortcuts, ...content.collections.items, ...content.offers.items];
  const links = [...cards, content.hero.primary, content.hero.secondary, content.about.link, ...content.footer.links];
  for (const { href } of links) {
    if (hasUnsafeUrlCharacters(href) || /%0[ad]|%5c/i.test(href)) throw new BadRequestException("Invalid destination URL");
    if (/^\/(?!\/)/.test(href) || /^#[a-z][a-z0-9-]*$/i.test(href)) continue;
    try {
      const url = new URL(href);
      if (url.protocol === "https:" && !url.username && !url.password) continue;
    } catch { /* Report a controlled validation error below. */ }
    throw new BadRequestException("Use a same-site path, section anchor, or HTTPS URL");
  }
  for (const src of [content.hero.image, ...cards.map((card) => card.image)].filter(Boolean)) {
    if (!/^\/(?:images\/[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp)|homepage-images\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp)$/.test(src)) {
      throw new BadRequestException("Choose a homepage upload or a bundled image");
    }
  }
}

@Injectable()
export class HomepageService {
  constructor(private readonly prisma: PrismaService) {}

  async get(locale: HomepageLocale): Promise<HomepageDocument> {
    const row = await this.prisma.homepage_content.findUnique({ where: { locale }, select: { content: true, version: true, updated_at: true } });
    return { locale, content: row ? row.content as unknown as HomepageContent : null, version: row?.version ?? 0, updatedAt: row?.updated_at.toISOString() ?? null };
  }

  async save(locale: HomepageLocale, input: SaveHomepageDto, actorId: string): Promise<HomepageDocument> {
    validateHomepageLinks(input.content);
    const content = JSON.parse(JSON.stringify(input.content)) as Prisma.InputJsonValue;
    const conflict = () => new ConflictException("The homepage changed in another session. Reload before saving.");
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.version === 0) {
          await tx.homepage_content.create({ data: { locale, content, version: 1, updated_by_id: actorId } });
        } else {
          const result = await tx.homepage_content.updateMany({
            where: { locale, version: input.version },
            data: { content, version: { increment: 1 }, updated_by_id: actorId }
          });
          if (result.count !== 1) throw conflict();
        }
        const row = await tx.homepage_content.findUniqueOrThrow({ where: { locale }, select: { content: true, version: true, updated_at: true } });
        return { locale, content: row.content as unknown as HomepageContent, version: row.version, updatedAt: row.updated_at.toISOString() };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict();
      throw error;
    }
  }
}
