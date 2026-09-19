import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { AdminAuthLoginSettings, AuthLoginMethods } from "@topgsm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateAuthLoginSettingsDto } from "./dto/auth-login-settings.dto";

const SETTINGS_ID = 1;
const DEFAULTS: AuthLoginMethods = { emailPasswordEnabled: true, phoneOtpEnabled: true };

@Injectable()
export class AuthLoginSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublic(): Promise<AuthLoginMethods> {
    const row = await this.read();
    return row ? { emailPasswordEnabled: row.email_password_enabled, phoneOtpEnabled: row.phone_otp_enabled } : DEFAULTS;
  }

  async getAdmin(): Promise<AdminAuthLoginSettings> {
    const row = await this.read();
    return { ...(row ? { emailPasswordEnabled: row.email_password_enabled, phoneOtpEnabled: row.phone_otp_enabled } : DEFAULTS), updatedAt: row?.updated_at.toISOString() ?? null };
  }

  async assertEmailPasswordEnabled() {
    if (!(await this.getPublic()).emailPasswordEnabled) throw new ServiceUnavailableException("Email and password sign-in is disabled");
  }

  async assertPhoneOtpEnabled() {
    if (!(await this.getPublic()).phoneOtpEnabled) throw new ServiceUnavailableException("Phone sign-in is disabled");
  }

  async update(input: UpdateAuthLoginSettingsDto, actorUserId: string): Promise<AdminAuthLoginSettings> {
    if (!input.emailPasswordEnabled && !input.phoneOtpEnabled) {
      throw new BadRequestException("At least one sign-in method must stay enabled");
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.auth_login_settings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, email_password_enabled: input.emailPasswordEnabled, phone_otp_enabled: input.phoneOtpEnabled },
        update: { email_password_enabled: input.emailPasswordEnabled, phone_otp_enabled: input.phoneOtpEnabled },
        select: { email_password_enabled: true, phone_otp_enabled: true, updated_at: true }
      });
      await tx.auth_login_setting_events.create({ data: {
        actor_user_id: actorUserId,
        email_password_enabled: updated.email_password_enabled,
        phone_otp_enabled: updated.phone_otp_enabled
      } });
      return updated;
    });
    return { emailPasswordEnabled: row.email_password_enabled, phoneOtpEnabled: row.phone_otp_enabled, updatedAt: row.updated_at.toISOString() };
  }

  private read() {
    return this.prisma.auth_login_settings.findUnique({
      where: { id: SETTINGS_ID },
      select: { email_password_enabled: true, phone_otp_enabled: true, updated_at: true }
    });
  }
}
