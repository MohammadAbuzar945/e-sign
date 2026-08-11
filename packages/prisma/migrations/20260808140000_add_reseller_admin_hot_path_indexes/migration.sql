-- Admin + remaining reseller hot-path indexes.
-- Swap redundant single-column filters for composites that also cover sort columns.

-- ResellerApplication: status alone -> (status, appliedAt) for admin queue/accounts/closed lists
DROP INDEX IF EXISTS "ResellerApplication_status_idx";
CREATE INDEX "ResellerApplication_status_appliedAt_idx" ON "ResellerApplication"("status", "appliedAt");

-- DocGen terms completion / rejection lookup by external request id
CREATE INDEX "ResellerApplication_externalDocGenRequestId_idx" ON "ResellerApplication"("externalDocGenRequestId");

-- OrganisationCreditPurchase: admin global invoice ledger
DROP INDEX IF EXISTS "OrganisationCreditPurchase_status_idx";
DROP INDEX IF EXISTS "OrganisationCreditPurchase_purchaseType_idx";
CREATE INDEX "OrganisationCreditPurchase_status_createdAt_idx" ON "OrganisationCreditPurchase"("status", "createdAt");
CREATE INDEX "OrganisationCreditPurchase_purchaseType_status_createdAt_idx" ON "OrganisationCreditPurchase"("purchaseType", "status", "createdAt");

-- Organisation: admin organisations browser default sort
CREATE INDEX "Organisation_createdAt_idx" ON "Organisation"("createdAt");
