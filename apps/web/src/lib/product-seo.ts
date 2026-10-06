/** Schema.org requires ISO 4217. Convert toman to rial without floating-point rounding. */
export function schemaPrice(price: string, currency: string) {
  if (currency !== "TOMAN") return { price, priceCurrency: currency };
  const match = /^(\d+)(?:\.(\d+))?$/.exec(price);
  if (!match) throw new Error("Invalid product price");
  const fraction = match[2] ?? "";
  const whole = BigInt(match[1]!) * 10n + BigInt(fraction[0] ?? "0");
  const remainder = fraction.slice(1).replace(/0+$/, "");
  return { price: `${whole}${remainder ? `.${remainder}` : ""}`, priceCurrency: "IRR" };
}

/** The first paragraph is the product summary and its default search description. */
export function productSummary(descriptionText: string): string {
  const firstParagraph = descriptionText.split(/\n+/u).map((part) => part.replace(/\s+/gu, " ").trim()).find(Boolean) ?? "";
  const characters = Array.from(firstParagraph);
  return characters.length > 158 ? `${characters.slice(0, 157).join("").trimEnd()}…` : firstParagraph;
}
