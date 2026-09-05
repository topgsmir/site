import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Top GSM | Admin",
  robots: {
    index: false,
    follow: false
  }
};

type AdminPanelPageProps = {
  params: {
    locale: string;
  };
};

export default function AdminPanelPage({ params }: AdminPanelPageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  const locale = params.locale;

  return (
    <section>
      <h2>{t(locale, "admin.title")}</h2>
      <div className="card">
        <ul>
          <li>{t(locale, "admin.sellerInvites")}</li>
          <li>{t(locale, "admin.payoutReview")}</li>
          <li>{t(locale, "admin.orderNotifications")}</li>
        </ul>
      </div>
    </section>
  );
}
