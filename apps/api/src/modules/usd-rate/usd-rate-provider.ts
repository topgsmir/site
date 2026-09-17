import type { UsdRateProviderId } from "@topgsm/shared-types";

const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export interface UsdRateProvider {
  readonly id: UsdRateProviderId;
  readonly name: string;
  readonly sourceUrl: string;
  fetchUsdSellRateToman(): Promise<string>;
}

export class UsdRateFetchError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function latinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export async function fetchBoundedText(
  url: string,
  accept: string,
  allowedContentTypes: readonly string[],
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  timeout.unref();

  try {
    const response = await fetch(url, {
      headers: {
        Accept: accept,
        "User-Agent": "TopGSM-ExchangeRate/1.0 (+https://topgsm.ir)"
      },
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) throw new UsdRateFetchError(`SOURCE_HTTP_${response.status}`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!allowedContentTypes.some((allowed) => contentType.includes(allowed))) {
      throw new UsdRateFetchError("SOURCE_CONTENT_TYPE_INVALID");
    }

    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > maxResponseBytes) throw new UsdRateFetchError("SOURCE_RESPONSE_TOO_LARGE");
    if (!response.body) throw new UsdRateFetchError("SOURCE_BODY_MISSING");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let body = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResponseBytes) {
        await reader.cancel();
        throw new UsdRateFetchError("SOURCE_RESPONSE_TOO_LARGE");
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } catch (error) {
    if (error instanceof UsdRateFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new UsdRateFetchError("SOURCE_TIMEOUT");
    throw new UsdRateFetchError("SOURCE_FETCH_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}
