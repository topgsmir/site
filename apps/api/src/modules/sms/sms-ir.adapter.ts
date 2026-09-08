import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SmsTemplate } from "./sms.service";

@Injectable()
export class SmsIrAdapter {
  constructor(private readonly config: ConfigService) {}

  async send(recipient: string, template: SmsTemplate, parameters: Record<string, string>) {
    const apiKey = this.config.get<string>("SMS_IR_API_KEY")?.trim();
    const templateId = Number(this.config.get<string>(`SMS_IR_TEMPLATE_${template.toUpperCase()}`));
    if (!apiKey || !Number.isSafeInteger(templateId) || templateId <= 0) {
      throw new ServiceUnavailableException(`SMS.ir template ${template} is not configured`);
    }
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
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) throw error;
      throw new BadGatewayException("SMS.ir request failed");
    } finally {
      clearTimeout(timer);
    }
  }
}

