-- Ensure the shared platform invoice counter exists.
-- Earlier migrations only inserted a seed when at least one completed invoice
-- was backfilled (WHERE max_seq IS NOT NULL), leaving allocate-invoice-number
-- unable to increment on an empty InvoiceNumberSequence table.

INSERT INTO "InvoiceNumberSequence" ("id", "prefix", "sellerKey", "dateKey", "nextValue")
SELECT
  'c' || substr(md5(random()::text || clock_timestamp()::text || 'platform-all-ensure'), 1, 24),
  'INV',
  'platform',
  'ALL',
  COALESCE(
    (
      SELECT MAX(seq)
      FROM (
        SELECT CAST(substring("invoiceNumber" FROM 14) AS INTEGER) AS seq
        FROM "OrganisationCreditPurchase"
        WHERE "invoiceNumber" IS NOT NULL
          AND "invoiceNumber" ~ '^NOM-[0-9]{8}-[0-9]+$'

        UNION ALL

        SELECT CAST(substring("invoiceNumber" FROM 13) AS INTEGER) AS seq
        FROM "ResellerCreditTransaction"
        WHERE "invoiceNumber" IS NOT NULL
          AND "invoiceNumber" ~ '^RS-[0-9]{8}-[0-9]+$'
      ) AS parsed
    ),
    0
  )
ON CONFLICT ("prefix", "sellerKey", "dateKey")
DO UPDATE SET
  "nextValue" = GREATEST(
    "InvoiceNumberSequence"."nextValue",
    EXCLUDED."nextValue"
  );
