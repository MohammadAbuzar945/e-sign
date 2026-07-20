-- CreateEnum
CREATE TYPE "OrganisationCreditPurchaseType" AS ENUM ('PAYG', 'BULK');

-- AlterTable
ALTER TABLE "OrganisationCreditPurchase" ADD COLUMN "purchaseType" "OrganisationCreditPurchaseType" NOT NULL DEFAULT 'PAYG';

-- CreateIndex
CREATE INDEX "OrganisationCreditPurchase_purchaseType_idx" ON "OrganisationCreditPurchase"("purchaseType");

-- AlterTable
ALTER TABLE "ResellerProfile" ADD COLUMN "bulkRatesUseCustom" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ResellerBulkRateTier" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "minCredits" INTEGER NOT NULL,
    "pricePerCreditCents" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ResellerBulkRateTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerProfileBulkRateTier" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resellerProfileId" TEXT NOT NULL,
    "minCredits" INTEGER NOT NULL,
    "pricePerCreditCents" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ResellerProfileBulkRateTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResellerBulkRateTier_minCredits_key" ON "ResellerBulkRateTier"("minCredits");

-- CreateIndex
CREATE INDEX "ResellerBulkRateTier_isEnabled_minCredits_idx" ON "ResellerBulkRateTier"("isEnabled", "minCredits");

-- CreateIndex
CREATE INDEX "ResellerProfileBulkRateTier_resellerProfileId_isEnabled_minCredits_idx" ON "ResellerProfileBulkRateTier"("resellerProfileId", "isEnabled", "minCredits");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerProfileBulkRateTier_resellerProfileId_minCredits_key" ON "ResellerProfileBulkRateTier"("resellerProfileId", "minCredits");

-- AddForeignKey
ALTER TABLE "ResellerProfileBulkRateTier" ADD CONSTRAINT "ResellerProfileBulkRateTier_resellerProfileId_fkey" FOREIGN KEY ("resellerProfileId") REFERENCES "ResellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
