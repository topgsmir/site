export class CreateLocalPaymentDto {
  orderId!: string;
  sellerId!: string;
  buyerId!: string;
  amount!: number;
  currency!: string;
}

