import { IsUUID, ValidateIf } from "class-validator";

export class GoghdiOrderTicketDto {
  @IsUUID("4")
  orderId!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID("4")
  orderItemId?: string;
}
