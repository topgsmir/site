import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

export const ORDER_EXPORT_COLUMNS = ["id", "createdAt", "status", "buyer", "buyerEmail", "buyerPhone", "seller", "items", "totalAmount", "currency", "paymentProvider", "paymentReference", "trafficSource"] as const;
export type OrderExportColumn = typeof ORDER_EXPORT_COLUMNS[number];

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
  @IsOptional() @IsIn(["pending", "processing", "completed", "cancelled", "returned", "other"]) statusGroup?: "pending" | "processing" | "completed" | "cancelled" | "returned" | "other";
  @IsOptional() @IsIn(["digital", "physical", "service", "bridge"]) productType?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateFrom?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateTo?: string;
  @IsOptional() @IsIn(["newest", "oldest"]) sort?: "newest" | "oldest";
  @IsOptional() @IsIn(["directory"]) view?: "directory";
  @IsOptional() @IsIn(["active", "trashed"]) trash?: "active" | "trashed";
}

export class ExportOrdersDto {
  @IsIn(["fa", "en", "ar"]) locale!: "fa" | "en" | "ar";
  @IsOptional() @IsIn(["active", "trashed"]) trash?: "active" | "trashed";
  @IsOptional() @IsString() @MinLength(3) @MaxLength(100) search?: string;
  @IsOptional() @IsIn(["pending", "processing", "completed", "cancelled", "returned", "other"]) statusGroup?: ListOrdersQueryDto["statusGroup"];
  @IsOptional() @IsIn(["digital", "physical", "service", "bridge"]) productType?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateFrom?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateTo?: string;
  @IsOptional() @IsIn(["newest", "oldest"]) sort?: "newest" | "oldest";

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(ORDER_EXPORT_COLUMNS.length)
  @ArrayUnique() @IsIn(ORDER_EXPORT_COLUMNS, { each: true })
  columns!: OrderExportColumn[];

  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ArrayUnique() @IsUUID("4", { each: true })
  selectedIds?: string[];
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

  @IsOptional() @IsBoolean() confirmSensitive?: boolean;
}

export class SetOrderTrashDto {
  @IsBoolean() trashed!: boolean;
  @IsBoolean() confirm!: boolean;
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
