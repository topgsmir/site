import { isLocale } from "@/lib/i18n";
import { atomFeed } from "@/lib/feed";

export async function GET(_: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  return new Response(await atomFeed(locale), {
    headers: { "content-type": "application/atom+xml; charset=utf-8", "cache-control": "public, max-age=300" }
  });
}
