import { BadRequestException, Body, Controller, Get, Ip, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { ParseConstrainedStringPipe } from "../../common/http/parse-constrained-string.pipe";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { PlatformAdminGuard, type AuthenticatedRequest } from "./platform-admin.guard";
import { UpdateSecurityPolicyDto } from "./dto/security-policy.dto";
import { SecurityPolicyService, isSecurityAction, supportsCaptcha } from "./security-policy.service";

@Controller("auth/security-policy")
export class PublicSecurityPolicyController {
  constructor(private readonly policies: SecurityPolicyService) {}
  @Get()
  async get() { return (await this.policies.list()).filter(({ action }) => supportsCaptcha(action)).map(({ action, captchaEnabled }) => ({ action, captchaEnabled })); }
}

@Controller("admin/security")
@UseGuards(PlatformAdminGuard)
export class AdminSecurityPolicyController {
  constructor(private readonly policies: SecurityPolicyService, private readonly rateLimits: AuthRateLimitService) {}
  @Get("policies")
  list() { return this.policies.list(); }
  @Patch("policies/:action")
  async update(@Param("action", new ParseConstrainedStringPipe({ label: "Security action", maxLength: 64, pattern: /^[a-z][a-z0-9_]{2,63}$/ })) action: string, @Body() body: UpdateSecurityPolicyDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    if (!isSecurityAction(action)) throw new BadRequestException("Unsupported security action");
    await this.rateLimits.consumeAuthConfiguration(request.authenticatedUser!.id, clientIp);
    return this.policies.update(action, body, request.authenticatedUser!.id);
  }
}
