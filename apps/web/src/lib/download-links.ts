export type DownloadLink = { url: string; title: string };

export function validDownloadLinks(links: DownloadLink[]): boolean {
  if (links.length < 1 || links.length > 50) return false;
  const urls = links.map((link) => link.url.trim());
  return new Set(urls).size === urls.length && links.every((link, index) => {
    const title = link.title.trim();
    try {
      const url = new URL(urls[index]);
      return urls[index].length <= 2048 && url.protocol === "https:" && Boolean(url.hostname)
        && title.length > 0 && title.length <= 120;
    } catch { return false; }
  });
}
