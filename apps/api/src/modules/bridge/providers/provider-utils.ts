import { BadGatewayException } from "@nestjs/common";
import type { BridgeFieldDefinition, BridgeServiceKind } from "@topgsm/shared-types";

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadGatewayException("Provider response has an unexpected shape");
  }
  return value as Record<string, unknown>;
}

export function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

export function string(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export function field(
  raw: Record<string, unknown>,
  fallbackRequired = false
): BridgeFieldDefinition | null {
  const key = string(raw.key ?? raw.name ?? raw.fieldname).slice(0, 100);
  if (!key || key.toLowerCase() === "quantity") return null;
  const providerType = string(raw.type ?? raw.fieldtype).toLowerCase();
  const type = providerType === "dropdown" || providerType === "select" ? "select" :
    providerType === "textarea" ? "textarea" : providerType === "number" ? "number" : "text";
  const optionSource = raw.options ?? raw.fieldoptions;
  const options = (Array.isArray(optionSource) ? optionSource : string(optionSource).split(","))
    .map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const option = item as Record<string, unknown>;
        const value = string(option.value ?? option.id ?? option.key);
        return value ? { value, label: string(option.label ?? option.name ?? value).slice(0, 160) } : null;
      }
      const value = string(item);
      return value ? { value, label: value } : null;
    })
    .filter((item): item is { value: string; label: string } => Boolean(item))
    .slice(0, 200);
  return {
    key,
    type,
    required: raw.required === true || string(raw.required).toLowerCase() === "on" || fallbackRequired,
    label: string(raw.label ?? raw.title ?? key).slice(0, 160) || key,
    maximumLength: Math.min(Number(raw.maxlength ?? raw.maximumLength) || 5000, 5000),
    ...(type === "select" ? { options } : {})
  };
}

export function kindFrom(value: unknown): BridgeServiceKind {
  const normalized = string(value).toLowerCase();
  return normalized.includes("file") ? "file" : normalized.includes("server") ? "server" : "imei";
}

export function xml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;"
  })[character]!);
}
