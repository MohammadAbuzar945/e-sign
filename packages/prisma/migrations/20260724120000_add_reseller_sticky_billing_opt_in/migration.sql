-- Sticky billing preference for affiliate-linked organisations.
-- AFFILIATE_SIGNUP buyers default ON; everyone else stays OFF until they opt in on /r.

ALTER TABLE "Organisation"
ADD COLUMN "resellerStickyBillingOptIn" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Organisation"
SET "resellerStickyBillingOptIn" = true
WHERE "resellerAssociationSource" = 'AFFILIATE_SIGNUP';
