import { t, type Locale } from "@/lib/i18n";
import { PaymentMethodCard } from "./PaymentMethodCard";

const METHODS = ["localBank", "nationalWallet", "cardGateway"] as const;

export function PaymentMethodList({ locale }: { locale: Locale }) {
  return (
    <div className="panel-grid">
      {METHODS.map((method) => (
        <PaymentMethodCard
          key={method}
          name={t(locale, `payment.methods.${method}.name`)}
          description={t(locale, `payment.methods.${method}.description`)}
        />
      ))}
    </div>
  );
}
