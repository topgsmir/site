import { Matches as MatchesOrderId } from "class-validator";
import { ORDER_ID_PATTERN } from "../../../common/order-id.pipe";
import { IsUUID, ValidateIf } from "class-validator";

export class GoghdiOrderTicketDto {
  @MatchesOrderId(ORDER_ID_PATTERN)
  orderId!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID("4")
  orderItemId?: string;
}
