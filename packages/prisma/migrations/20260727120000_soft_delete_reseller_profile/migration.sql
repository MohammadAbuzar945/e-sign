-- Soft-delete reseller profiles so purchase/sales history is retained.
ALTER TYPE "ResellerProfileStatus" ADD VALUE IF NOT EXISTS 'DELETED';

ALTER TABLE "ResellerProfile" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Prevent hard-deleting a reseller profile from cascading away sales history.
ALTER TABLE "ResellerCreditTransaction" DROP CONSTRAINT IF EXISTS "ResellerCreditTransaction_resellerProfileId_fkey";
ALTER TABLE "ResellerCreditTransaction" ADD CONSTRAINT "ResellerCreditTransaction_resellerProfileId_fkey" FOREIGN KEY ("resellerProfileId") REFERENCES "ResellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
