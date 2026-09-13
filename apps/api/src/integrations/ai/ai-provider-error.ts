import { HttpException } from "@nestjs/common";

export type AiProviderErrorDetails = {
  provider: string;
  statusCode: number | null;
  code: string | null;
  type: string | null;
  requestId: string | null;
  message: string;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown, limit = 4_000): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const redacted = value
    .replace(/(["']?(?:authorization|api[_-]?key|x-api-key)["']?\s*[:=]\s*["']?)([^\s"',}]+)/gi, "$1[REDACTED]")
    .replace(/\bBearer\s+[^\s"',}]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|key)-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]");
  return Array.from(redacted)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32 && code !== 127;
    })
    .join("")
    .slice(0, limit);
}

function finiteStatus(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function parseBody(value: unknown): { raw: string | null; body: UnknownRecord | null } {
  if (typeof value !== "string") return { raw: null, body: record(value) };
  try { return { raw: value, body: record(JSON.parse(value)) }; }
  catch { return { raw: value, body: null }; }
}

export function extractAiProviderError(error: unknown, provider: string): AiProviderErrorDetails {
  const outer = record(error);
  const responseBody = outer?.responseBody;
  const parsed = parseBody(responseBody);
  const bodyError = record(parsed.body?.error);
  const httpResponse = error instanceof HttpException ? error.getResponse() : null;
  const httpBody = record(httpResponse);

  const message = text(bodyError?.message)
    ?? text(parsed.body?.message)
    ?? text(parsed.raw)
    ?? text(httpBody?.message)
    ?? text(typeof httpResponse === "string" ? httpResponse : null)
    ?? text(error instanceof Error ? error.message : null)
    ?? "Unknown provider error";

  return {
    provider,
    statusCode: finiteStatus(outer?.statusCode) ?? (error instanceof HttpException ? error.getStatus() : null),
    code: text(bodyError?.code, 200) ?? text(parsed.body?.code, 200),
    type: text(bodyError?.type, 200) ?? text(parsed.body?.type, 200) ?? text(error instanceof Error ? error.name : null, 200),
    requestId: text(parsed.body?.request_id, 200) ?? text(parsed.body?.requestId, 200),
    message
  };
}
