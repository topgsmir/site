import { IsUUID } from "class-validator";

export class GoghdiOrderTicketDto {
  @IsUUID("4")
  orderId!: string;
}
