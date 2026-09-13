import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { PublicUrlService } from "../../common/http/public-url.service";
import { AuthRateLimitService } from "../../modules/auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../../modules/auth/platform-admin.guard";
import { AiProfileController } from "./ai-profile.controller";
import { AiProfileService } from "./ai-profile.service";

describe("AI credential protection", () => {
  const key = Buffer.alloc(32, 11).toString("base64");
  const crypto = new CredentialCryptoService(new ConfigService({ AI_CURRENT_KEY_ID: "ai1", AI_CREDENTIAL_KEYS: `ai1:${key}` }));

  it("uses the independent AI key ring and purpose binding", () => {
    const encrypted = crypto.encrypt("provider-secret", "ai:profile-1:api-key", "AI");
    assert.equal(encrypted.ciphertext.includes("provider-secret"), false);
    assert.equal(crypto.decrypt(encrypted.ciphertext, encrypted.keyId, "ai:profile-1:api-key", "AI"), "provider-secret");
    assert.throws(() => crypto.decrypt(encrypted.ciphertext, encrypted.keyId, "ai:profile-2:api-key", "AI"), /could not be decrypted/i);
  });
});

describe("AI custom endpoint boundaries", () => {
  const urls = new PublicUrlService();

  it("rejects unsafe schemes, credentials, ports, and reserved addresses", async () => {
    await assert.rejects(urls.validate("http://api.example.com"), /public HTTPS/i);
    await assert.rejects(urls.validate("https://key:secret@api.example.com"), /public HTTPS/i);
    await assert.rejects(urls.validate("https://api.example.com:8443"), /public HTTPS/i);
    for (const address of ["127.0.0.1", "10.0.0.1", "192.0.2.1", "198.51.100.1", "203.0.113.1", "[::1]", "[2001:db8::1]"]) {
      await assert.rejects(urls.validate(`https://${address}`), /non-public/i);
    }
  });
});

describe("AI model profile administration", () => {
  it("consumes the dedicated connection-test limit before calling the provider", async () => {
    const events: string[] = [];
    const profiles = {
      test: async () => {
        events.push("provider");
        return { ok: true };
      }
    } as unknown as AiProfileService;
    const limits = {
      consumeAiProfileTest: async () => {
        events.push("rate-limit");
      }
    } as unknown as AuthRateLimitService;
    const controller = new AiProfileController(profiles, limits);
    const request = {
      authenticatedUser: { id: "admin-1" }
    } as AuthenticatedRequest;

    await controller.test(
      request,
      "203.0.113.10",
      "7edbdd26-35b4-4af6-8c67-b21198ca6675"
    );

    assert.deepEqual(events, ["rate-limit", "provider"]);
  });
});
