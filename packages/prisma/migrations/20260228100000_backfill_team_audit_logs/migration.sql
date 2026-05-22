-- Backfill TeamAuditLog with TEAM_CREATED and TEAM_MEMBER_ADDED for existing teams.
-- Idempotent: only inserts where matching log entries do not already exist.
-- IDs use same format as Prisma @default(cuid()): 'c' + 24 alphanumeric chars (via nanoid from add_id_generator).

-- 1) TEAM_CREATED for teams that have no such log
INSERT INTO "TeamAuditLog" ("id", "teamId", "createdAt", "type", "data", "name", "email", "userId", "userAgent", "ipAddress")
SELECT
  'c' || nanoid(24, '0123456789abcdefghijklmnopqrstuvwxyz', 1.6),
  t.id,
  t."createdAt",
  'TEAM_CREATED',
  jsonb_build_object(
    'teamId', t.id,
    'teamName', t.name,
    'organisationId', t."organisationId",
    'isPrivate', COALESCE(t."isPrivate", false),
    'createdByUserId', null
  ),
  null,
  null,
  null,
  null,
  null
FROM "Team" t
WHERE NOT EXISTS (
  SELECT 1 FROM "TeamAuditLog" a
  WHERE a."teamId" = t.id AND a."type" = 'TEAM_CREATED'
);

-- 2) TEAM_MEMBER_ADDED for each current team member that has no such log.
--    Membership is via Team -> TeamGroup -> OrganisationGroupMember -> OrganisationMember -> User.
--    One row per (team, user); role is the "highest" (ADMIN > MANAGER > MEMBER) when user is in multiple groups.
--    createdAt is team.createdAt + offset so entries appear after TEAM_CREATED.
WITH team_members AS (
  SELECT DISTINCT ON (t.id, om."userId")
    t.id AS team_id,
    t."createdAt" AS team_created_at,
    om."userId" AS member_user_id,
    u.email AS member_email,
    tg."teamRole" AS team_role
  FROM "Team" t
  JOIN "TeamGroup" tg ON tg."teamId" = t.id
  JOIN "OrganisationGroupMember" ogm ON ogm."groupId" = tg."organisationGroupId"
  JOIN "OrganisationMember" om ON om.id = ogm."organisationMemberId"
  JOIN "User" u ON u.id = om."userId"
  ORDER BY t.id, om."userId",
    (CASE tg."teamRole" WHEN 'ADMIN' THEN 1 WHEN 'MANAGER' THEN 2 WHEN 'MEMBER' THEN 3 END)
),
members_without_log AS (
  SELECT tm.*,
    row_number() OVER (PARTITION BY tm.team_id ORDER BY tm.member_user_id) AS rn
  FROM team_members tm
  WHERE NOT EXISTS (
    SELECT 1 FROM "TeamAuditLog" a
    WHERE a."teamId" = tm.team_id
      AND a."type" = 'TEAM_MEMBER_ADDED'
      AND (a.data->>'memberUserId') IS NOT DISTINCT FROM tm.member_user_id::text
  )
)
INSERT INTO "TeamAuditLog" ("id", "teamId", "createdAt", "type", "data", "name", "email", "userId", "userAgent", "ipAddress")
SELECT
  'c' || nanoid(24, '0123456789abcdefghijklmnopqrstuvwxyz', 1.6),
  m.team_id,
  m.team_created_at + ((m.rn::text || ' seconds')::interval),
  'TEAM_MEMBER_ADDED',
  jsonb_build_object(
    'memberUserId', m.member_user_id,
    'memberEmail', m.member_email,
    'teamRole', m.team_role,
    'source', 'ORG_INHERIT'
  ),
  null,
  null,
  null,
  null,
  null
FROM members_without_log m;
