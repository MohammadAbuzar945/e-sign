-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN "kbaSettings" JSONB;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN "kbaSettings" JSONB;

-- Backfill organisation defaults (disabled KBA with standard limits)
UPDATE "OrganisationGlobalSettings"
SET "kbaSettings" = '{"mode":"PER_ENVELOPE","isEnabled":false,"maxAttempts":5,"lockoutMinutes":15}'::jsonb
WHERE "kbaSettings" IS NULL;
