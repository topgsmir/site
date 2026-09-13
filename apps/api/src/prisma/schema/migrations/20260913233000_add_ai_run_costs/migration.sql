ALTER TABLE "ai_model_profiles"
  ADD COLUMN "input_price_per_million_usd" DECIMAL(20, 8),
  ADD COLUMN "output_price_per_million_usd" DECIMAL(20, 8),
  ADD CONSTRAINT "ai_model_profiles_pricing_pair_check" CHECK (
    ("input_price_per_million_usd" IS NULL) = ("output_price_per_million_usd" IS NULL)
  ),
  ADD CONSTRAINT "ai_model_profiles_pricing_nonnegative_check" CHECK (
    ("input_price_per_million_usd" IS NULL OR "input_price_per_million_usd" >= 0) AND
    ("output_price_per_million_usd" IS NULL OR "output_price_per_million_usd" >= 0)
  );

ALTER TABLE "ai_runs"
  ADD COLUMN "input_price_per_million_usd_snapshot" DECIMAL(20, 8),
  ADD COLUMN "output_price_per_million_usd_snapshot" DECIMAL(20, 8),
  ADD COLUMN "estimated_cost_usd" DECIMAL(20, 10),
  ADD CONSTRAINT "ai_runs_pricing_pair_check" CHECK (
    ("input_price_per_million_usd_snapshot" IS NULL) = ("output_price_per_million_usd_snapshot" IS NULL)
  ),
  ADD CONSTRAINT "ai_runs_cost_nonnegative_check" CHECK (
    ("input_price_per_million_usd_snapshot" IS NULL OR "input_price_per_million_usd_snapshot" >= 0) AND
    ("output_price_per_million_usd_snapshot" IS NULL OR "output_price_per_million_usd_snapshot" >= 0) AND
    ("estimated_cost_usd" IS NULL OR "estimated_cost_usd" >= 0)
  );
