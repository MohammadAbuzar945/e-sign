/**
 * Client-safe constants for team audit log exports.
 * Do not add server-only imports here.
 */

export const TEAM_AUDIT_LOG_EXPORT_DATE_RANGES = [
  '1_WEEK',
  '30_DAYS',
  '90_DAYS',
  'ALL_TIME',
] as const;

export type TTeamAuditLogExportDateRange =
  (typeof TEAM_AUDIT_LOG_EXPORT_DATE_RANGES)[number];
