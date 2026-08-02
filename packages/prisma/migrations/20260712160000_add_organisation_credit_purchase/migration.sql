-- CreateEnum
CREATE TYPE "OrganisationCreditPurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "OrganisationCreditPurchase" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "paystackReference" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "status" "OrganisationCreditPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OrganisationCreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationCreditPurchase_paystackReference_key" ON "OrganisationCreditPurchase"("paystackReference");

-- CreateIndex
CREATE INDEX "OrganisationCreditPurchase_organisationId_idx" ON "OrganisationCreditPurchase"("organisationId");

-- CreateIndex
CREATE INDEX "OrganisationCreditPurchase_status_idx" ON "OrganisationCreditPurchase"("status");

-- CreateIndex
CREATE INDEX "OrganisationCreditPurchase_createdAt_idx" ON "OrganisationCreditPurchase"("createdAt");

-- AddForeignKey
ALTER TABLE "OrganisationCreditPurchase" ADD CONSTRAINT "OrganisationCreditPurchase_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationCreditPurchase" ADD CONSTRAINT "OrganisationCreditPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
