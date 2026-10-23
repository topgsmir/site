import { IsUUID } from "class-validator";

export class GoghdiAgentTicketDto {
  @IsUUID("4")
  sellerId!: string;
}
