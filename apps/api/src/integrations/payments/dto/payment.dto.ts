import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class InitiatePaymentDto {
  @IsUUID("4")
  orderId!: string;
}

export class RefundPaymentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

