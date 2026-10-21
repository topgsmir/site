import { Matches as MatchesOrderId } from "class-validator";
import { ORDER_ID_PATTERN } from "../../../common/order-id.pipe";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListPayoutsQueryDto {
  @IsOptional()
  @IsIn(["requested"])
  status?: "requested";

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
  @MatchesOrderId(ORDER_ID_PATTERN)
  orderId!: string;
}

export class SetPayoutStatusDto {
  @IsIn(["approved", "settled", "disputed"])
  status!: "approved" | "settled" | "disputed";
}
