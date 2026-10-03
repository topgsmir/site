const PREFIX = "topgsm-marketing:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_FOR_MS = 30 * 24 * 60 * 60 * 1000;

export function rememberMarketingVisit(productId: string, visitId: string) {
  if (!UUID.test(productId) || !UUID.test(visitId)) return;
  try { window.localStorage.setItem(`${PREFIX}${productId}`, JSON.stringify({ visitId, at: Date.now() })); } catch { /* storage may be disabled */ }
}

export function marketingVisitFor(productId: string): string | undefined {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(`${PREFIX}${productId}`) ?? "null");
    if (value && typeof value === "object") {
      const record = value as { visitId?: unknown; at?: unknown };
      if (typeof record.visitId === "string" && UUID.test(record.visitId) && typeof record.at === "number" && Date.now() - record.at < VALID_FOR_MS) return record.visitId;
    }
  } catch { /* storage may be disabled */ }
  return undefined;
}
