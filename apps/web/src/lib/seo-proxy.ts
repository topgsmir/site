import type { SeoConfiguration } from "@topgsm/shared-types";

// Read-only cache: settings remain durable in PostgreSQL. Bound staleness to 60s,
// coalesce refreshes, and never turn a failed read into permissive defaults.
let cached: { value: SeoConfiguration; expires: number } | undefined;
let pending: Promise<SeoConfiguration> | undefined;
export async function proxySeoConfiguration(): Promise<SeoConfiguration> {
  if (cached && cached.expires > Date.now()) return cached.value;
  if (!pending) pending = (async () => {
    const base = (process.env.API_URL ?? "http://127.0.0.1:4000/api").replace(/\/+$/, "");
    const response = await fetch(`${base}/seo/configuration`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error("SEO configuration unavailable");
    const value = await response.json() as SeoConfiguration;
    cached = { value, expires: Date.now() + 60_000 };
    return value;
  })().finally(() => { pending = undefined; });
  return pending;
}
