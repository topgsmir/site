import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

@Injectable()
export class CredentialCryptoService {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: string, purpose: string) {
    const { id, key } = this.currentKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(purpose, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return {
      keyId: id,
      ciphertext: ["v1", iv, cipher.getAuthTag(), ciphertext]
        .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
        .join(".")
    };
  }

  decrypt(payload: string, keyId: string, purpose: string) {
    const key = this.keys().get(keyId);
    if (!key) throw new ServiceUnavailableException("Credential encryption key is unavailable");
    const [version, encodedIv, encodedTag, encodedValue] = payload.split(".");
    if (version !== "v1" || !encodedIv || !encodedTag || !encodedValue) {
      throw new ServiceUnavailableException("Encrypted credential is invalid");
    }
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(encodedIv, "base64url"));
      decipher.setAAD(Buffer.from(purpose, "utf8"));
      decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(encodedValue, "base64url")),
        decipher.final()
      ]).toString("utf8");
    } catch {
      throw new ServiceUnavailableException("Encrypted credential could not be decrypted");
    }
  }

  private currentKey() {
    const id = this.config.get<string>("BRIDGE_CURRENT_KEY_ID")?.trim();
    const key = id ? this.keys().get(id) : undefined;
    if (!id || !key) {
      throw new ServiceUnavailableException("Bridge credential encryption is not configured");
    }
    return { id, key };
  }

  private keys() {
    const result = new Map<string, Buffer>();
    for (const item of (this.config.get<string>("BRIDGE_CREDENTIAL_KEYS") ?? "").split(",")) {
      const separator = item.indexOf(":");
      if (separator < 1) continue;
      const id = item.slice(0, separator).trim();
      const key = Buffer.from(item.slice(separator + 1).trim(), "base64");
      if (/^[A-Za-z0-9_-]{1,32}$/.test(id) && key.length === 32) result.set(id, key);
    }
    return result;
  }
}

