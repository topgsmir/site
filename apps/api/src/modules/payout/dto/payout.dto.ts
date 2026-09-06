import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListPayoutsQueryDto {
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

export class RequestPayoutDto {
  @IsUUID("4")
  orderId!: string;
}

export class SetPayoutStatusDto {
  @IsIn(["approved", "settled", "disputed"])
  status!: "approved" | "settled" | "disputed";
}
