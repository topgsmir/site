import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BridgeModule } from "../bridge/bridge.module";
import { OtpController } from "./otp.controller";
import { OtpService } from "./otp.service";
import { SmsIrAdapter } from "./sms-ir.adapter";
import { SmsService } from "./sms.service";
import { SmsWorkerService } from "./sms-worker.service";
import { SmsOutboxConsumerService } from "./sms-outbox-consumer.service";

@Module({
  imports: [AuthModule, BridgeModule],
  controllers: [OtpController],
  providers: [OtpService, SmsService, SmsIrAdapter, SmsWorkerService, SmsOutboxConsumerService],
  exports: [SmsService]
})
export class SmsModule {}
