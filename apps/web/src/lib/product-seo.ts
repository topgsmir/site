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
