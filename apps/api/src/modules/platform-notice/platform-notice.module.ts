import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminNoticeController, PublicNoticeController } from "./platform-notice.controller";
import { PlatformNoticeService } from "./platform-notice.service";

@Module({ imports: [AuthModule], controllers: [PublicNoticeController, AdminNoticeController], providers: [PlatformNoticeService] })
export class PlatformNoticeModule {}
