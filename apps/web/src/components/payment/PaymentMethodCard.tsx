type PaymentMethodCardProps = {
  name: string;
  description: string;
};

export function PaymentMethodCard({ name, description }: PaymentMethodCardProps) {
  return (
    <article className="card">
      <h4>{name}</h4>
      <p>{description}</p>
    </article>
  );
}
