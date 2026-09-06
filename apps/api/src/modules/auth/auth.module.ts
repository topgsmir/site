import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuthenticatedGuard } from "./authenticated.guard";
import { BrowserMutationGuard } from "./browser-mutation.guard";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { RequestAuthenticationService } from "./request-authentication.service";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRateLimitService,
    AuthenticatedGuard,
    BrowserMutationGuard,
    PlatformAdminGuard,
    RequestAuthenticationService,
    { provide: APP_GUARD, useExisting: BrowserMutationGuard }
  ],
  exports: [
    AuthService,
    AuthRateLimitService,
    AuthenticatedGuard,
    PlatformAdminGuard,
    RequestAuthenticationService
  ]
})
export class AuthModule {}
