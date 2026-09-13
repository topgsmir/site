import { HttpException } from "@nestjs/common";

export class PublicHttpException extends HttpException {
  constructor(status: number, message: string, readonly publicDetails: Record<string, unknown>) {
    super(message, status);
  }
}
