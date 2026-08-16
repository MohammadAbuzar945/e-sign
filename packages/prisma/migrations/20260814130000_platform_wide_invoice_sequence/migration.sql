-- One platform-wide continuous invoice sequence shared by NOM + all RS invoices.
-- Renumbers existing display numbers into that sequence, then enforces global uniqueness.

DROP INDEX IF EXISTS "ResellerCreditTransaction_resellerOrganisationId_invoiceNumber_key";

-- Clear current display numbers so we can assign one continuous platform series.
UPDATE "OrganisationCreditPurchase"
SET "invoiceNumber" = NULL
WHERE "invoiceNumber" IS NOT NULL;

UPDATE "ResellerCreditTransaction"
SET "invoiceNumber" = NULL
WHERE "invoiceNumber" IS NOT NULL;

CREATE TEMP TABLE "_invoice_number_backfill" ON COMMIT DROP AS
WITH combined AS (
  SELECT
    'NOM'::text AS prefix,
    id,
    COALESCE("completedAt", "createdAt") AS issued_at
  FROM "OrganisationCreditPurchase"
  WHERE status = 'COMPLETED'

  UNION ALL

  SELECT
    'RS'::text AS prefix,
    id,
    COALESCE("completedAt", "createdAt") AS issued_at
  FROM "ResellerCreditTransaction"
  WHERE status = 'COMPLETED'
)
SELECT
  prefix,
  id,
  to_char((issued_at AT TIME ZONE 'UTC'), 'YYYYMMDD') AS date_key,
  ROW_NUMBER() OVER (ORDER BY issued_at, prefix, id) AS seq
FROM combined;

UPDATE "OrganisationCreditPurchase" AS p
SET "invoiceNumber" = 'NOM-' || b.date_key || '-' || lpad(b.seq::text, 3, '0')
FROM "_invoice_number_backfill" AS b
WHERE b.prefix = 'NOM'
  AND p.id = b.id;

UPDATE "ResellerCreditTransaction" AS t
SET "invoiceNumber" = 'RS-' || b.date_key || '-' || lpad(b.seq::text, 3, '0')
FROM "_invoice_number_backfill" AS b
WHERE b.prefix = 'RS'
  AND t.id = b.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ResellerCreditTransaction_invoiceNumber_key'
  ) THEN
    CREATE UNIQUE INDEX "ResellerCreditTransaction_invoiceNumber_key"
      ON "ResellerCreditTransaction"("invoiceNumber");
  END IF;
END $$;

-- Shared platform counter.
DELETE FROM "InvoiceNumberSequence";

INSERT INTO "InvoiceNumberSequence" ("id", "prefix", "sellerKey", "dateKey", "nextValue")
SELECT
  'c' || substr(md5(random()::text || clock_timestamp()::text || 'platform-all'), 1, 24),
  'INV',
  'platform',
  'ALL',
  m.max_seq
FROM (
  SELECT MAX(seq) AS max_seq
  FROM "_invoice_number_backfill"
) AS m
WHERE m.max_seq IS NOT NULL;
