import { ConflictException, Injectable } from "@nestjs/common";
import type { AdminSeoSettings, SeoConfiguration, SeoHistoryEntry } from "@topgsm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "../../prisma/client";
import { defaultSeoConfiguration, validateSeoConfiguration } from "./seo-settings.policy";
import type { UpdateSeoSettingsDto } from "./seo-settings.dto";

const select = { version: true, configuration: true, updated_at: true } satisfies Prisma.seo_settingsSelect;
@Injectable()
export class SeoSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AdminSeoSettings> {
    const row = await this.prisma.seo_settings.findUnique({ where: { id: 1 }, select });
    return row ? { version: row.version, configuration: row.configuration as unknown as SeoConfiguration, updatedAt: row.updated_at.toISOString() } : { version: 0, configuration: defaultSeoConfiguration(), updatedAt: null };
  }

  async history(): Promise<SeoHistoryEntry[]> {
    const rows = await this.prisma.seo_setting_events.findMany({ orderBy: { version: "desc" }, take: 20, select: { version: true, configuration: true, created_at: true, actor_user_id: true } });
    return rows.map((row) => ({ version: row.version, configuration: row.configuration as unknown as SeoConfiguration, updatedAt: row.created_at.toISOString(), actorUserId: row.actor_user_id }));
  }

  async publicConfiguration(): Promise<SeoConfiguration> {
    const configuration = (await this.get()).configuration;
    const destinations = configuration.redirects.filter((item) => item.enabled).map((item) => {
      const [, locale, kind, slug] = item.destination.split("/");
      return { path: item.destination, locale: locale as "fa" | "en" | "ar", kind, slug: slug ? decodeURIComponent(slug) : "" };
    });
    const productSlugs = destinations.filter((item) => item.kind === "products" && item.slug).map((item) => item.slug);
    const blogTargets = destinations.filter((item) => item.kind === "blog" && item.slug && item.path.split("/").length === 4);
    const [products, articles] = await Promise.all([
      productSlugs.length ? this.prisma.product_slug_routes.findMany({ where: { slug: { in: productSlugs } }, take: 100, select: { slug: true, product: { select: { slug: true } } } }) : [],
      blogTargets.length ? this.prisma.blog_routes.findMany({ where: { OR: blogTargets.map(({ locale, slug }) => ({ locale, slug })) }, take: 100, select: { locale: true, slug: true, post: { select: { routes: { where: { is_current: true }, take: 3, select: { locale: true, slug: true } } } } } }) : []
    ]);
    const canonical = new Map(destinations.map((item) => {
      const slug = item.kind === "products" ? products.find((row) => row.slug === item.slug)?.product.slug : item.kind === "blog" && item.path.split("/").length === 4 ? articles.find((row) => row.locale === item.locale && row.slug === item.slug)?.post.routes.find((row) => row.locale === item.locale)?.slug : undefined;
      return [item.path, slug ? `/${item.locale}/${item.kind}/${encodeURIComponent(slug)}` : item.path];
    }));
    const redirects = configuration.redirects.filter((item) => item.enabled).map((item) => ({ ...item, destination: canonical.get(item.destination) ?? item.destination }));
    // A later product/article rename can create a chain or loop after settings were
    // saved. Resolve live canonical targets, flatten chains, and suppress cycles.
    configuration.redirects = redirects.flatMap((item) => {
      let destination = item.destination;
      const seen = new Set([item.source]);
      while (!seen.has(destination)) {
        seen.add(destination);
        const next = redirects.find((rule) => rule.source === destination);
        if (!next) return [{ ...item, destination }];
        destination = next.destination;
      }
      return [];
    });
    return configuration;
  }

  async update(input: UpdateSeoSettingsDto, actorUserId: string): Promise<AdminSeoSettings> {
    const configuration = validateSeoConfiguration(input.configuration);
    const json = configuration as unknown as Prisma.InputJsonValue;
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.version === 0) {
          await tx.seo_settings.create({ data: { id: 1, version: 1, configuration: json } });
        } else {
          const result = await tx.seo_settings.updateMany({ where: { id: 1, version: input.version }, data: { configuration: json, version: { increment: 1 } } });
          if (result.count !== 1) throw new ConflictException("SEO settings changed. Reload before saving.");
        }
        const row = await tx.seo_settings.findUniqueOrThrow({ where: { id: 1 }, select });
        await tx.seo_setting_events.create({ data: { version: row.version, configuration: json, actor_user_id: actorUserId } });
        return { version: row.version, configuration, updatedAt: row.updated_at.toISOString() };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("SEO settings changed. Reload before saving.");
      throw error;
    }
  }
}
