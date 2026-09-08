import { BadRequestException } from "@nestjs/common";

export function normalizeIranianPhone(input: string) {
  const digits = input.replace(/[^0-9+]/g, "");
  const national = digits.startsWith("+98") ? `0${digits.slice(3)}` :
    digits.startsWith("0098") ? `0${digits.slice(4)}` :
    digits.startsWith("98") ? `0${digits.slice(2)}` : digits;
  if (!/^09\d{9}$/.test(national)) throw new BadRequestException("Iranian mobile number is invalid");
  return `+98${national.slice(1)}`;
}

