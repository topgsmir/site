import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateSecurityPolicyDto } from "./dto/security-policy.dto";

type Settings = UpdateSecurityPolicyDto;
function policy(ipLimit: number, subjectLimit: number, ipWindowSeconds = 900, subjectWindowSeconds = ipWindowSeconds): Settings {
  return { ipLimit, subjectLimit, ipWindowSeconds, subjectWindowSeconds, captchaEnabled: false };
}

/** Defaults match the limits enforced before admin policy controls existed. */
export const SECURITY_DEFAULTS = {
  login: policy(40, 8), register: policy(10, 3, 3600, 86400), otp: policy(20, 5, 3600),
  captcha_challenge: policy(30, 30), checkout_quote: policy(120, 30),
  comment_submit_guest: policy(20, 5, 3600), comment_submit: policy(30, 8),
  comment_reply: policy(90, 30), comment_admin: policy(90, 30),
  order: policy(100, 30), shipping: policy(30, 10), shipping_configuration: policy(30, 10),
  payout: policy(60, 20), media: policy(90, 30), payment: policy(40, 10),
  payment_callback: policy(60, 10), payment_refund: policy(30, 10), payment_configuration: policy(30, 10),
  sms_configuration: policy(30, 10), auth_configuration: policy(30, 10), staff_setup: policy(30, 10, 3600),
  bridge: policy(60, 20), signed_ticket: policy(90, 30), ai_profile: policy(30, 10),
  ai_profile_test: policy(90, 30), ai_run: policy(60, 20), product_bulk_undo: policy(15, 5),
  analytics: policy(180, 60)
} satisfies Record<string, Settings>;

export type SecurityAction = keyof typeof SECURITY_DEFAULTS;
export type SecurityPolicy = Settings & { action: SecurityAction };
export const CAPTCHA_ACTIONS = ["login", "register", "otp", "comment_submit_guest"] as const satisfies readonly SecurityAction[];
export function isSecurityAction(value: string): value is SecurityAction { return Object.hasOwn(SECURITY_DEFAULTS, value); }
export function supportsCaptcha(action: SecurityAction): boolean { return (CAPTCHA_ACTIONS as readonly string[]).includes(action); }

@Injectable()
export class SecurityPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async get(action: SecurityAction): Promise<SecurityPolicy> {
    const row = await this.prisma.security_policies.findUnique({ where: { action }, select: {
      ip_limit: true, subject_limit: true, ip_window_seconds: true, subject_window_seconds: true, captcha_enabled: true
    } });
    return { action, ...(row ? {
      ipLimit: row.ip_limit, subjectLimit: row.subject_limit,
      ipWindowSeconds: row.ip_window_seconds, subjectWindowSeconds: row.subject_window_seconds,
      captchaEnabled: row.captcha_enabled
    } : SECURITY_DEFAULTS[action]) };
  }

  async list(): Promise<SecurityPolicy[]> {
    const rows = await this.prisma.security_policies.findMany({ select: {
      action: true, ip_limit: true, subject_limit: true, ip_window_seconds: true, subject_window_seconds: true, captcha_enabled: true
    } });
    const saved = new Map(rows.map((row) => [row.action, row]));
    return (Object.keys(SECURITY_DEFAULTS) as SecurityAction[]).map((action) => {
      const row = saved.get(action);
      return { action, ...(row ? {
        ipLimit: row.ip_limit, subjectLimit: row.subject_limit,
        ipWindowSeconds: row.ip_window_seconds, subjectWindowSeconds: row.subject_window_seconds,
        captchaEnabled: row.captcha_enabled
      } : SECURITY_DEFAULTS[action]) };
    });
  }

  async update(action: SecurityAction, value: UpdateSecurityPolicyDto, actorUserId: string): Promise<SecurityPolicy> {
    if (value.captchaEnabled && !supportsCaptcha(action)) throw new BadRequestException("CAPTCHA is unavailable for this operation");
    const fields = { ip_limit: value.ipLimit, subject_limit: value.subjectLimit, ip_window_seconds: value.ipWindowSeconds, subject_window_seconds: value.subjectWindowSeconds, captcha_enabled: value.captchaEnabled };
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.security_policies.upsert({ where: { action }, create: { action, ...fields }, update: fields });
      await tx.security_policy_events.create({ data: { actor_user_id: actorUserId, action, ...fields } });
      return updated;
    });
    return { action, ipLimit: row.ip_limit, subjectLimit: row.subject_limit, ipWindowSeconds: row.ip_window_seconds, subjectWindowSeconds: row.subject_window_seconds, captchaEnabled: row.captcha_enabled };
  }
}
