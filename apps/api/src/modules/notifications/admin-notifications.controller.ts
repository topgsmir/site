import { Controller, Get, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminNotificationsService } from "./admin-notifications.service";

@Controller("admin/notifications")
@UseGuards(PlatformAdminGuard)
export class AdminNotificationsController {
  constructor(private readonly notifications: AdminNotificationsService) {}

  @Get("counts")
  counts() {
    return this.notifications.counts();
  }
}
