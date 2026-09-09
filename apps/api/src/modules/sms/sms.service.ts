import { Injectable } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CredentialCryptoService } from "../bridge/credential-crypto.service";

export type SmsTemplate = "otp" | "seller_new_order" | "buyer_success" | "buyer_failure";

@Injectable()
export class SmsService {
  constructor(private readonly prisma: PrismaService, private readonly crypto: CredentialCryptoService) {}

  async enqueue(recipient: string, template: SmsTemplate, parameters: Record<string, string>, dedupeKey: string) {
    const id = randomUUID();
    const encrypted = this.crypto.encrypt(JSON.stringify(parameters), `sms:${id}:parameters`);
    try {
      return await this.prisma.sms_deliveries.create({
        data: {
          id,
          recipient,
          template,
          dedupe_key: dedupeKey,
          parameters: { ciphertext: encrypted.ciphertext, keyId: encrypted.keyId }
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.prisma.sms_deliveries.findUniqueOrThrow({ where: { dedupe_key: dedupeKey } });
      }
      throw error;
    }
  }
}
