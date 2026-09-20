import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

export class BridgeOrderFieldDto {
  @IsString() @MinLength(1) @MaxLength(100) key!: string;
  @IsString() @MaxLength(5000) value!: string;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._ -]*$/)
  trafficSource?: string;

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

  @IsOptional() @IsString() @MinLength(3) @MaxLength(100) search?: string;
  @IsOptional() @IsIn(["pending", "paid", "processing", "shipped", "awaiting_confirmation", "delivered", "cancelled"]) status?: string;
  @IsOptional() @IsIn(["digital", "physical", "service", "bridge"]) productType?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateFrom?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateTo?: string;
  @IsOptional() @IsIn(["newest", "oldest"]) sort?: "newest" | "oldest";
  @IsOptional() @IsIn(["directory"]) view?: "directory";
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

export class UpdateOrderShippingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  carrier?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  trackingCode?: string;
}
