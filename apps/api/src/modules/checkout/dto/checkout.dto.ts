import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

export class CheckoutLineDto {
  @IsUUID("4")
  offerId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  serviceNote?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique((answer: ServiceAnswerDto) => answer?.key)
  @ValidateNested({ each: true })
  @Type(() => ServiceAnswerDto)
  serviceAnswers?: ServiceAnswerDto[];
}

export class ServiceAnswerDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,39}$/)
  key!: string;

  @IsString()
  @MaxLength(2_000)
  value!: string;
}

export class QuoteCheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((line: CheckoutLineDto) => line?.offerId)
  @ValidateNested({ each: true })
  @Type(() => CheckoutLineDto)
  items!: CheckoutLineDto[];
}

export class ShippingAddressDto {
  @IsString() @MinLength(2) @MaxLength(120) recipientName!: string;
  @IsString() @Matches(/^(?:\+98|0098|98|0)?9\d{9}$/) phoneNumber!: string;
  @IsString() @MinLength(2) @MaxLength(100) province!: string;
  @IsString() @MinLength(2) @MaxLength(100) city!: string;
  @IsString() @Matches(/^\d{10}$/) postalCode!: string;
  @IsString() @MinLength(10) @MaxLength(1000) addressLine!: string;
}

export class CheckoutPaymentSelectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  orderGroupKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[a-z0-9-]+$/)
  providerCode!: string;
}

export class CreateCheckoutDto extends QuoteCheckoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._ -]*$/)
  trafficSource?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((selection: CheckoutPaymentSelectionDto) => selection?.orderGroupKey)
  @ValidateNested({ each: true })
  @Type(() => CheckoutPaymentSelectionDto)
  paymentSelections!: CheckoutPaymentSelectionDto[];
}
