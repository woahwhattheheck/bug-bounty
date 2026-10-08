-- #546 Peer-to-peer internal transfers
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'INTERNAL_TRANSFER_OUT';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'INTERNAL_TRANSFER_IN';

ALTER TABLE "users" ADD COLUMN "transferHandle" TEXT;
CREATE UNIQUE INDEX "users_transferHandle_key" ON "users"("transferHandle");

CREATE TABLE "internal_transfers" (
    "id" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "senderTransactionId" TEXT NOT NULL,
    "recipientTransactionId" TEXT NOT NULL,
    "recipientHandle" TEXT NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "note" TEXT,
    "complianceScore" DOUBLE PRECISION NOT NULL,
    "complianceModelVersion" TEXT NOT NULL,
    "complianceReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "complianceFeatures" JSONB NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_transfers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "internal_transfers_senderTransactionId_key"
  ON "internal_transfers"("senderTransactionId");
CREATE UNIQUE INDEX "internal_transfers_recipientTransactionId_key"
  ON "internal_transfers"("recipientTransactionId");
CREATE INDEX "internal_transfers_senderUserId_createdAt_idx"
  ON "internal_transfers"("senderUserId", "createdAt");
CREATE INDEX "internal_transfers_recipientUserId_createdAt_idx"
  ON "internal_transfers"("recipientUserId", "createdAt");
CREATE INDEX "internal_transfers_assetSymbol_createdAt_idx"
  ON "internal_transfers"("assetSymbol", "createdAt");

ALTER TABLE "internal_transfers"
  ADD CONSTRAINT "internal_transfers_senderUserId_fkey"
  FOREIGN KEY ("senderUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_transfers"
  ADD CONSTRAINT "internal_transfers_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_transfers"
  ADD CONSTRAINT "internal_transfers_senderTransactionId_fkey"
  FOREIGN KEY ("senderTransactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_transfers"
  ADD CONSTRAINT "internal_transfers_recipientTransactionId_fkey"
  FOREIGN KEY ("recipientTransactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
