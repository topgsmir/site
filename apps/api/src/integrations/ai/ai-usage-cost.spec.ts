import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Prisma } from "../../prisma/client";
import { calculateEstimatedCostUsd, combineAiUsage } from "./ai-usage-cost";

describe("AI usage cost", () => {
  it("combines every model call before calculating the run cost", () => {
    const usage = combineAiUsage(
      { inputTokens: 1_000, outputTokens: 100 },
      { inputTokens: 2_000, outputTokens: 500 }
    );
    const cost = calculateEstimatedCostUsd(new Prisma.Decimal("2.50"), new Prisma.Decimal("10"), usage);

    assert.deepEqual(usage, { inputTokens: 3_000, outputTokens: 600 });
    assert.equal(cost?.toString(), "0.0135");
  });

  it("does not claim a complete estimate when pricing or usage is incomplete", () => {
    assert.equal(calculateEstimatedCostUsd(null, null, { inputTokens: 10, outputTokens: 20 }), null);
    assert.equal(calculateEstimatedCostUsd(new Prisma.Decimal(1), new Prisma.Decimal(2), { inputTokens: null, outputTokens: 20 }), null);
    assert.deepEqual(combineAiUsage({ inputTokens: 10, outputTokens: null }, { inputTokens: 5, outputTokens: 2 }), { inputTokens: 15, outputTokens: null });
  });
});
