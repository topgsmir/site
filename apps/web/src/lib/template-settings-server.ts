import "server-only";
import { defaultTemplateConfiguration, type TemplateConfiguration, type TemplateLocale } from "@topgsm/shared-types";
import { SERVER_API_BASE } from "./api/server";
export async function getTemplateConfiguration(locale: TemplateLocale): Promise<TemplateConfiguration> {
  try {
    const response = await fetch(SERVER_API_BASE + "/template?locale=" + locale, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (response.ok) return await response.json() as TemplateConfiguration;
  } catch { /* Keep the existing header usable while the configuration service is unavailable. */ }
  return defaultTemplateConfiguration(locale);
}
