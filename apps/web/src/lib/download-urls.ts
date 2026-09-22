export function splitDownloadUrls(value: string): string[] {
  return value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
}

export function validDownloadUrls(value: string): boolean {
  const urls = splitDownloadUrls(value);
  return urls.length > 0 && urls.length <= 50 && new Set(urls).size === urls.length && urls.every((url) => {
    try { return url.length <= 2048 && new URL(url).protocol === "https:"; } catch { return false; }
  });
}
