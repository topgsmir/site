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
import { ClubCoreModule } from "../club/club-core.module";
import { SmsRulesService } from "./sms-rules.service";
import { SmsPendingProductsService } from "./sms-pending-products.service";
import { GuestCommentVerificationService } from "./guest-comment-verification.service";

@Module({
  imports: [AuthModule, ClubCoreModule],
  controllers: [OtpController, SmsSettingsController],
  providers: [CredentialCryptoService, OtpService, SmsService, SmsIrAdapter, SmsWorkerService, SmsOutboxConsumerService, SmsPendingProductsService, SmsSettingsService, SmsRulesService, GuestCommentVerificationService],
  exports: [SmsService, SmsRulesService, GuestCommentVerificationService]
})
export class SmsModule {}
