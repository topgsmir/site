import { BadGatewayException, Injectable } from "@nestjs/common";
import type { SmsTemplate } from "./sms.service";
import { SmsSettingsService } from "./sms-settings.service";

@Injectable()
export class SmsIrAdapter {
  constructor(private readonly settings: SmsSettingsService) {}

  async send(recipient: string, template: SmsTemplate, parameters: Record<string, string>, content?: { templateId?: number | null; messageText?: string | null }) {
    const configured = content?.templateId || content?.messageText
      ? await this.settings.providerCredentials()
      : await this.settings.credentialsFor(template);
    const apiKey = configured.apiKey;
    const templateId = content?.templateId ?? ("templateId" in configured ? configured.templateId : null);
    const lineNumber = "lineNumber" in configured ? configured.lineNumber : null;
    const messageText = content?.messageText?.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, key: string) => parameters[key] ?? "") ?? null;
    if (content?.messageText && !lineNumber) throw new BadGatewayException("SMS.ir line number is not configured");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(messageText ? "https://api.sms.ir/v1/send/bulk" : "https://api.sms.ir/v1/send/verify", {
        method: "POST",
        signal: controller.signal,
        redirect: "error",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messageText ? {
          lineNumber: Number(lineNumber),
          messageText,
          mobiles: [`0${recipient.slice(3)}`]
        } : {
          mobile: `0${recipient.slice(3)}`,
          templateId,
          parameters: Object.entries(parameters).map(([name, value]) => ({ name, value }))
        })
      });
      if (!response.ok) throw new BadGatewayException(`SMS.ir returned HTTP ${response.status}`);
      const result = await response.json() as { status?: number };
      if (result.status !== 1) throw new BadGatewayException("SMS.ir rejected the message");
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException("SMS.ir request failed");
    } finally {
      clearTimeout(timer);
    }
  }
}
