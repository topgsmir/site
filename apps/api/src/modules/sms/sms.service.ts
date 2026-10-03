import { Injectable } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CredentialCryptoService } from "../bridge/credential-crypto.service";
import type { SmsEvent } from "./sms-events";

export type SmsTemplate = "otp" | "seller_new_order" | "buyer_success" | "buyer_failure" | "club_redemption" | "club_expiry";

@Injectable()
export class SmsService {
  constructor(private readonly prisma: PrismaService, private readonly crypto: CredentialCryptoService) {}

  async enqueue(recipient: string, template: SmsTemplate | SmsEvent, parameters: Record<string, string>, dedupeKey: string, delivery?: { eventKey: SmsEvent; templateId?: number | null; messageText?: string | null }) {
    if (template === "otp" && !delivery) {
      const rule = await this.prisma.sms_event_rules.findFirst({ where: { event_key: "login_otp", recipient_kind: "requester", enabled: true }, select: { template_id: true } });
      if (!rule) throw new Error("SMS login rule is disabled");
      delivery = { eventKey: "login_otp", templateId: rule.template_id };
    }
    const id = randomUUID();
    const encrypted = this.crypto.encrypt(JSON.stringify(parameters), `sms:${id}:parameters`);
    try {
      return await this.prisma.sms_deliveries.create({
        data: {
          id,
          recipient,
          template,
          event_key: delivery?.eventKey ?? null,
          template_id: delivery?.templateId ?? null,
          message_text: delivery?.messageText ?? null,
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
