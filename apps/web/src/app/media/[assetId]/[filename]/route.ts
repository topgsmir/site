import { cookies } from "next/headers";
import { SERVER_API_BASE } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string; filename: string }> }
) {
  const { assetId, filename } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assetId) ||
    filename.length > 85 ||
    !/^[a-z0-9-]{1,80}\.webp$/.test(filename)
  ) {
    return new Response("Not found", { status: 404 });
  }
  const mediaOrigin = SERVER_API_BASE.replace(/\/api$/, "");
  const cookie = (await cookies()).toString();
  const ifNoneMatch = request.headers.get("if-none-match");
  const upstream = await fetch(`${mediaOrigin}/media/${assetId}/${filename}`, {
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(ifNoneMatch && ifNoneMatch.length <= 128 ? { "if-none-match": ifNoneMatch } : {})
    },
    cache: "no-store"
  });
  return new Response(upstream.status === 304 ? null : upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/webp",
      "cache-control": upstream.headers.get("cache-control") ?? "private, no-store",
      "x-content-type-options": "nosniff",
      ...(upstream.headers.get("etag") ? { etag: upstream.headers.get("etag")! } : {})
    }
  });
}
