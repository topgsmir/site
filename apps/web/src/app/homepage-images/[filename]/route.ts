import { SERVER_API_BASE } from "@/lib/api/server";

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/.test(filename)) return new Response(null, { status: 404 });
  try {
    const response = await fetch(`${SERVER_API_BASE}/homepage/images/${filename.slice(0, -5)}`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/webp")) return new Response(null, { status: response.status === 404 ? 404 : 502 });
    return new Response(response.body, { headers: { "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch { return new Response(null, { status: 502 }); }
}
