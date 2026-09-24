import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";

const MAX_DEPTH = 32;
const MAX_VALUES = 10_000;

function containsUnsafeCharacters(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (
      code === 0 || code === 0xfeff || code === 0x200e || code === 0x200f ||
      (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)
    ) return true;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

/** Rejects non-printing characters that can truncate values or visually spoof
 * security-sensitive text. It deliberately preserves whitespace and Persian
 * ZWNJ, and never rewrites passwords, signatures, or other opaque inputs. */
@Injectable()
export class RejectUnsafeInputCharactersPipe implements PipeTransform {
  transform(value: unknown) {
    const seen = new WeakSet<object>();
    let values = 0;

    const inspect = (current: unknown, depth: number): void => {
      if (++values > MAX_VALUES || depth > MAX_DEPTH) {
        throw new BadRequestException("Input is too complex");
      }
      if (typeof current === "string") {
        if (containsUnsafeCharacters(current)) throw new BadRequestException("Input contains unsafe characters");
        return;
      }
      if (!current || typeof current !== "object" || current instanceof Date || Buffer.isBuffer(current)) return;
      if (seen.has(current)) return;
      seen.add(current);
      if (Array.isArray(current)) {
        current.forEach((item) => inspect(item, depth + 1));
        return;
      }
      for (const [key, item] of Object.entries(current as Record<string, unknown>)) {
        inspect(key, depth + 1);
        inspect(item, depth + 1);
      }
    };

    inspect(value, 0);
    return value;
  }
}
