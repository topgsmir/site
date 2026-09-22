import type { Locale } from "@/lib/i18n";
import { CommentThread } from "./CommentThread";

export function ProductComments({ productId, locale }: { productId: string; locale: Locale }) {
  return <CommentThread targetType="product" targetId={productId} locale={locale} />;
}
