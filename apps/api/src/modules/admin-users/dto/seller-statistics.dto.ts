import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import type { SellerStatisticsPeriod } from "@topgsm/shared-types";

export class SellerStatisticsQueryDto {
  @IsOptional() @IsIn(["7d", "month", "3months", "all"])
  period: SellerStatisticsPeriod = "7d";

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit = 20;
}
