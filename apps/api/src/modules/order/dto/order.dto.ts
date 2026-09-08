import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

export class BridgeOrderFieldDto {
  @IsString() @MinLength(1) @MaxLength(100) key!: string;
  @IsString() @MaxLength(5000) value!: string;
}

export class CreateOrderDto {
  @IsUUID("4")
  offerId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((field: BridgeOrderFieldDto) => field?.key)
  @ValidateNested({ each: true })
  @Type(() => BridgeOrderFieldDto)
  bridgeFields?: BridgeOrderFieldDto[];
}

export class ListOrdersQueryDto {
  @IsOptional()
  @IsUUID("4")
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class UpdateOrderStatusDto {
  @IsIn([
    "processing",
    "shipped",
    "awaiting_confirmation",
    "delivered",
    "cancelled"
  ])
  status!:
    | "processing"
    | "shipped"
    | "awaiting_confirmation"
    | "delivered"
    | "cancelled";
}
