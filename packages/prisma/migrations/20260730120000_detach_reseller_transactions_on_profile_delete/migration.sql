-- AlterTable
ALTER TABLE "ResellerCreditTransaction" ADD COLUMN "sellerDisplayName" TEXT;
ALTER TABLE "ResellerCreditTransaction" ADD COLUMN "sellerPhysicalAddress" TEXT;
ALTER TABLE "ResellerCreditTransaction" ADD COLUMN "sellerAffiliateSlug" TEXT;

-- DropForeignKey
ALTER TABLE "ResellerCreditTransaction" DROP CONSTRAINT "ResellerCreditTransaction_resellerProfileId_fkey";

-- AlterTable
ALTER TABLE "ResellerCreditTransaction" ALTER COLUMN "resellerProfileId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ResellerCreditTransaction" ADD CONSTRAINT "ResellerCreditTransaction_resellerProfileId_fkey" FOREIGN KEY ("resellerProfileId") REFERENCES "ResellerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
