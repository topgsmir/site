import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Top GSM | Seller Dashboard",
  robots: {
    index: false,
    follow: false
  }
};

type SellerDashboardPageProps = {
  params: {
    locale: string;
  };
};

export default function SellerDashboardPage({ params }: SellerDashboardPageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  const locale = params.locale;

  return (
    <section>
      <h2>{t(locale, "seller.title")}</h2>
      <div className="card">
        <ul>
          <li>{t(locale, "seller.products")}</li>
          <li>{t(locale, "seller.orders")}</li>
          <li>{t(locale, "seller.payoutRequests")}</li>
        </ul>
      </div>
    </section>
  );
}
