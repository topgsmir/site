import { Prisma } from "../../prisma/client";
import type { AiCompletion } from "./ai.types";

export type AiUsage = Pick<AiCompletion, "inputTokens" | "outputTokens">;

export function combineAiUsage(current: AiUsage, next: AiUsage): AiUsage {
  return {
    inputTokens: combineTokenCount(current.inputTokens, next.inputTokens),
    outputTokens: combineTokenCount(current.outputTokens, next.outputTokens)
  };
}

export function calculateEstimatedCostUsd(
  inputPricePerMillionUsd: Prisma.Decimal | null,
  outputPricePerMillionUsd: Prisma.Decimal | null,
  usage: AiUsage
): Prisma.Decimal | null {
  if (inputPricePerMillionUsd === null || outputPricePerMillionUsd === null || usage.inputTokens === null || usage.outputTokens === null) return null;
  return inputPricePerMillionUsd
    .mul(usage.inputTokens)
    .add(outputPricePerMillionUsd.mul(usage.outputTokens))
    .div(1_000_000)
    .toDecimalPlaces(10, Prisma.Decimal.ROUND_HALF_UP);
}

function combineTokenCount(current: number | null, next: number | null) {
  return current === null || next === null ? null : current + next;
}
