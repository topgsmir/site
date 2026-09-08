import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CredentialCryptoService } from "../bridge/credential-crypto.service";
import { SmsIrAdapter } from "./sms-ir.adapter";
import type { SmsTemplate } from "./sms.service";

type ClaimedSms = { id: string; recipient: string; template: string; parameters: Prisma.JsonValue; attempts: number };

@Injectable()
export class SmsWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmsWorkerService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(private readonly prisma: PrismaService, private readonly crypto: CredentialCryptoService, private readonly adapter: SmsIrAdapter, private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.config.get<string>("DISABLE_BACKGROUND_WORKERS") === "true") return;
    this.timer = setInterval(() => void this.tick(), 2_000);
    this.timer.unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private async tick() {
    if (this.busy) return;
    this.busy = true;
    let job: ClaimedSms | undefined;
    try {
      const rows = await this.prisma.$queryRaw<ClaimedSms[]>(Prisma.sql`
        UPDATE "sms_deliveries" SET "status" = 'sending', "locked_at" = CURRENT_TIMESTAMP,
          "attempts" = "attempts" + 1, "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = (
          SELECT "id" FROM "sms_deliveries"
          WHERE (
              "status" IN ('pending', 'failed') OR
              ("status" = 'sending' AND "locked_at" < CURRENT_TIMESTAMP - INTERVAL '2 minutes')
            ) AND "next_attempt_at" <= CURRENT_TIMESTAMP
            AND "attempts" < 5
          ORDER BY "next_attempt_at", "created_at" FOR UPDATE SKIP LOCKED LIMIT 1
        ) RETURNING "id", "recipient", "template", "parameters", "attempts"
      `);
      job = rows[0];
      if (!job) return;
      const envelope = job.parameters as { ciphertext?: string; keyId?: string };
      if (!envelope.ciphertext || !envelope.keyId) throw new Error("SMS parameters are invalid");
      const parameters = JSON.parse(this.crypto.decrypt(envelope.ciphertext, envelope.keyId, `sms:${job.id}:parameters`)) as Record<string, string>;
      await this.adapter.send(job.recipient, job.template as SmsTemplate, parameters);
      await this.prisma.sms_deliveries.update({ where: { id: job.id }, data: { status: "sent", sent_at: new Date(), locked_at: null, last_error: null } });
    } catch (error) {
      const code = error instanceof Error ? error.constructor.name.slice(0, 200) : "SmsError";
      if (job) {
        await this.prisma.sms_deliveries.update({ where: { id: job.id }, data: { status: "failed", locked_at: null, last_error: code, next_attempt_at: new Date(Date.now() + Math.min(60_000 * 2 ** job.attempts, 3_600_000)) } });
      }
      this.logger.warn(`SMS delivery failed: ${code}`);
    } finally { this.busy = false; }
  }
}
