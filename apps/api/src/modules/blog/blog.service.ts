import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { blog_locale, blog_revision_status, Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { BlogActor } from "./blog-manage.guard";
import {
  BLOG_LOCALES,
  type CreateBlogPostDto,
  type ListBlogPostsQueryDto,
  type ProductOptionsQueryDto,
  type TaxonomyDto,
  type UpdateBlogPostDto
} from "./dto/blog-post.dto";
import { hasMeaningfulRichText, validateRichText } from "./rich-text.validator";

const managedInclude = {
  seller: { select: { id: true, shop_name: true } },
  routes: {
    where: { is_current: true },
    select: { locale: true, slug: true }
  },
  working_revision: {
    include: {
      translations: true,
      cover_asset: { include: { variants: true } },
      category: { include: { translations: true } },
      tags: { include: { tag: { include: { translations: true } } } },
      related_products: {
        orderBy: { position: "asc" },
        include: { product: true }
      }
    }
  }
} satisfies Prisma.blog_postsInclude;

type ManagedRecord = Prisma.blog_postsGetPayload<{ include: typeof managedInclude }>;
type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  async listManaged(actor: BlogActor, input: ListBlogPostsQueryDto) {
    const rows = await this.prisma.blog_posts.findMany({
      where: this.actorScope(actor),
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      include: managedInclude
    });
    const hasMore = rows.length > input.limit;
    const visible = rows.slice(0, input.limit);
    return {
      items: visible.map((row) => this.mapManaged(row)),
      nextCursor: hasMore ? visible.at(-1)?.id ?? null : null
    };
  }

  async getManaged(actor: BlogActor, postId: string) {
    return this.mapManaged(await this.requirePost(actor, postId));
  }

  async create(actor: BlogActor, input: CreateBlogPostDto) {
    const translations = this.normalizeTranslations(input.translations ?? []);
    const postId = await this.prisma.$transaction(async (tx) => {
      const post = await tx.blog_posts.create({
        data: {
          seller_id: actor.type === "seller" ? actor.sellerId : null,
          creator_user_id: actor.user.id
        },
        select: { id: true }
      });
      const revision = await tx.blog_revisions.create({
        data: {
          post_id: post.id,
          revision_number: 1,
          translations: {
            create: translations.map((translation) => ({
              locale: translation.locale,
              title: translation.title,
              slug_proposal: translation.slug,
              excerpt: translation.excerpt,
              seo_title: translation.seoTitle,
              seo_description: translation.seoDescription,
              cover_alt_text: translation.coverAltText,
              content_json: validateRichText(translation.content).content
            }))
          }
        },
        select: { id: true }
      });
      await tx.blog_posts.update({
        where: { id: post.id },
        data: { working_revision_id: revision.id }
      });
      return post.id;
    });
    return this.getManaged(actor, postId);
  }

  async update(actor: BlogActor, postId: string, input: UpdateBlogPostDto) {
    await this.requireTaxonomy(input.categoryId, input.tagIds);
    await this.requireProducts(actor, input.relatedProductIds);
    const translations = this.normalizeTranslations(input.translations);
    const inlineMediaIds = new Set<string>();
    const translationData = translations.map((translation) => {
      const richText = validateRichText(translation.content);
      richText.mediaIds.forEach((id) => inlineMediaIds.add(id));
      return {
        locale: translation.locale,
        title: this.clean(translation.title),
        slug_proposal: this.slugify(translation.slug),
        excerpt: this.clean(translation.excerpt),
        seo_title: this.clean(translation.seoTitle),
        seo_description: this.clean(translation.seoDescription),
        cover_alt_text: this.clean(translation.coverAltText),
        content_json: richText.content
      };
    });
    const allMediaIds = [
      ...(input.coverAssetId ? [input.coverAssetId] : []),
      ...inlineMediaIds
    ];
    await this.requireOwnedMedia(actor, postId, allMediaIds, input.coverAssetId);

    await this.prisma.$transaction(async (tx) => {
      const post = await this.requirePost(actor, postId, tx);
      const current = post.working_revision;
      if (!current) throw new ConflictException("Post has no working revision");
      if (current.optimistic_version !== input.optimisticVersion) {
        throw new ConflictException("The post changed; reload before saving")
      }
      const revision = current.status === "draft"
        ? current
        : await this.cloneRevision(tx, post);
      const updated = await tx.blog_revisions.updateMany({
        where: {
          id: revision.id,
          status: "draft",
          optimistic_version: revision.optimistic_version
        },
        data: {
          optimistic_version: { increment: 1 },
          cover_asset_id: input.coverAssetId ?? null,
          category_id: input.categoryId ?? null,
          moderation_note: null,
          moderated_by_id: null,
          submitted_at: null
        }
      });
      if (updated.count !== 1) {
        throw new ConflictException("The post changed; reload before saving");
      }
      await tx.blog_revision_translations.deleteMany({
        where: { revision_id: revision.id }
      });
      await tx.blog_revision_translations.createMany({
        data: translationData.map((translation) => ({
          revision_id: revision.id,
          ...translation
        }))
      });
      await tx.blog_revision_tags.deleteMany({ where: { revision_id: revision.id } });
      if (input.tagIds.length) {
        await tx.blog_revision_tags.createMany({
          data: input.tagIds.map((tagId) => ({ revision_id: revision.id, tag_id: tagId }))
        });
      }
      await tx.blog_revision_products.deleteMany({ where: { revision_id: revision.id } });
      if (input.relatedProductIds.length) {
        await tx.blog_revision_products.createMany({
          data: input.relatedProductIds.map((productId, position) => ({
            revision_id: revision.id,
            product_id: productId,
            position
          }))
        });
      }
      if (allMediaIds.length) {
        await tx.blog_media_assets.updateMany({
          where: { id: { in: allMediaIds } },
          data: { post_id: postId }
        });
      }
    });
    return this.getManaged(actor, postId);
  }

  async submit(actor: BlogActor, postId: string) {
    if (actor.type === "platform" || !actor.reviewRequired) {
      return this.publish(actor, postId);
    }
    await this.transition(actor, postId, "pending_review");
    return this.getManaged(actor, postId);
  }

  async publish(actor: BlogActor, postId: string) {
    if (actor.type === "seller" && actor.reviewRequired) {
      throw new ForbiddenException("This seller's posts require platform review");
    }
    await this.prisma.$transaction(async (tx) => {
      const post = await this.requirePost(actor, postId, tx);
      const revision = post.working_revision;
      if (!revision) throw new ConflictException("Post has no working revision");
      this.assertComplete(revision);
      if (revision.status !== "draft" && revision.status !== "pending_review") {
        throw new ConflictException("Only draft or pending revisions can be published");
      }
      const now = new Date();
      for (const translation of revision.translations) {
        const slug = this.slugify(translation.slug_proposal ?? "");
        const collision = await tx.blog_routes.findUnique({
          where: { locale_slug: { locale: translation.locale, slug } },
          select: { id: true, post_id: true }
        });
        if (collision && collision.post_id !== post.id) {
          throw new ConflictException(
            `The ${translation.locale} slug is already in use`
          );
        }
        await tx.blog_routes.updateMany({
          where: { post_id: post.id, locale: translation.locale, is_current: true },
          data: { is_current: false }
        });
        if (collision) {
          await tx.blog_routes.update({
            where: { id: collision.id },
            data: { is_current: true }
          });
        } else {
          await tx.blog_routes.create({
            data: { post_id: post.id, locale: translation.locale, slug }
          });
        }
      }
      await this.recordTransition(tx, post, actor.user.id, revision.status, "published", null);
      await tx.blog_revisions.update({
        where: { id: revision.id },
        data: {
          status: "published",
          published_at: now,
          moderated_by_id: actor.user.id,
          moderation_note: null
        }
      });
      await tx.blog_posts.update({
        where: { id: post.id },
        data: {
          published_revision_id: revision.id,
          working_revision_id: revision.id,
          published_at: post.published_at ?? now,
          archived_at: null,
          status: "published"
        }
      });
      const mediaIds = this.revisionMediaIds(revision);
      if (mediaIds.length) {
        await tx.blog_media_assets.updateMany({
          where: { id: { in: mediaIds } },
          data: { published_at: now, post_id: post.id }
        });
      }
    });
    return this.getManaged(actor, postId);
  }

  async reject(actor: BlogActor, postId: string, note: string) {
    if (actor.type !== "platform") {
      throw new ForbiddenException("Only platform editors can reject revisions");
    }
    await this.transition(actor, postId, "rejected", this.clean(note));
    return this.getManaged(actor, postId);
  }

  async withdraw(actor: BlogActor, postId: string) {
    await this.prisma.$transaction(async (tx) => {
      const post = await this.requirePost(actor, postId, tx);
      const revision = post.working_revision;
      if (!revision || revision.status !== "pending_review") {
        throw new ConflictException("Only pending revisions can be withdrawn");
      }
      await this.recordTransition(tx, post, actor.user.id, revision.status, "rejected", "Withdrawn by author");
      await tx.blog_revisions.update({
        where: { id: revision.id },
        data: { status: "rejected", moderation_note: "Withdrawn by author" }
      });
      await this.cloneRevision(tx, post);
    });
    return this.getManaged(actor, postId);
  }

  async archive(actor: BlogActor, postId: string, archived: boolean) {
    const post = await this.requirePost(actor, postId);
    await this.prisma.blog_posts.update({
      where: { id: post.id },
      data: {
        archived_at: archived ? new Date() : null,
        status: archived ? "archived" : post.published_revision_id ? "published" : "draft"
      }
    });
    return this.getManaged(actor, postId);
  }

  async listPublic(locale: blog_locale, input: ListBlogPostsQueryDto, filters?: {
    categorySlug?: string;
    tagSlug?: string;
    sellerId?: string;
  }) {
    const rows = await this.prisma.blog_posts.findMany({
      where: {
        archived_at: null,
        published_revision_id: { not: null },
        OR: [{ seller_id: null }, { seller: { approved: true, invited: false, suspended_at: null } }],
        ...(filters?.sellerId ? { seller_id: filters.sellerId } : {}),
        published_revision: {
          translations: { some: { locale } },
          ...(filters?.categorySlug
            ? { category: { translations: { some: { locale, slug: filters.categorySlug } } } }
            : {}),
          ...(filters?.tagSlug
            ? { tags: { some: { tag: { translations: { some: { locale, slug: filters.tagSlug } } } } } }
            : {})
        }
      },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ published_at: "desc" }, { id: "desc" }],
      include: this.publicInclude(locale)
    });
    const hasMore = rows.length > input.limit;
    const visible = rows.slice(0, input.limit);
    return {
      items: visible.map((post) => this.mapPublicSummary(post, locale)),
      nextCursor: hasMore ? visible.at(-1)?.id ?? null : null
    };
  }

  async getPublic(locale: blog_locale, slug: string) {
    if (!slug || slug.length > 200) throw new NotFoundException("Blog post was not found");
    const route = await this.prisma.blog_routes.findUnique({
      where: { locale_slug: { locale, slug } },
      include: {
        post: { include: this.publicInclude(locale, true) }
      }
    });
    const post = route?.post;
    if (
      !post ||
      post.archived_at ||
      !post.published_revision ||
      (post.seller && (!post.seller.approved || post.seller.invited || post.seller.suspended_at))
    ) {
      throw new NotFoundException("Blog post was not found");
    }
    if (!route.is_current) {
      const current = post.routes.find((item) => item.locale === locale && item.is_current);
      return { redirectTo: current?.slug ?? null, permanent: true };
    }
    const translation = post.published_revision.translations[0];
    if (!translation?.content_json) throw new NotFoundException("Blog post was not found");
    return {
      ...this.mapPublicSummary(post, locale),
      content: translation.content_json,
      seoTitle: translation.seo_title,
      seoDescription: translation.seo_description,
      coverAltText: translation.cover_alt_text,
      relatedProducts: post.published_revision.related_products.map(({ product }) => ({
        id: product.id,
        title: product.title,
        slug: product.slug,
        startingPrices: this.startingPrices(product)
      })),
      alternateSlugs: Object.fromEntries(
        post.routes.filter((item) => item.is_current).map((item) => [item.locale, item.slug])
      )
    };
  }

  async listPublicTaxonomy(
    kind: "category" | "tag",
    locale: blog_locale,
    slug: string,
    input: ListBlogPostsQueryDto
  ) {
    const term = kind === "category"
      ? await this.prisma.blog_categories.findFirst({
          where: { translations: { some: { locale, slug } } },
          include: { translations: true }
        })
      : await this.prisma.blog_tags.findFirst({
          where: { translations: { some: { locale, slug } } },
          include: { translations: true }
        });
    if (!term) throw new NotFoundException("Blog collection was not found");
    const localized = term.translations.find((translation) => translation.locale === locale);
    if (!localized) throw new NotFoundException("Blog collection was not found");
    const page = await this.listPublic(locale, input, kind === "category"
      ? { categorySlug: slug }
      : { tagSlug: slug });
    return {
      ...page,
      collection: {
        id: term.id,
        kind,
        name: localized.name,
        alternateSlugs: Object.fromEntries(
          term.translations.map((translation) => [translation.locale, translation.slug])
        )
      }
    };
  }

  async listPublicSeller(locale: blog_locale, sellerId: string, input: ListBlogPostsQueryDto) {
    const seller = await this.prisma.sellers.findFirst({
      where: { id: sellerId, approved: true, invited: false, suspended_at: null },
      select: { id: true, shop_name: true }
    });
    if (!seller) throw new NotFoundException("Seller author was not found");
    const page = await this.listPublic(locale, input, { sellerId });
    return {
      ...page,
      collection: {
        id: seller.id,
        kind: "seller" as const,
        name: seller.shop_name,
        alternateSlugs: { fa: seller.id, en: seller.id, ar: seller.id }
      }
    };
  }

  async sitemapProjection() {
    const visiblePost = {
      archived_at: null,
      published_revision_id: { not: null },
      OR: [{ seller_id: null }, { seller: { approved: true, invited: false, suspended_at: null } }]
    } satisfies Prisma.blog_postsWhereInput;
    const [posts, categories, tags, sellers] = await Promise.all([
      this.prisma.blog_routes.findMany({
        where: { is_current: true, post: visiblePost },
        orderBy: { created_at: "asc" },
        select: { locale: true, slug: true, post: { select: { updated_at: true } } }
      }),
      this.prisma.blog_category_translations.findMany({
        where: { category: { revisions: { some: { published_for: { is: visiblePost } } } } },
        orderBy: [{ locale: "asc" }, { slug: "asc" }],
        select: { locale: true, slug: true, category: { select: { updated_at: true } } }
      }),
      this.prisma.blog_tag_translations.findMany({
        where: { tag: { revisions: { some: { revision: { published_for: { is: visiblePost } } } } } },
        orderBy: [{ locale: "asc" }, { slug: "asc" }],
        select: { locale: true, slug: true, tag: { select: { updated_at: true } } }
      }),
      this.prisma.sellers.findMany({
        where: {
          approved: true,
          invited: false,
          suspended_at: null,
          blog_posts: { some: { archived_at: null, published_revision_id: { not: null } } }
        },
        select: {
          id: true,
          blog_posts: {
            where: { archived_at: null, published_revision_id: { not: null } },
            orderBy: { updated_at: "desc" },
            take: 1,
            select: { updated_at: true }
          }
        }
      })
    ]);
    return { posts, categories, tags, sellers };
  }

  async listTaxonomy() {
    const [categories, tags] = await Promise.all([
      this.prisma.blog_categories.findMany({ include: { translations: true }, orderBy: { created_at: "asc" } }),
      this.prisma.blog_tags.findMany({ include: { translations: true }, orderBy: { created_at: "asc" } })
    ]);
    return { categories, tags };
  }

  createTaxonomy(kind: "category" | "tag", input: TaxonomyDto) {
    this.assertAllLocales(input.translations);
    const translations = input.translations.map((item) => ({
      locale: item.locale,
      name: this.clean(item.name),
      slug: this.slugify(item.slug)
    }));
    return kind === "category"
      ? this.prisma.blog_categories.create({ data: { translations: { create: translations } }, include: { translations: true } })
      : this.prisma.blog_tags.create({ data: { translations: { create: translations } }, include: { translations: true } });
  }

  async updateTaxonomy(kind: "category" | "tag", id: string, input: TaxonomyDto) {
    this.assertAllLocales(input.translations);
    const db = kind === "category" ? this.prisma.blog_categories : this.prisma.blog_tags;
    const found = await (db as typeof this.prisma.blog_categories).findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException("Taxonomy term was not found");
    await this.prisma.$transaction(async (tx) => {
      if (kind === "category") {
        await tx.blog_category_translations.deleteMany({ where: { category_id: id } });
        await tx.blog_category_translations.createMany({
          data: input.translations.map((item) => ({ category_id: id, locale: item.locale, name: this.clean(item.name), slug: this.slugify(item.slug) }))
        });
      } else {
        await tx.blog_tag_translations.deleteMany({ where: { tag_id: id } });
        await tx.blog_tag_translations.createMany({
          data: input.translations.map((item) => ({ tag_id: id, locale: item.locale, name: this.clean(item.name), slug: this.slugify(item.slug) }))
        });
      }
    });
    return this.listTaxonomy();
  }

  async deleteTaxonomy(kind: "category" | "tag", id: string) {
    try {
      if (kind === "category") await this.prisma.blog_categories.delete({ where: { id } });
      else await this.prisma.blog_tags.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException("Taxonomy term is in use and cannot be deleted");
      }
      throw error;
    }
  }

  async productOptions(actor: BlogActor, input: ProductOptionsQueryDto) {
    const search = input.search?.normalize("NFKC").trim();
    const products = await this.prisma.products.findMany({
      where: {
        status: "active",
        ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }] } : {}),
        ...(actor.type === "seller"
          ? { listings: { some: { seller_id: actor.sellerId, status: "active" } } }
          : {})
      },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: { id: "asc" },
      select: { id: true, title: true, slug: true }
    });
    const hasMore = products.length > input.limit;
    return {
      items: products.slice(0, input.limit),
      nextCursor: hasMore ? products[input.limit - 1]?.id ?? null : null
    };
  }

  private async transition(
    actor: BlogActor,
    postId: string,
    to: blog_revision_status,
    note: string | null = null
  ) {
    await this.prisma.$transaction(async (tx) => {
      const post = await this.requirePost(actor, postId, tx);
      const revision = post.working_revision;
      if (!revision) throw new ConflictException("Post has no working revision");
      if (to === "pending_review") {
        if (revision.status !== "draft") throw new ConflictException("Only drafts can be submitted");
        this.assertComplete(revision);
      } else if (to === "rejected" && revision.status !== "pending_review") {
        throw new ConflictException("Only pending revisions can be rejected");
      }
      await this.recordTransition(tx, post, actor.user.id, revision.status, to, note);
      await tx.blog_revisions.update({
        where: { id: revision.id },
        data: {
          status: to,
          moderation_note: note,
          moderated_by_id: actor.user.id,
          ...(to === "pending_review" ? { submitted_at: new Date() } : {})
        }
      });
    });
  }

  private recordTransition(
    tx: Prisma.TransactionClient,
    post: ManagedRecord,
    actorUserId: string,
    from: blog_revision_status,
    to: blog_revision_status,
    note: string | null
  ) {
    return tx.blog_moderation_events.create({
      data: {
        post_id: post.id,
        revision_id: post.working_revision!.id,
        actor_id: actorUserId,
        from_status: from,
        to_status: to,
        note
      }
    });
  }

  private async cloneRevision(tx: Prisma.TransactionClient, post: ManagedRecord) {
    const source = post.working_revision;
    if (!source) throw new ConflictException("Post has no working revision");
    const created = await tx.blog_revisions.create({
      data: {
        post_id: post.id,
        revision_number: source.revision_number + 1,
        cover_asset_id: source.cover_asset_id,
        category_id: source.category_id,
        translations: {
          create: source.translations.map((item) => ({
            locale: item.locale,
            title: item.title,
            slug_proposal: item.slug_proposal,
            excerpt: item.excerpt,
            seo_title: item.seo_title,
            seo_description: item.seo_description,
            cover_alt_text: item.cover_alt_text,
            ...(item.content_json !== null ? { content_json: item.content_json } : {})
          }))
        },
        tags: { create: source.tags.map((item) => ({ tag_id: item.tag_id })) },
        related_products: {
          create: source.related_products.map((item) => ({ product_id: item.product_id, position: item.position }))
        }
      },
      include: managedInclude.working_revision.include
    });
    await tx.blog_posts.update({
      where: { id: post.id },
      data: { working_revision_id: created.id, status: post.published_revision_id ? "published" : "draft" }
    });
    return created;
  }

  private async requirePost(actor: BlogActor, postId: string, db: Db = this.prisma) {
    const post = await db.blog_posts.findFirst({
      where: { id: postId, ...this.actorScope(actor) },
      include: managedInclude
    });
    if (!post) throw new NotFoundException("Blog post was not found");
    return post;
  }

  private actorScope(actor: BlogActor): Prisma.blog_postsWhereInput {
    return actor.type === "seller" ? { seller_id: actor.sellerId } : {};
  }

  private normalizeTranslations(input: CreateBlogPostDto["translations"] | UpdateBlogPostDto["translations"]) {
    const byLocale = new Map(input?.map((item) => [item.locale, item]) ?? []);
    if (byLocale.size !== (input?.length ?? 0)) {
      throw new BadRequestException("Each translation locale may appear only once");
    }
    return BLOG_LOCALES.map((locale) => byLocale.get(locale) ?? ({
      locale,
      title: "",
      slug: "",
      excerpt: "",
      seoTitle: "",
      seoDescription: "",
      coverAltText: "",
      content: { type: "doc", content: [] }
    }));
  }

  private assertAllLocales(input: Array<{ locale: blog_locale }>) {
    const locales = new Set(input.map((item) => item.locale));
    if (locales.size !== 3 || BLOG_LOCALES.some((locale) => !locales.has(locale))) {
      throw new BadRequestException("Persian, English, and Arabic translations are required");
    }
  }

  private assertComplete(revision: NonNullable<ManagedRecord["working_revision"]>) {
    this.assertAllLocales(revision.translations);
    if (!revision.cover_asset_id || !revision.category_id) {
      throw new BadRequestException("A cover image and category are required before publishing");
    }
    for (const item of revision.translations) {
      if (
        !item.title?.trim() ||
        !item.slug_proposal?.trim() ||
        !item.excerpt?.trim() ||
        !item.seo_title?.trim() ||
        !item.seo_description?.trim() ||
        !item.cover_alt_text?.trim() ||
        !item.content_json ||
        !hasMeaningfulRichText(item.content_json)
      ) {
        throw new BadRequestException(`The ${item.locale} translation is incomplete`);
      }
    }
  }

  private async requireTaxonomy(categoryId: string | undefined, tagIds: string[]) {
    const [categoryCount, tagCount] = await Promise.all([
      categoryId ? this.prisma.blog_categories.count({ where: { id: categoryId } }) : Promise.resolve(0),
      tagIds.length ? this.prisma.blog_tags.count({ where: { id: { in: tagIds } } }) : Promise.resolve(0)
    ]);
    if (categoryId && categoryCount !== 1) throw new NotFoundException("Blog category was not found");
    if (tagCount !== tagIds.length) throw new NotFoundException("One or more blog tags were not found");
  }

  private async requireProducts(actor: BlogActor, productIds: string[]) {
    if (!productIds.length) return;
    const count = await this.prisma.products.count({
      where: {
        id: { in: productIds },
        status: "active",
        ...(actor.type === "seller"
          ? { listings: { some: { seller_id: actor.sellerId, status: "active" } } }
          : {})
      }
    });
    if (count !== productIds.length) {
      throw new ForbiddenException("One or more related products are unavailable to this author");
    }
  }

  private async requireOwnedMedia(actor: BlogActor, postId: string, mediaIds: string[], coverAssetId?: string) {
    if (!mediaIds.length) return;
    const unique = [...new Set(mediaIds)];
    const assets = await this.prisma.blog_media_assets.findMany({
      where: {
        id: { in: unique },
        ...(actor.type === "seller"
          ? { owner_user_id: actor.user.id }
          : { OR: [{ owner_user_id: actor.user.id }, { post_id: postId }] })
      },
      select: { id: true, kind: true }
    });
    if (assets.length !== unique.length) {
      throw new ForbiddenException("Every draft image must be owned by the current author");
    }
    if (coverAssetId && assets.find((item) => item.id === coverAssetId)?.kind !== "cover") {
      throw new BadRequestException("The cover asset is not a cover image");
    }
  }

  private revisionMediaIds(revision: NonNullable<ManagedRecord["working_revision"]>) {
    const ids = new Set<string>();
    if (revision.cover_asset_id) ids.add(revision.cover_asset_id);
    for (const translation of revision.translations) {
      if (translation.content_json) {
        validateRichText(translation.content_json).mediaIds.forEach((id) => ids.add(id));
      }
    }
    return [...ids];
  }

  private publicInclude(locale: blog_locale, detail = false) {
    return {
      seller: { select: { id: true, shop_name: true, approved: true, invited: true, suspended_at: true } },
      routes: { where: detail ? undefined : { locale, is_current: true }, select: { locale: true, slug: true, is_current: true } },
      published_revision: {
        include: {
          translations: { where: { locale } },
          cover_asset: { include: { variants: true } },
          category: { include: { translations: { where: { locale } } } },
          tags: { include: { tag: { include: { translations: { where: { locale } } } } } },
          related_products: {
            orderBy: { position: "asc" as const },
            include: {
              product: {
                include: {
                  variants: { include: { offers: { where: { status: "active" }, select: { price: true, currency: true } } } }
                }
              }
            }
          }
        }
      }
    } as const;
  }

  private mapManaged(post: ManagedRecord) {
    const revision = post.working_revision;
    if (!revision) throw new ConflictException("Post has no working revision");
    return {
      id: post.id,
      state: revision.status,
      archivedAt: post.archived_at?.toISOString() ?? null,
      seller: post.seller ? { id: post.seller.id, shopName: post.seller.shop_name } : null,
      revision: revision.revision_number,
      optimisticVersion: revision.optimistic_version,
      translations: revision.translations.map((item) => ({
        locale: item.locale,
        title: item.title ?? "",
        slug: item.slug_proposal ?? "",
        excerpt: item.excerpt ?? "",
        seoTitle: item.seo_title ?? "",
        seoDescription: item.seo_description ?? "",
        coverAltText: item.cover_alt_text ?? "",
        content: item.content_json ?? { type: "doc", content: [] }
      })),
      publicSlugs: Object.fromEntries(
        post.routes.map((route) => [route.locale, route.slug])
      ),
      cover: this.mapMedia(revision.cover_asset),
      category: revision.category ? { id: revision.category.id, translations: revision.category.translations } : null,
      tags: revision.tags.map((item) => ({ id: item.tag.id, translations: item.tag.translations })),
      relatedProducts: revision.related_products.map(({ product }) => ({ id: product.id, title: product.title, slug: product.slug, startingPrices: [] })),
      moderationNote: revision.moderation_note,
      publishedAt: post.published_at?.toISOString() ?? null,
      updatedAt: post.updated_at.toISOString()
    };
  }

  private mapPublicSummary(post: Prisma.blog_postsGetPayload<{ include: ReturnType<BlogService["publicInclude"]> }>, locale: blog_locale) {
    const revision = post.published_revision!;
    const translation = revision.translations[0]!;
    const route = post.routes.find((item) => item.locale === locale && item.is_current)!;
    return {
      id: post.id,
      locale,
      title: translation.title,
      slug: route.slug,
      excerpt: translation.excerpt,
      status: "published" as const,
      cover: this.mapMedia(revision.cover_asset),
      author: post.seller
        ? { id: post.seller.id, name: post.seller.shop_name, type: "seller" as const }
        : { id: null, name: "Top GSM Editorial", type: "editorial" as const },
      category: revision.category
        ? { id: revision.category.id, name: revision.category.translations[0]?.name ?? "", slug: revision.category.translations[0]?.slug ?? "" }
        : null,
      tags: revision.tags.map((item) => ({ id: item.tag.id, name: item.tag.translations[0]?.name ?? "", slug: item.tag.translations[0]?.slug ?? "" })),
      publishedAt: post.published_at?.toISOString() ?? null,
      createdAt: post.created_at.toISOString(),
      updatedAt: post.updated_at.toISOString()
    };
  }

  private mapMedia(asset: ManagedRecord["working_revision"] extends infer R ? R extends { cover_asset: infer A } ? A : never : never) {
    if (!asset) return null;
    return {
      id: asset.id,
      kind: asset.kind,
      width: asset.width,
      height: asset.height,
      variants: asset.variants.map((variant) => ({
        name: variant.variant,
        url: `/media/${asset.id}/${variant.variant}.webp`,
        width: variant.width,
        height: variant.height
      }))
    };
  }

  private startingPrices(product: { variants: Array<{ offers: Array<{ price: Prisma.Decimal; currency: string }> }> }) {
    const minimum = new Map<string, Prisma.Decimal>();
    for (const variant of product.variants) {
      for (const offer of variant.offers) {
        const current = minimum.get(offer.currency);
        if (!current || offer.price.lessThan(current)) minimum.set(offer.currency, offer.price);
      }
    }
    return [...minimum.entries()].map(([currency, price]) => ({ currency: currency.trim(), price: price.toString() }));
  }

  private clean(value: string) {
    return value.normalize("NFKC").trim().replace(/\s+/g, " ");
  }

  private slugify(value: string) {
    return value.normalize("NFKC").toLocaleLowerCase("en-US").trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 200);
  }
}
