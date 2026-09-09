import { isLocale } from "@/lib/i18n";
import { rssFeed } from "@/lib/feed";

export async function GET(_: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  return new Response(await rssFeed(locale), {
    headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" }
  });
}
