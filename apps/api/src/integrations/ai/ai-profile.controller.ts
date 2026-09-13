import { Body, Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../../modules/auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../../modules/auth/browser-session-mutation.decorator";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../../modules/auth/platform-admin.guard";
import { AiProfileService } from "./ai-profile.service";
import { BindAiCapabilityDto, CreateAiProfileDto, UpdateAiProfileDto } from "./dto/ai-profile.dto";

@Controller("ai") @UseGuards(PlatformAdminGuard)
export class AiProfileController {
  constructor(private readonly profiles: AiProfileService, private readonly limits: AuthRateLimitService) {}
  @Get("model-profiles") list() { return this.profiles.list(); }
  @Post("model-profiles") @BrowserSessionMutation() async create(@Req() req: AuthenticatedRequest, @Ip() ip: string, @Body() body: CreateAiProfileDto) { await this.limits.consumeAiProfile(req.authenticatedUser!.id, ip); return this.profiles.create(body, req.authenticatedUser!.id); }
  @Patch("model-profiles/:id") @BrowserSessionMutation() async update(@Req() req: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: UpdateAiProfileDto) { await this.limits.consumeAiProfile(req.authenticatedUser!.id, ip); return this.profiles.update(id, body, req.authenticatedUser!.id); }
  @Delete("model-profiles/:id") @BrowserSessionMutation() async remove(@Req() req: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { await this.limits.consumeAiProfile(req.authenticatedUser!.id, ip); return this.profiles.remove(id, req.authenticatedUser!.id); }
  @Post("model-profiles/:id/test") @BrowserSessionMutation() async test(@Req() req: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { await this.limits.consumeAiProfileTest(req.authenticatedUser!.id, ip); return this.profiles.test(id, req.authenticatedUser!.id); }
  @Post("model-profiles/:id/deactivate") @BrowserSessionMutation() deactivate(@Req() req: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.profiles.deactivate(id, req.authenticatedUser!.id); }
  @Get("capabilities/:key/profile") binding(@Param("key") key: string) { return this.profiles.binding(key); }
  @Put("capabilities/:key/profile") @BrowserSessionMutation() bind(@Req() req: AuthenticatedRequest, @Param("key") key: string, @Body() body: BindAiCapabilityDto) { return this.profiles.bind(key, body, req.authenticatedUser!.id); }
}
