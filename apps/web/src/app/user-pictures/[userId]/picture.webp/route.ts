import { SERVER_API_BASE } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return new Response("Not found", { status: 404 });
  }
  const ifNoneMatch = request.headers.get("if-none-match");
  const mediaOrigin = SERVER_API_BASE.replace(/\/api$/, "");
  const upstream = await fetch(`${mediaOrigin}/user-pictures/${userId}/picture.webp`, {
    headers: { ...(ifNoneMatch && ifNoneMatch.length <= 128 ? { "if-none-match": ifNoneMatch } : {}) },
    cache: "no-store"
  });
  return new Response(upstream.status === 304 ? null : upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/webp",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...(upstream.headers.get("etag") ? { etag: upstream.headers.get("etag")! } : {})
    }
  });
}
