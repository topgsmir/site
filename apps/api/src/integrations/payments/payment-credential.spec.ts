import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { PaymentCredentialService } from "./payment-credential.service";

describe("PaymentCredentialService", () => {
  const key = Buffer.alloc(32, 19).toString("base64");
  const crypto = new CredentialCryptoService(new ConfigService({
    PAYMENT_CURRENT_KEY_ID: "payment1",
    PAYMENT_CREDENTIAL_KEYS: `payment1:${key}`
  }));

  it("encrypts provider credentials and returns only safe configuration metadata", async () => {
    const prisma = {
      payment_method_configs: { findUnique: async () => null }
    } as unknown as PrismaService;
    const service = new PaymentCredentialService(prisma, crypto);

    const prepared = await service.prepareUpdate("zarinpal", {
      merchantId: "merchant-12345678",
      callbackUrl: "https://api.example.com/api/payments/zarinpal/callback",
      refundAccessToken: "refund-secret-87654321"
    });

    assert.equal("encrypted_credentials" in prepared.data, true);
    const ciphertext = "encrypted_credentials" in prepared.data
      ? prepared.data.encrypted_credentials
      : undefined;
    assert.equal(typeof ciphertext, "string");
    assert.equal(ciphertext?.includes("merchant-12345678"), false);
    assert.equal(ciphertext?.includes("refund-secret-87654321"), false);
    assert.deepEqual(prepared.configuration, {
      merchantIdConfigured: true,
      merchantIdHint: "5678",
      callbackUrlConfigured: true,
      refundAccessTokenConfigured: true,
      refundAccessTokenHint: "4321"
    });
    assert.throws(
      () => crypto.decrypt(ciphertext!, "payment1", "payment:another-provider:credentials", "PAYMENT"),
      /could not be decrypted/i
    );
  });
});
