import { strict as assert } from "node:assert";
import { it } from "node:test";
import { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CredentialCryptoService } from "../bridge/credential-crypto.service";
import type { SmsIrAdapter } from "./sms-ir.adapter";
import type { SmsSettingsService } from "./sms-settings.service";
import { SmsWorkerService } from "./sms-worker.service";

it("prints SMS details and skips the provider in test mode", async () => {
  const calls: string[] = [];
  const prisma = {
    $queryRaw: async () => [{
      id: "sms-id", recipient: "+989123456789", template: "otp",
      parameters: { ciphertext: "encrypted", keyId: "key-id" }, attempts: 1
    }],
    sms_deliveries: { update: async () => { calls.push("marked-sent"); } }
  } as unknown as PrismaService;
  const crypto = {
    decrypt: () => JSON.stringify({ code: "123456" })
  } as unknown as CredentialCryptoService;
  const adapter = {
    send: async () => { calls.push("provider-called"); }
  } as unknown as SmsIrAdapter;
  const settings = {
    isTestModeEnabled: async () => true
  } as unknown as SmsSettingsService;
  const worker = new SmsWorkerService(prisma, crypto, adapter, new ConfigService(), settings);
  Object.assign(worker, { logger: { log: (message: string) => calls.push(message), warn: () => {} } });

  await worker["tick"]();

  assert.deepEqual(calls, [
    'SMS test mode: {"recipient":"+989123456789","template":"otp","parameters":{"code":"123456"}}',
    "marked-sent"
  ]);
});
