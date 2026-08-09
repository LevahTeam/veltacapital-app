ALTER TABLE "Score"
  ADD COLUMN "roundIndex" INTEGER,
  ADD COLUMN "optionType" TEXT,
  ADD COLUMN "optionBudget" DOUBLE PRECISION,
  ADD COLUMN "optionStrike" DOUBLE PRECISION,
  ADD COLUMN "optionPremium" DOUBLE PRECISION,
  ADD COLUMN "optionClosingPrice" DOUBLE PRECISION,
  ADD COLUMN "optionFinalValue" DOUBLE PRECISION,
  ADD COLUMN "optionProfitLoss" DOUBLE PRECISION;

CREATE INDEX "Score_userId_createdAt_idx" ON "Score"("userId", "createdAt");
