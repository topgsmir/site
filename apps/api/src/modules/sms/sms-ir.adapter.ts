import { BadGatewayException, Injectable } from "@nestjs/common";
import type { SmsTemplate } from "./sms.service";
import { SmsSettingsService } from "./sms-settings.service";

@Injectable()
export class SmsIrAdapter {
  constructor(private readonly settings: SmsSettingsService) {}

  async send(recipient: string, template: SmsTemplate, parameters: Record<string, string>) {
    const { apiKey, templateId } = await this.settings.credentialsFor(template);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch("https://api.sms.ir/v1/send/verify", {
        method: "POST",
        signal: controller.signal,
        redirect: "error",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          mobile: `0${recipient.slice(3)}`,
          templateId,
          parameters: Object.entries(parameters).map(([name, value]) => ({ name, value }))
        })
      });
      if (!response.ok) throw new BadGatewayException(`SMS.ir returned HTTP ${response.status}`);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException("SMS.ir request failed");
    } finally {
      clearTimeout(timer);
    }
  }
}
