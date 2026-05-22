-- Add organisationId column to UserCredits table
ALTER TABLE "UserCredits" ADD COLUMN "organisationId" TEXT;

-- Migrate existing data: assign credits to user's personal organisation
UPDATE "UserCredits" uc
SET "organisationId" = (
  SELECT o.id
  FROM "Organisation" o
  WHERE o."ownerUserId" = uc."userId"
    AND o.type = 'PERSONAL'
  LIMIT 1
)
WHERE "organisationId" IS NULL;

-- Make organisationId required (NOT NULL)
ALTER TABLE "UserCredits" ALTER COLUMN "organisationId" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "UserCredits" ADD CONSTRAINT "UserCredits_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add index on organisationId
CREATE INDEX "UserCredits_organisationId_idx" ON "UserCredits"("organisationId");

-- Add composite index for organisationId and isActive
CREATE INDEX "UserCredits_organisationId_isActive_idx" ON "UserCredits"("organisationId", "isActive");
