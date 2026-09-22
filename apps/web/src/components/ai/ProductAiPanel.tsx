"use client";

import type { BlogLocale } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { ContentAiPanel, type AiField } from "./ContentAiPanel";

type ProductContent = { title: string; description: string; category: string; slug?: string };
export function ProductAiPanel({ locale, language = "fa", value, onChange, disabled = false }: {
  locale: Locale; language?: BlogLocale; value: ProductContent; onChange: (value: ProductContent) => void; disabled?: boolean;
}) {
  const fields: AiField[] = ["title", "description", "category", ...(value.slug !== undefined ? ["slug" as const] : [])];
  return <ContentAiPanel locale={locale} kind="product" language={language} disabled={disabled}
    fields={fields} snapshot={JSON.stringify(value)} getSource={() => [value.title, value.description, value.category].filter(Boolean).join("\n\n")}
    onApply={(drafts, selected) => {
      const draft = drafts[language];
      const next = { ...value };
      if (draft) {
        if (selected.includes("title")) next.title = draft.title;
        if (selected.includes("description")) next.description = draft.description;
        if (selected.includes("category") && draft.category) next.category = draft.category;
        if (selected.includes("slug") && value.slug !== undefined) next.slug = draft.slug;
      }
      onChange(next);
      return JSON.stringify(next);
    }} onRestore={(snapshot) => onChange(JSON.parse(snapshot) as ProductContent)} />;
}
