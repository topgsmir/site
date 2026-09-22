import type { Prisma, blog_locale } from "../../prisma/client";

export function publicBlogWhere(locale?: blog_locale): Prisma.blog_postsWhereInput {
  return {
    archived_at: null,
    published_revision_id: { not: null },
    OR: [{ seller_id: null }, { seller: { approved: true, invited: false, suspended_at: null } }],
    ...(locale ? { published_revision: { translations: { some: { locale } } } } : {})
  };
}
