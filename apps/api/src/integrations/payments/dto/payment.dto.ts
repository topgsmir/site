import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsDateString,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export class PaymentProviderParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[a-z0-9-]+$/)
  providerCode!: string;
}

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

export class PaymentCallbackQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  Authority!: string;

  @IsOptional()
  @IsIn(["OK", "NOK"])
  Status?: string;
}

export class CompleteLocalPaymentDto {
  @IsIn(["paid", "canceled"])
  status!: "paid" | "canceled";
}

export class ListAdminPaymentTransactionsQueryDto {
  @IsOptional()
  @IsUUID("4")
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsOptional()
  @IsIn(["created", "initiating", "initiation_unknown", "pending", "succeeded", "refund_pending", "refund_unknown", "failed", "refunded"])
  status?: "created" | "initiating" | "initiation_unknown" | "pending" | "succeeded" | "refund_pending" | "refund_unknown" | "failed" | "refunded";

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[a-z0-9-]+$/)
  providerCode?: string;

  @IsOptional()
  @IsUUID("4")
  sellerId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  query?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class UpdatePaymentMethodDto {
  @IsBoolean()
  enabled!: boolean;

  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(["digital", "physical", "service", "bridge"], { each: true })
  productTypes!: Array<"digital" | "physical" | "service" | "bridge">;

  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  sellerIds!: string[];

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  merchantId?: string;

  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true, require_tld: true })
  @MaxLength(500)
  callbackUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  refundAccessToken?: string;

  @IsOptional()
  @IsBoolean()
  clearRefundAccessToken?: boolean;
}

export class ListPaymentSellerOptionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
