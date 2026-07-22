-- AlterTable
ALTER TABLE "ResellerCreditTransaction" ADD COLUMN "sellerVatStatus" "ResellerVatStatus";
ALTER TABLE "ResellerCreditTransaction" ADD COLUMN "sellerVatNumber" TEXT;

-- CreateTable
CREATE TABLE "ResellerVatRegistration" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resellerProfileId" TEXT NOT NULL,
    "status" "ResellerVatStatus" NOT NULL,
    "vatNumber" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ResellerVatRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResellerVatRegistration_resellerProfileId_validFrom_idx" ON "ResellerVatRegistration"("resellerProfileId", "validFrom");

-- CreateIndex
CREATE INDEX "ResellerVatRegistration_resellerProfileId_endedAt_idx" ON "ResellerVatRegistration"("resellerProfileId", "endedAt");

-- AddForeignKey
ALTER TABLE "ResellerVatRegistration" ADD CONSTRAINT "ResellerVatRegistration_resellerProfileId_fkey" FOREIGN KEY ("resellerProfileId") REFERENCES "ResellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
