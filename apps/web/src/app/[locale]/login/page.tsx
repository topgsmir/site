import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/lib/i18n";
import { LoginForm } from "./LoginForm";


type LoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
};

export async function generateMetadata({ params }: Pick<LoginPageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: getDictionary(locale).auth.title, robots: { index: false, follow: false } };
}

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
