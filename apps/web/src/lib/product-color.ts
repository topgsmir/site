/** Detect colour-named product options and map common colour labels to swatch hex. */

const COLOR_OPTION_NAMES = /^(رنگ|لون|لون اللون|color|colour)$/i;

const COLOR_SWATCHES: Array<{ match: RegExp; hex: string; ink?: "light" | "dark" }> = [
  { match: /کله\s*غازی| سبز کله|teal|فیروزه/i, hex: "#0f5c4c", ink: "light" },
  { match: /سبز|green|اخضر/i, hex: "#1f7a3a", ink: "light" },
  { match: /آبی\s*تیره|navy|سرمه‌ای|سرمه/i, hex: "#0b3a66", ink: "light" },
  { match: /آبی|blue|ازرق/i, hex: "#1f6feb", ink: "light" },
  { match: /قرمز|red|احمر/i, hex: "#c62828", ink: "light" },
  { match: /صورتی|pink|وردي/i, hex: "#db5a8c", ink: "light" },
  { match: /بنفش|purple|violet|بنفسج/i, hex: "#6a3bb5", ink: "light" },
  { match: /نارنجی|orange|برتقالي/i, hex: "#e67e22", ink: "dark" },
  { match: /زرد|yellow|اصفر/i, hex: "#e6c200", ink: "dark" },
  { match: /قهوه‌?ای|brown|بني/i, hex: "#6b3f2a", ink: "light" },
  { match: /طلایی|gold|ذهبي/i, hex: "#c9a227", ink: "dark" },
  { match: /نقره‌?ای|silver|فضي/i, hex: "#a8b0b8", ink: "dark" },
  { match: /طوسی|خاکستری|grey|gray|رمادي/i, hex: "#6e7681", ink: "light" },
  { match: /کرم|cream|beige|بژ/i, hex: "#e8d9c0", ink: "dark" },
  { match: /سفید|white|ابيض/i, hex: "#f4f6f8", ink: "dark" },
  { match: /مشکی|سیاه|black|اسود/i, hex: "#1a1d21", ink: "light" }
];

export function isColorOptionName(name: string) {
  return COLOR_OPTION_NAMES.test(name.trim());
}

export function resolveColorSwatch(label: string): { hex: string; ink: "light" | "dark" } {
  const trimmed = label.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    const hex = trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed;
    return { hex, ink: luminance(hex) > 0.62 ? "dark" : "light" };
  }
  for (const entry of COLOR_SWATCHES) {
    if (entry.match.test(trimmed)) {
      return { hex: entry.hex, ink: entry.ink ?? (luminance(entry.hex) > 0.62 ? "dark" : "light") };
    }
  }
  const hash = [...trimmed].reduce((sum, char) => sum + char.charCodeAt(0) * 17, 0);
  const hue = hash % 360;
  const hex = hslToHex(hue, 42, 42);
  return { hex, ink: "light" };
}

function luminance(hex: string) {
  const raw = hex.replace("#", "");
  const value = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw;
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hslToHex(h: number, s: number, l: number) {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
