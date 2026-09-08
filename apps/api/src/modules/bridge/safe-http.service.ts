import {
  BadGatewayException,
  Injectable,
  RequestTimeoutException
} from "@nestjs/common";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import { PublicUrlService } from "./public-url.service";

@Injectable()
export class SafeHttpService {
  constructor(private readonly publicUrls: PublicUrlService) {}

  async request(
    baseUrl: string,
    path: string,
    init: RequestInit,
    timeoutMs = 12_000
  ) {
    const approved = await this.publicUrls.validate(baseUrl);
    const target = new URL(path, `${approved.url.toString()}/`);
    if (target.origin !== approved.url.origin) {
      throw new BadGatewayException("Provider path escaped its origin");
    }
    await this.publicUrls.assertStillPublic(approved.url, approved.addresses);
    const pinnedAddress = [...approved.addresses][0];
    if (!pinnedAddress) {
      throw new BadGatewayException("Provider has no public address");
    }
    const body = init.body instanceof URLSearchParams
      ? Buffer.from(init.body.toString(), "utf8")
      : typeof init.body === "string"
        ? Buffer.from(init.body, "utf8")
        : init.body === undefined || init.body === null
          ? undefined
          : (() => {
              throw new BadGatewayException("Unsupported provider request body");
            })();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Accept-Encoding", "identity");
    if (body) headers.set("Content-Length", String(body.length));

    return new Promise<unknown>((resolve, reject) => {
      const lookup: LookupFunction = (_hostname, _options, callback) => {
        callback(null, pinnedAddress, pinnedAddress.includes(":") ? 6 : 4);
      };
      const request = httpsRequest(
        target,
        {
          method: init.method ?? "GET",
          headers: Object.fromEntries(headers.entries()),
          timeout: timeoutMs,
          lookup,
          servername: target.hostname
        },
        (response) => {
          const chunks: Buffer[] = [];
          let length = 0;
          response.on("data", (chunk: Buffer) => {
            length += chunk.length;
            if (length > 2_000_000) {
              request.destroy(new Error("response_too_large"));
            } else {
              chunks.push(chunk);
            }
          });
          response.on("end", () => {
            const status = response.statusCode ?? 0;
            if (status < 200 || status >= 300) {
              reject(new BadGatewayException(`Provider returned HTTP ${status}`));
              return;
            }
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
            } catch {
              reject(new BadGatewayException("Provider returned malformed JSON"));
            }
          });
        }
      );
      request.on("timeout", () => request.destroy(new Error("request_timeout")));
      request.on("error", (error) => {
        if (error.message === "request_timeout") {
          reject(new RequestTimeoutException("Provider request timed out"));
        } else if (error.message === "response_too_large") {
          reject(new BadGatewayException("Provider response is too large"));
        } else {
          reject(new BadGatewayException("Provider request failed"));
        }
      });
      if (body) request.write(body);
      request.end();
    });
  }
}
