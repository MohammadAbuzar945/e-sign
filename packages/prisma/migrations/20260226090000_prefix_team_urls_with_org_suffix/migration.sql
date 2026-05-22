-- Append last 5 characters of organisationId as prefix to existing team URLs.
-- New format: {orgSuffix}-{oldTeamUrl}
-- orgSuffix is the last 5 characters of Organisation.id

UPDATE "Team" AS t
SET "url" = CONCAT(RIGHT(o."id", 5), '-', t."url")
FROM "Organisation" AS o
WHERE t."organisationId" = o."id"
  -- Only update teams that don't already have the suffix-based prefix applied.
  AND t."url" NOT LIKE RIGHT(o."id", 5) || '-%';

