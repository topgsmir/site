import { Module } from "@nestjs/common";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { AuthModule } from "../auth/auth.module";
import { OtpController } from "./otp.controller";
import { OtpService } from "./otp.service";
import { SmsIrAdapter } from "./sms-ir.adapter";
import { SmsService } from "./sms.service";
import { SmsWorkerService } from "./sms-worker.service";
import { SmsOutboxConsumerService } from "./sms-outbox-consumer.service";
import { SmsSettingsController } from "./sms-settings.controller";
import { SmsSettingsService } from "./sms-settings.service";

@Module({
  imports: [AuthModule],
  controllers: [OtpController, SmsSettingsController],
  providers: [CredentialCryptoService, OtpService, SmsService, SmsIrAdapter, SmsWorkerService, SmsOutboxConsumerService, SmsSettingsService],
  exports: [SmsService]
})
export class SmsModule {}
