-- Backfill Team.creditConsumed from existing completed documents.
-- Credits = count of EnvelopeItem per document (same logic as seal-document handler).
-- Only DOCUMENT type envelopes with status COMPLETED are counted (REJECTED excluded).
-- Teams with no completed documents are set to 0.

UPDATE "Team" t
SET "creditConsumed" = COALESCE(
  (
    SELECT SUM(ic.cnt)::integer
    FROM "Envelope" e
    INNER JOIN (
      SELECT "envelopeId", COUNT(*)::integer AS cnt
      FROM "EnvelopeItem"
      GROUP BY "envelopeId"
    ) ic ON ic."envelopeId" = e.id
    WHERE e."teamId" = t.id
      AND e.type = 'DOCUMENT'
      AND e.status = 'COMPLETED'
  ),
  0
);
