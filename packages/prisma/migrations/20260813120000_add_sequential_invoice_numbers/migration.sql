-- Sequential display invoice numbers (NOM-/RS-YYYYMMDD-NNN).
-- One platform-wide continuous sequence shared by Nomia and all resellers.
-- Prefix = issuer (NOM|RS); date = issue day; number never resets.

CREATE TABLE "InvoiceNumberSequence" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "sellerKey" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InvoiceNumberSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceNumberSequence_prefix_sellerKey_dateKey_key"
  ON "InvoiceNumberSequence"("prefix", "sellerKey", "dateKey");

ALTER TABLE "OrganisationCreditPurchase" ADD COLUMN "invoiceNumber" TEXT;
CREATE UNIQUE INDEX "OrganisationCreditPurchase_invoiceNumber_key"
  ON "OrganisationCreditPurchase"("invoiceNumber");

ALTER TABLE "ResellerCreditTransaction" ADD COLUMN "invoiceNumber" TEXT;
CREATE UNIQUE INDEX "ResellerCreditTransaction_invoiceNumber_key"
  ON "ResellerCreditTransaction"("invoiceNumber");

-- Number every completed invoice in one continuous platform sequence.
CREATE TEMP TABLE "_invoice_number_backfill" ON COMMIT DROP AS
WITH combined AS (
  SELECT
    'NOM'::text AS prefix,
    id,
    COALESCE("completedAt", "createdAt") AS issued_at
  FROM "OrganisationCreditPurchase"
  WHERE status = 'COMPLETED'
    AND "invoiceNumber" IS NULL

  UNION ALL

  SELECT
    'RS'::text AS prefix,
    id,
    COALESCE("completedAt", "createdAt") AS issued_at
  FROM "ResellerCreditTransaction"
  WHERE status = 'COMPLETED'
    AND "invoiceNumber" IS NULL
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

-- Seed the shared platform counter from the highest backfilled sequence.
INSERT INTO "InvoiceNumberSequence" ("id", "prefix", "sellerKey", "dateKey", "nextValue")
SELECT
  'c' || substr(md5(random()::text || clock_timestamp()::text || 'platform'), 1, 24),
  'INV',
  'platform',
  'ALL',
  m.max_seq
FROM (
  SELECT MAX(seq) AS max_seq
  FROM "_invoice_number_backfill"
) AS m
WHERE m.max_seq IS NOT NULL
ON CONFLICT ("prefix", "sellerKey", "dateKey")
DO UPDATE SET "nextValue" = GREATEST(
  "InvoiceNumberSequence"."nextValue",
  EXCLUDED."nextValue"
);
