import { BadRequestException, Injectable } from "@nestjs/common";
import type { bridge_provider } from "../../prisma/client";
import { DhruLegacyAdapter } from "./providers/dhru-legacy.adapter";
import { DhruNewAdapter } from "./providers/dhru-new.adapter";
import { WebxAdapter } from "./providers/webx.adapter";

@Injectable()
export class BridgeProviderService {
  constructor(
    private readonly legacy: DhruLegacyAdapter,
    private readonly modern: DhruNewAdapter,
    private readonly webx: WebxAdapter
  ) {}

  get(provider: bridge_provider) {
    if (provider === "dhru_legacy") return this.legacy;
    if (provider === "dhru_new") return this.modern;
    if (provider === "webx") return this.webx;
    throw new BadRequestException("Unsupported Bridge provider");
  }
}

