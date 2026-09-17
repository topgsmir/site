export function currencyLabel(currency: string) {
  return currency === "IRR" ? "تومان" : currency;
}

export function tomanToIrr(amount: string) {
  if (!/^\d+$/.test(amount)) throw new Error("Toman amount must be a non-negative integer");
  return (BigInt(amount) * 10n).toString();
}

export function formatCurrencyAmount(amount: string | number | bigint, currency: string, locale: string) {
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  if (currency !== "IRR") return formatter.format(typeof amount === "string" ? Number(amount) : amount);

  const raw = String(amount).trim();
  if (!/^\d+$/.test(raw)) return formatter.format(Number(raw) / 10);

  const rials = BigInt(raw);
  const tomans = rials / 10n;
  const remainder = rials % 10n;
  if (remainder === 0n) return formatter.format(tomans);

  const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  const fraction = new Intl.NumberFormat(locale, { useGrouping: false }).format(remainder);
  return `${formatter.format(tomans)}${decimal}${fraction}`;
}
