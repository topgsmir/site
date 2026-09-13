import { BadGatewayException, Injectable, RequestTimeoutException } from "@nestjs/common";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import { PublicUrlService } from "./public-url.service";

@Injectable()
export class SafeFetchService {
  constructor(private readonly publicUrls: PublicUrlService) {}

  readonly fetch: typeof fetch = async (input, init = {}) => {
    const target = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const approved = await this.publicUrls.validate(target.origin);
    if (target.origin !== approved.url.origin) throw new BadGatewayException("Provider request escaped its approved origin");
    await this.publicUrls.assertStillPublic(approved.url, approved.addresses);
    const pinnedAddress = [...approved.addresses][0];
    if (!pinnedAddress) throw new BadGatewayException("Provider has no public address");
    const body = typeof init.body === "string" ? Buffer.from(init.body, "utf8") : init.body == null ? undefined : (() => { throw new BadGatewayException("Unsupported provider request body"); })();
    if (body && body.length > 1_000_000) throw new BadGatewayException("Provider request is too large");
    const headers = new Headers(init.headers);
    headers.set("Accept-Encoding", "identity");
    if (body) headers.set("Content-Length", String(body.length));
    return new Promise<Response>((resolve, reject) => {
      let settled = false;
      let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
      const lookup: LookupFunction = (_hostname, _options, callback) => callback(null, pinnedAddress, pinnedAddress.includes(":") ? 6 : 4);
      const request = httpsRequest(target, { method: init.method ?? "GET", headers: Object.fromEntries(headers.entries()), timeout: 30_000, lookup, servername: target.hostname, family: pinnedAddress.includes(":") ? 6 : 4 }, (response) => {
        let length = 0;
        const bodyStream = new ReadableStream<Uint8Array>({
          start(controller) {
            streamController = controller;
            response.on("data", (chunk: Buffer) => { length += chunk.length; if (length > 4_000_000) request.destroy(new Error("response_too_large")); else controller.enqueue(chunk); });
            response.on("end", () => controller.close());
            response.on("error", (error) => controller.error(error));
          },
          cancel() { response.destroy(); }
        });
        settled = true;
        resolve(new Response(bodyStream, { status: response.statusCode ?? 502, headers: response.headers as HeadersInit }));
      });
      request.on("timeout", () => request.destroy(new Error("request_timeout")));
      request.on("error", (error) => { const safeError = error.message === "request_timeout" ? new RequestTimeoutException("Provider request timed out") : new BadGatewayException(error.message === "response_too_large" ? "Provider response is too large" : "Provider request failed"); if (settled) streamController?.error(safeError); else reject(safeError); });
      init.signal?.addEventListener("abort", () => request.destroy(new Error("request_aborted")), { once: true });
      if (body) request.write(body);
      request.end();
    });
  };
}
