-- Swap redundant single-column indexes for composites so write amplification
-- stays roughly the same (one index per leading FK) while covering hot read paths.
-- Unique([resellerProfileId, catalogPackageId]) already covers resellerProfileId lookups.

-- OrganisationCreditPurchase: organisationId alone -> (organisationId, status, createdAt)
DROP INDEX IF EXISTS "OrganisationCreditPurchase_organisationId_idx";
CREATE INDEX "OrganisationCreditPurchase_organisationId_status_createdAt_idx" ON "OrganisationCreditPurchase"("organisationId", "status", "createdAt");

-- ResellerPackage: catalogPackageId for sync-by-catalog (unique already covers resellerProfileId)
CREATE INDEX "ResellerPackage_catalogPackageId_idx" ON "ResellerPackage"("catalogPackageId");
DROP INDEX IF EXISTS "ResellerPackage_resellerProfileId_idx";

-- ResellerCreditTransaction: purchaserOrganisationId alone -> composite
DROP INDEX IF EXISTS "ResellerCreditTransaction_purchaserOrganisationId_idx";
CREATE INDEX "ResellerCreditTransaction_purchaserOrganisationId_status_createdAt_idx" ON "ResellerCreditTransaction"("purchaserOrganisationId", "status", "createdAt");

-- ResellerCreditTransaction: resellerProfileId alone -> composite
DROP INDEX IF EXISTS "ResellerCreditTransaction_resellerProfileId_idx";
CREATE INDEX "ResellerCreditTransaction_resellerProfileId_status_createdAt_idx" ON "ResellerCreditTransaction"("resellerProfileId", "status", "createdAt");
