// Compatibility for existing projection consumers. New sitemap routes use the
// count/feed API and retain only one partition, not this complete response.
export async function legacySitemapRows<T>(read: (cursor?: string) => Promise<T[]>, key: (row: T) => string): Promise<T[]> {
  const result: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const rows = await read(cursor);
    result.push(...rows);
    if (rows.length < 1000) return result;
    const next = key(rows.at(-1)!);
    if (next === cursor) throw new Error("Sitemap cursor did not advance");
    cursor = next;
  }
}
