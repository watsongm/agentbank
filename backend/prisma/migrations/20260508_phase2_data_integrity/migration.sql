-- Phase 2 data integrity improvements
-- 2.1: Add unique constraint to Payment.fapiInteractionId for race-safe idempotency
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_fapiInteractionId_key"
  ON "Payment"("fapiInteractionId")
  WHERE "fapiInteractionId" IS NOT NULL;

-- 2.3: Add PortfolioStatus enum and migrate Portfolio.status from plain string
CREATE TYPE "PortfolioStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
ALTER TABLE "Portfolio"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PortfolioStatus"
    USING "status"::"PortfolioStatus",
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
