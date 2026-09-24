import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";

type ConstrainedStringOptions = {
  label: string;
  minLength?: number;
  maxLength: number;
  pattern?: RegExp;
};

/**
 * Validates primitive route/header values, which are not covered by DTO
 * validation when a controller binds them with @Param("name").
 *
 * This pipe intentionally does not trim or otherwise rewrite opaque values:
 * signatures, tokens, authorities, UUIDs, and slugs must be validated exactly
 * as the caller sent them.
 */
@Injectable()
export class ParseConstrainedStringPipe implements PipeTransform<unknown, string> {
  constructor(private readonly options: ConstrainedStringOptions) {}

  transform(value: unknown): string {
    const { label, minLength = 1, maxLength, pattern } = this.options;
    if (
      typeof value !== "string" ||
      value.length < minLength ||
      value.length > maxLength ||
      /[\p{Cc}\p{Cf}]/u.test(value) ||
      (pattern && !pattern.test(value))
    ) {
      throw new BadRequestException(`${label} is invalid`);
    }
    return value;
  }
}

export const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ROUTE_SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
