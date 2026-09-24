import { BadGatewayException } from "@nestjs/common";

export async function readBoundedJsonResponse(response: Response, maxBytes = 256 * 1024): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    throw new BadGatewayException("Provider response is too large");
  }
  if (!response.body) throw new BadGatewayException("Provider response body is missing");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new BadGatewayException("Provider response is too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof BadGatewayException) throw error;
    throw new BadGatewayException("Provider returned malformed JSON");
  }
}
