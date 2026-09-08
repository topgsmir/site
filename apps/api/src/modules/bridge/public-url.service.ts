import { BadRequestException, Injectable } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

@Injectable()
export class PublicUrlService {
  async validate(rawUrl: string) {
    let url: URL;
    try {
      url = new URL(rawUrl.trim());
    } catch {
      throw new BadRequestException("Provider URL is invalid");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") {
      throw new BadRequestException("Provider URL must be public HTTPS without credentials or a custom port");
    }
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => this.isPrivate(address))) {
      throw new BadRequestException("Provider URL resolves to a non-public address");
    }
    return { url, addresses: new Set(addresses.map(({ address }) => address)) };
  }

  async assertStillPublic(url: URL, approvedAddresses: Set<string>) {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (
      !addresses.length ||
      addresses.some(({ address }) => this.isPrivate(address) || !approvedAddresses.has(address))
    ) {
      throw new BadRequestException("Provider DNS changed during the request");
    }
  }

  private isPrivate(address: string) {
    if (!isIP(address)) return true;
    const normalized = address.toLowerCase();
    if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    const ipv4 = mapped ?? (isIP(normalized) === 4 ? normalized : null);
    if (!ipv4) return false;
    const [a, b] = ipv4.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
}

