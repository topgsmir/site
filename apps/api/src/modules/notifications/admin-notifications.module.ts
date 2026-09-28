import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { AdminNotificationsService } from "./admin-notifications.service";

@Module({
  imports: [AuthModule],
  controllers: [AdminNotificationsController],
  providers: [AdminNotificationsService]
})
export class AdminNotificationsModule {}
