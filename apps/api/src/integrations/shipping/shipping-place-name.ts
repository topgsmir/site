export function normalizeShippingPlace(value: string) {
  return value.normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200f\u202a-\u202e]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:استان|شهر)\s+/u, "")
    .toLocaleLowerCase("fa");
}
