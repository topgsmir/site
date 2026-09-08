import { IsUUID } from "class-validator";

export class GoghdiProductTicketDto {
  @IsUUID("4")
  productId!: string;
}
