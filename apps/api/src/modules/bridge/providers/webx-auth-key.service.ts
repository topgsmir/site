import { Injectable } from "@nestjs/common";
import { hash } from "bcryptjs";
import type { BridgeCredentials } from "../bridge.types";

@Injectable()
export class WebxAuthKeyService {
  create(credentials: Pick<BridgeCredentials, "username" | "apiKey">): Promise<string> {
    return hash(`${credentials.username}${credentials.apiKey}`, 10);
  }
}
