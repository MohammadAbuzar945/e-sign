-- Sequential display invoice numbers (NOM-/RS-YYYYMMDD-NNN).

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

-- Backfill Nomia completed purchases (platform-wide per UTC day).
WITH ordered AS (
  SELECT
    id,
    to_char((COALESCE("completedAt", "createdAt") AT TIME ZONE 'UTC'), 'YYYYMMDD') AS date_key,
    ROW_NUMBER() OVER (
      PARTITION BY to_char((COALESCE("completedAt", "createdAt") AT TIME ZONE 'UTC'), 'YYYYMMDD')
      ORDER BY COALESCE("completedAt", "createdAt"), id
    ) AS seq
  FROM "OrganisationCreditPurchase"
  WHERE status = 'COMPLETED'
    AND "invoiceNumber" IS NULL
)
UPDATE "OrganisationCreditPurchase" AS p
SET "invoiceNumber" = 'NOM-' || o.date_key || '-' || lpad(o.seq::text, 3, '0')
FROM ordered AS o
WHERE p.id = o.id;

-- Backfill reseller completed transactions (per reseller org per UTC day).
WITH ordered AS (
  SELECT
    id,
    "resellerOrganisationId",
    to_char((COALESCE("completedAt", "createdAt") AT TIME ZONE 'UTC'), 'YYYYMMDD') AS date_key,
    ROW_NUMBER() OVER (
      PARTITION BY
        "resellerOrganisationId",
        to_char((COALESCE("completedAt", "createdAt") AT TIME ZONE 'UTC'), 'YYYYMMDD')
      ORDER BY COALESCE("completedAt", "createdAt"), id
    ) AS seq
  FROM "ResellerCreditTransaction"
  WHERE status = 'COMPLETED'
    AND "invoiceNumber" IS NULL
)
UPDATE "ResellerCreditTransaction" AS t
SET "invoiceNumber" = 'RS-' || o.date_key || '-' || lpad(o.seq::text, 3, '0')
FROM ordered AS o
WHERE t.id = o.id;

-- Seed sequence counters so new allocations continue after backfill.
INSERT INTO "InvoiceNumberSequence" ("id", "prefix", "sellerKey", "dateKey", "nextValue")
SELECT
  'c' || substr(md5(random()::text || clock_timestamp()::text || n.date_key), 1, 24),
  'NOM',
  'nomia',
  n.date_key,
  n.max_seq
FROM (
  SELECT
    substring("invoiceNumber" FROM 5 FOR 8) AS date_key,
    MAX(CAST(substring("invoiceNumber" FROM 14) AS INTEGER)) AS max_seq
  FROM "OrganisationCreditPurchase"
  WHERE "invoiceNumber" IS NOT NULL
    AND "invoiceNumber" ~ '^NOM-[0-9]{8}-[0-9]+$'
  GROUP BY substring("invoiceNumber" FROM 5 FOR 8)
) AS n
ON CONFLICT ("prefix", "sellerKey", "dateKey")
DO UPDATE SET "nextValue" = GREATEST(
  "InvoiceNumberSequence"."nextValue",
  EXCLUDED."nextValue"
);

INSERT INTO "InvoiceNumberSequence" ("id", "prefix", "sellerKey", "dateKey", "nextValue")
SELECT
  'c' || substr(md5(random()::text || clock_timestamp()::text || r.seller_key || r.date_key), 1, 24),
  'RS',
  r.seller_key,
  r.date_key,
  r.max_seq
FROM (
  SELECT
    "resellerOrganisationId" AS seller_key,
    substring("invoiceNumber" FROM 4 FOR 8) AS date_key,
    MAX(CAST(substring("invoiceNumber" FROM 13) AS INTEGER)) AS max_seq
  FROM "ResellerCreditTransaction"
  WHERE "invoiceNumber" IS NOT NULL
    AND "invoiceNumber" ~ '^RS-[0-9]{8}-[0-9]+$'
  GROUP BY "resellerOrganisationId", substring("invoiceNumber" FROM 4 FOR 8)
) AS r
ON CONFLICT ("prefix", "sellerKey", "dateKey")
DO UPDATE SET "nextValue" = GREATEST(
  "InvoiceNumberSequence"."nextValue",
  EXCLUDED."nextValue"
);
