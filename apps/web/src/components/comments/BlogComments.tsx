import type { Locale } from "@/lib/i18n";
import { CommentThread } from "./CommentThread";

export function BlogComments({ postId, locale }: { postId: string; locale: Locale }) {
  return <CommentThread targetType="blog" targetId={postId} locale={locale} />;
}
