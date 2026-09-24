export function currencyLabel(currency: string) {
  return currency === "TOMAN" ? "تومان" : currency;
}

/** Keep decimal currency amounts exact when displaying an order quantity. */
export function multiplyCurrencyAmount(amount: string, quantity: number): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match || !Number.isSafeInteger(quantity) || quantity < 0) throw new Error("Invalid currency amount or quantity");
  const fraction = match[2] ?? "";
  const units = BigInt(`${match[1]}${fraction}`) * BigInt(quantity);
  if (!fraction.length) return units.toString();
  const padded = units.toString().padStart(fraction.length + 1, "0");
  const decimals = padded.slice(-fraction.length).replace(/0+$/, "");
  return `${padded.slice(0, -fraction.length)}${decimals ? `.${decimals}` : ""}`;
}

export function formatCurrencyAmount(amount: string | number | bigint, _currency: string, locale: string) {
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 5 });
  if (typeof amount !== "string") return formatter.format(amount);
  const match = /^(-?\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) return formatter.format(Number(amount));
  const whole = formatter.format(BigInt(match[1]!));
  const fraction = match[2]?.slice(0, 5).replace(/0+$/, "");
  if (!fraction) return whole;
  const decimal = formatter.formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  const digits = new Intl.NumberFormat(locale, { useGrouping: false });
  return `${whole}${decimal}${[...fraction].map((digit) => digits.format(Number(digit))).join("")}`;
}
