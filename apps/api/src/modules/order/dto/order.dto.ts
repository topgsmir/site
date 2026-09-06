import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class CreateOrderDto {
  @IsUUID("4")
  offerId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
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
