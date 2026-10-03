ALTER TABLE "sellers"
  ADD COLUMN "commission_digital" DECIMAL(9,6),
  ADD COLUMN "commission_physical" DECIMAL(9,6),
  ADD COLUMN "commission_service" DECIMAL(9,6),
  ADD COLUMN "commission_bridge" DECIMAL(9,6);

ALTER TABLE "sellers"
  ADD CONSTRAINT "sellers_commission_digital_range" CHECK ("commission_digital" BETWEEN 0 AND 1),
  ADD CONSTRAINT "sellers_commission_physical_range" CHECK ("commission_physical" BETWEEN 0 AND 1),
  ADD CONSTRAINT "sellers_commission_service_range" CHECK ("commission_service" BETWEEN 0 AND 1),
  ADD CONSTRAINT "sellers_commission_bridge_range" CHECK ("commission_bridge" BETWEEN 0 AND 1);
