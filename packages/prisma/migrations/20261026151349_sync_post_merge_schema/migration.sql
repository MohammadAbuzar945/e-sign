-- CreateIndex
CREATE INDEX IF NOT EXISTS "Folder_type_idx" ON "Folder"("type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_organisationId_key" ON "Subscription"("organisationId");

-- RenameIndex (only if old name still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'ResellerCreditTransaction_purchaserOrganisationId_status_create'
  ) THEN
    ALTER INDEX "ResellerCreditTransaction_purchaserOrganisationId_status_create"
      RENAME TO "ResellerCreditTransaction_purchaserOrganisationId_status_cr_idx";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'ResellerCreditTransaction_resellerProfileId_status_createdAt_id'
  ) THEN
    ALTER INDEX "ResellerCreditTransaction_resellerProfileId_status_createdAt_id"
      RENAME TO "ResellerCreditTransaction_resellerProfileId_status_createdA_idx";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'ResellerProfileBulkRateTier_resellerProfileId_isEnabled_minCred'
  ) THEN
    ALTER INDEX "ResellerProfileBulkRateTier_resellerProfileId_isEnabled_minCred"
      RENAME TO "ResellerProfileBulkRateTier_resellerProfileId_isEnabled_min_idx";
  END IF;
END $$;
