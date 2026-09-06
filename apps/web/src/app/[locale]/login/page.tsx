import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/lib/i18n";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false }
};

type LoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!isLocale(locale)) notFound();

  return (
    <LoginForm
      locale={locale}
      copy={getDictionary(locale).auth}
      nextPath={query.next}
    />
  );
}
