export function currencyLabel(currency: string) {
  return currency === "TOMAN" ? "تومان" : currency;
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
