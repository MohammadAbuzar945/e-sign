-- Immutable organisation credit-usage ledger.
-- Snapshot team/document ids are stored without foreign keys so usage survives moves/deletes.
CREATE TABLE "OrganisationCreditUsage" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organisationId" TEXT NOT NULL,
  "teamId" INTEGER NOT NULL,
  "documentId" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,

  CONSTRAINT "OrganisationCreditUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganisationCreditUsage_documentId_key"
ON "OrganisationCreditUsage"("documentId");

CREATE INDEX "OrganisationCreditUsage_organisationId_createdAt_idx"
ON "OrganisationCreditUsage"("organisationId", "createdAt");

CREATE INDEX "OrganisationCreditUsage_teamId_createdAt_idx"
ON "OrganisationCreditUsage"("teamId", "createdAt");

ALTER TABLE "OrganisationCreditUsage"
ADD CONSTRAINT "OrganisationCreditUsage_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill reconstructable history from existing completed documents.
INSERT INTO "OrganisationCreditUsage" (
  "id",
  "createdAt",
  "organisationId",
  "teamId",
  "documentId",
  "credits"
)
SELECT
  CONCAT('ocu_backfill_', e.id),
  COALESCE(e."completedAt", e."updatedAt", e."createdAt"),
  t."organisationId",
  e."teamId",
  e.id,
  COUNT(ei.id)::INTEGER
FROM "Envelope" e
INNER JOIN "Team" t ON t.id = e."teamId"
INNER JOIN "EnvelopeItem" ei ON ei."envelopeId" = e.id
WHERE e."type" = 'DOCUMENT'
  AND e."status" = 'COMPLETED'
GROUP BY e.id, e."completedAt", e."updatedAt", e."createdAt", t."organisationId", e."teamId"
ON CONFLICT ("documentId") DO NOTHING;

-- Preserve historical totals that cannot be reconstructed from current documents
-- (for example, if old completed docs were moved away or hard-deleted before the ledger existed).
-- We add one synthetic immutable adjustment row per team for any positive delta.
WITH ledger_totals AS (
  SELECT
    ocu."teamId",
    COALESCE(SUM(ocu."credits"), 0)::INTEGER AS credits
  FROM "OrganisationCreditUsage" ocu
  GROUP BY ocu."teamId"
)
INSERT INTO "OrganisationCreditUsage" (
  "id",
  "createdAt",
  "organisationId",
  "teamId",
  "documentId",
  "credits"
)
SELECT
  CONCAT('ocu_legacy_adjustment_', t.id),
  CURRENT_TIMESTAMP,
  t."organisationId",
  t.id,
  CONCAT('legacy-backfill:', t.id),
  (t."creditConsumed" - COALESCE(lt.credits, 0))::INTEGER
FROM "Team" t
LEFT JOIN ledger_totals lt ON lt."teamId" = t.id
WHERE t."creditConsumed" > COALESCE(lt.credits, 0)
ON CONFLICT ("documentId") DO NOTHING;
