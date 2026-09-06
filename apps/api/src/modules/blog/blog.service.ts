import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateBlogPostDto,
  ListBlogPostsQueryDto
} from "./dto/blog-post.dto";

const relatedProductSelect = {
  id: true,
  title: true,
  slug: true
} as const;

const blogSummarySelect = Prisma.validator<Prisma.blog_postsSelect>()({
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  status: true,
  published_at: true,
  created_at: true,
  updated_at: true,
  product: { select: relatedProductSelect }
});

type BlogSummaryRecord = Prisma.blog_postsGetPayload<{
  select: typeof blogSummarySelect;
}>;

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(input: ListBlogPostsQueryDto) {
    const rows = await this.prisma.blog_posts.findMany({
      where: {
        status: "published",
        published_at: { not: null },
        seller: { invited: false, approved: true, suspended_at: null }
      },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ published_at: "desc" }, { id: "desc" }],
      select: blogSummarySelect
    });

    return this.toPage(rows, input.limit);
  }

  async getPublic(slug: string) {
    if (!slug || slug.length > 200) {
      throw new NotFoundException("Blog post was not found");
    }

    const post = await this.prisma.blog_posts.findFirst({
      where: {
        slug,
        status: "published",
        published_at: { not: null },
        seller: { invited: false, approved: true, suspended_at: null }
      },
      select: {
        ...blogSummarySelect,
        content: true,
        seller: { select: { id: true, shop_name: true } }
      }
    });
    if (!post) throw new NotFoundException("Blog post was not found");

    return {
      ...this.toSummary(post),
      content: post.content,
      author: { id: post.seller.id, shopName: post.seller.shop_name }
    };
  }

  async listMine(sellerId: string, input: ListBlogPostsQueryDto) {
    const rows = await this.prisma.blog_posts.findMany({
      where: { seller_id: sellerId },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      select: blogSummarySelect
    });

    return this.toPage(rows, input.limit);
  }

  async create(sellerId: string, input: CreateBlogPostDto) {
    if (input.relatedProductId) {
      const listing = await this.prisma.seller_listings.findFirst({
        where: { seller_id: sellerId, product_id: input.relatedProductId },
        select: { id: true }
      });
      if (!listing) {
        throw new NotFoundException("Related seller product was not found");
      }
    }

    const id = randomUUID();
    const title = this.cleanLine(input.title);
    const slug = input.slug
      ? this.slugify(input.slug)
      : `${this.slugify(title) || "post"}-${id.slice(0, 8)}`;

    try {
      const post = await this.prisma.blog_posts.create({
        data: {
          id,
          seller_id: sellerId,
          product_id: input.relatedProductId,
          title,
          slug,
          excerpt: this.cleanOptional(input.excerpt),
          content: input.content.normalize("NFKC").trim(),
          status: input.status,
          published_at: input.status === "published" ? new Date() : null
        },
        select: blogSummarySelect
      });
      return this.toSummary(post);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A blog post already uses this slug");
      }
      throw error;
    }
  }

  private toPage(rows: BlogSummaryRecord[], limit: number) {
    const hasMore = rows.length > limit;
    const visible = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: visible.map((post) => this.toSummary(post)),
      nextCursor: hasMore ? visible[visible.length - 1].id : null
    };
  }

  private toSummary(post: BlogSummaryRecord) {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      status: post.status,
      relatedProduct: post.product,
      publishedAt: post.published_at?.toISOString() ?? null,
      createdAt: post.created_at.toISOString(),
      updatedAt: post.updated_at.toISOString()
    };
  }

  private cleanLine(value: string) {
    return value.normalize("NFKC").trim().replace(/\s+/g, " ");
  }

  private cleanOptional(value: string | undefined) {
    if (value === undefined) return null;
    const cleaned = value.normalize("NFKC").trim();
    return cleaned || null;
  }

  private slugify(value: string) {
    return value
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 200);
  }
}
