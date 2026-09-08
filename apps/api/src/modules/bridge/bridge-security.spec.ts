import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { CredentialCryptoService } from "./credential-crypto.service";
import { PublicUrlService } from "./public-url.service";
import { normalizeIranianPhone } from "../sms/phone-number";
import { LocalGatewayAdapter } from "../../integrations/payments/providers/local-gateway/local-gateway.adapter";
import { PaymentService } from "../../integrations/payments/payment.service";

describe("Bridge credential protection", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const crypto = new CredentialCryptoService(new ConfigService({ BRIDGE_CURRENT_KEY_ID: "k1", BRIDGE_CREDENTIAL_KEYS: `k1:${key}` }));
  it("round-trips authenticated ciphertext without exposing plaintext", () => {
    const value = crypto.encrypt("seller-secret", "connection:one");
    assert.equal(value.keyId, "k1");
    assert.equal(value.ciphertext.includes("seller-secret"), false);
    assert.equal(crypto.decrypt(value.ciphertext, value.keyId, "connection:one"), "seller-secret");
  });
  it("binds ciphertext to its purpose", () => {
    const value = crypto.encrypt("seller-secret", "connection:one");
    assert.throws(() => crypto.decrypt(value.ciphertext, value.keyId, "connection:two"), /could not be decrypted/i);
  });
});

describe("Bridge network boundaries", () => {
  const urls = new PublicUrlService();
  it("rejects non-HTTPS, embedded credentials, ports, and loopback", async () => {
    await assert.rejects(urls.validate("http://example.com"), /public HTTPS/i);
    await assert.rejects(urls.validate("https://user:pass@example.com"), /public HTTPS/i);
    await assert.rejects(urls.validate("https://example.com:8443"), /public HTTPS/i);
    await assert.rejects(urls.validate("https://127.0.0.1"), /non-public/i);
  });
});

describe("checkout identities and gateways", () => {
  it("normalizes equivalent Iranian mobile forms", () => {
    for (const input of ["09121234567", "+989121234567", "00989121234567", "989121234567"]) assert.equal(normalizeIranianPhone(input), "+989121234567");
    assert.throws(() => normalizeIranianPhone("02112345678"), /invalid/i);
  });
  it("fails closed for unknown providers and production local payments", async () => {
    const local = new LocalGatewayAdapter(new ConfigService({ NODE_ENV: "production" }));
    const misconfigured = new LocalGatewayAdapter(new ConfigService({ NODE_ENV: "production", LOCAL_PAYMENT_GATEWAY_ENABLED: "true" }));
    const fake = { providerCode: "zarinpal", initiate: async () => { throw new Error(); }, verify: async () => ({ verified: false }), inquiry: async () => false, refund: async () => false } as never;
    const payments = new PaymentService(local, fake);
    assert.throws(() => payments.get("typo"), /unsupported/i);
    assert.throws(() => misconfigured.onModuleInit(), /cannot be enabled in production/i);
    await assert.rejects(local.verify("local-anything"), /disabled in production/i);
  });
});
