import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";

/** Keep IDs as digit strings across HTTP, Prisma and JSON, without numeric rounding. */
export const ORDER_ID_PATTERN = /^[1-9][0-9]{0,18}$/;

@Injectable()
export class OrderIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!ORDER_ID_PATTERN.test(value) || BigInt(value) > 9_223_372_036_854_775_807n) {
      throw new BadRequestException("Order ID must contain only digits");
    }
    return value;
  }
}
