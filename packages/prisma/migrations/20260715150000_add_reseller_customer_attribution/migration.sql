-- CreateEnum
CREATE TYPE "ResellerAssociationSource" AS ENUM ('AFFILIATE_VISIT', 'AFFILIATE_SIGNUP', 'AFFILIATE_PURCHASE', 'CUSTOMER_CONSENT');

-- AlterTable Organisation: sticky reseller attribution
ALTER TABLE "Organisation" ADD COLUMN "associatedResellerProfileId" TEXT;
ALTER TABLE "Organisation" ADD COLUMN "resellerAssociatedAt" TIMESTAMP(3);
ALTER TABLE "Organisation" ADD COLUMN "resellerAssociationSource" "ResellerAssociationSource";
ALTER TABLE "Organisation" ADD COLUMN "resellerRequiresReconsent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable ResellerProfile: delinquency tracking
ALTER TABLE "ResellerProfile" ADD COLUMN "zeroBalanceSince" TIMESTAMP(3);
ALTER TABLE "ResellerProfile" ADD COLUMN "isDelinquent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ResellerProfile" ADD COLUMN "delinquentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Organisation_associatedResellerProfileId_idx" ON "Organisation"("associatedResellerProfileId");
CREATE INDEX "ResellerProfile_isDelinquent_idx" ON "ResellerProfile"("isDelinquent");

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_associatedResellerProfileId_fkey" FOREIGN KEY ("associatedResellerProfileId") REFERENCES "ResellerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
