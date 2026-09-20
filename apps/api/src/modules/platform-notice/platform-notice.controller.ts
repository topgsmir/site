import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { UpdatePlatformNoticeDto } from "./dto/update-platform-notice.dto";
import { PlatformNoticeService } from "./platform-notice.service";

@Controller("notice")
export class PublicNoticeController {
  constructor(private readonly notices: PlatformNoticeService) {}
  @Get()
  get() { return this.notices.getPublic(); }
}

@Controller("admin/settings/notice")
@UseGuards(PlatformAdminGuard)
export class AdminNoticeController {
  constructor(private readonly notices: PlatformNoticeService) {}
  @Get()
  get() { return this.notices.getAdmin(); }
  @Patch()
  update(@Body() body: UpdatePlatformNoticeDto) { return this.notices.update(body); }
}
