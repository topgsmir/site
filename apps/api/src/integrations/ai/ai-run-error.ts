import { HttpException } from "@nestjs/common";

// Only allowlisted categories and numeric HTTP status leave this boundary.
// Provider messages/bodies can contain prompts, credentials, or private data.
export function classifyAiRunError(error: unknown): { code: string; statusCode: number | null } {
  let current = error;
  let statusCode: number | null = null;
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 8 && current && typeof current === "object" && !seen.has(current); depth++) {
    seen.add(current);
    const item = current as { name?: unknown; statusCode?: unknown; cause?: unknown };
    const status = current instanceof HttpException ? current.getStatus() : item.statusCode;
    if (typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599) statusCode = status;
    if (item.name === "TimeoutError" || status === 408 || status === 504) return { code: "AI_TIMEOUT", statusCode };
    current = item.cause;
  }
  if (statusCode === 401 || statusCode === 403) return { code: "AI_PROVIDER_AUTH", statusCode };
  if (statusCode === 429) return { code: "AI_RATE_LIMITED", statusCode };
  if (statusCode !== null && statusCode >= 500) return { code: "AI_PROVIDER_UNAVAILABLE", statusCode };
  if (statusCode !== null) return { code: "AI_PROVIDER_REJECTED", statusCode };
  return { code: "AI_RUN_FAILED", statusCode };
}
