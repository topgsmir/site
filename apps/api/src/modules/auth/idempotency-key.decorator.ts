import { BadRequestException, createParamDecorator, ExecutionContext } from "@nestjs/common";
import { isUUID } from "class-validator";

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const value = context.switchToHttp().getRequest<{
      headers: { "idempotency-key"?: string | string[] };
    }>().headers["idempotency-key"];

    if (typeof value !== "string" || !isUUID(value, "4")) {
      throw new BadRequestException("Idempotency-Key must be a UUID v4");
    }
    return value;
  }
);
