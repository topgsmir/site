import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import { randomUUID } from "node:crypto";

type RequestContext = {
  method?: string;
  originalUrl?: string;
  url?: string;
  requestId?: string;
};

type ResponseContext = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: Record<string, unknown>): void };
};

function errorCode(status: number) {
  if (status === HttpStatus.BAD_REQUEST || status === HttpStatus.UNPROCESSABLE_ENTITY) return "VALIDATION_FAILED";
  if (status === HttpStatus.UNAUTHORIZED) return "AUTH_REQUIRED";
  if (status === HttpStatus.FORBIDDEN) return "FORBIDDEN";
  if (status === HttpStatus.NOT_FOUND) return "NOT_FOUND";
  if (status === HttpStatus.CONFLICT) return "CONFLICT";
  if (status === HttpStatus.TOO_MANY_REQUESTS) return "RATE_LIMITED";
  if (status === HttpStatus.SERVICE_UNAVAILABLE) return "SERVICE_UNAVAILABLE";
  if (status >= 500) return "INTERNAL_ERROR";
  return "REQUEST_FAILED";
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestContext>();
    const response = http.getResponse<ResponseContext>();
    const requestId = request.requestId ?? randomUUID();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const source = exception instanceof HttpException ? exception.getResponse() : null;
    const sourceBody = source && typeof source === "object" && !Array.isArray(source)
      ? source as Record<string, unknown>
      : null;
    const message = status >= 500
      ? "The service could not complete the request"
      : sourceBody?.message ?? (typeof source === "string" ? source : "The request could not be completed");

    response.setHeader("X-Request-Id", requestId);
    if (status >= 500) {
      this.logger.error(JSON.stringify({
        event: "http.request.failed",
        requestId,
        method: request.method ?? "UNKNOWN",
        path: request.originalUrl ?? request.url ?? "UNKNOWN",
        status,
        exception: exception instanceof Error ? exception.name : "UnknownError"
      }));
    }

    response.status(status).json({
      statusCode: status,
      code: errorCode(status),
      message,
      requestId
    });
  }
}
