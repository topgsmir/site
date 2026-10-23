/** Parse a public order number without rounding bigint values or accepting UUIDs. */
export function parseOrderNumber(value: string): bigint | null {
  const ascii = value.trim().replace(/^#/, "").replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
  if (!/^[0-9]{1,19}$/.test(ascii)) return null;
  const number = BigInt(ascii);
  return number > 0n && number <= 9_223_372_036_854_775_807n ? number : null;
}
