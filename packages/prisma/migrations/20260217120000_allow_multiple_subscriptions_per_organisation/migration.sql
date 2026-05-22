-- Allow multiple subscription records per organisation by dropping the unique constraint.
-- Prisma schema change: Subscription.organisationId is no longer @unique.

DROP INDEX IF EXISTS "Subscription_organisationId_key";

