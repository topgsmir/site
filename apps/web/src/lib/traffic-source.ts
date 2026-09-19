const STORAGE_KEY = "topgsm-traffic-source";
const SOURCE_PATTERN = /^[a-z0-9][a-z0-9._ -]{0,99}$/;

function arrivingSource(): string {
  const tagged = new URLSearchParams(window.location.search).get("utm_source")?.trim().toLowerCase();
  if (tagged && SOURCE_PATTERN.test(tagged)) return tagged;

  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin !== window.location.origin && (referrer.protocol === "https:" || referrer.protocol === "http:")) {
        const host = referrer.hostname.toLowerCase().replace(/^www\./, "");
        if (/^google\.[a-z.]+$/.test(host)) return "google";
        if (/^bing\.[a-z.]+$/.test(host)) return "bing";
        if (SOURCE_PATTERN.test(host)) return host;
      }
    } catch { /* Ignore malformed browser referrers. */ }
  }
  return "direct";
}

export function getTrafficSource(): string {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && SOURCE_PATTERN.test(stored)) return stored;
    const source = arrivingSource();
    sessionStorage.setItem(STORAGE_KEY, source);
    return source;
  } catch {
    return arrivingSource();
  }
}
