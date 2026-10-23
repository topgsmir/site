"use client";
import { createContext, useContext } from "react";
import { defaultTemplateConfiguration, migrateLegacyTemplateNavigation, type TemplateConfiguration, type TemplateLocale } from "@topgsm/shared-types";
const TemplateContext = createContext<{ locale: TemplateLocale; configuration: TemplateConfiguration } | null>(null);
export function TemplateSettingsProvider({ locale, configuration, children }: { locale: TemplateLocale; configuration: TemplateConfiguration; children: React.ReactNode }) {
  return <TemplateContext.Provider value={{ locale, configuration: migrateLegacyTemplateNavigation(configuration, locale) }}>{children}</TemplateContext.Provider>;
}
export function useTemplateConfiguration(locale: TemplateLocale) {
  const settings = useContext(TemplateContext);
  return settings?.locale === locale ? settings.configuration : defaultTemplateConfiguration(locale);
}
