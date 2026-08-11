/**
 * Temporary allowlist for EMAIL_FAILED document audit logs.
 * Expand or remove once the feature is ready for all users.
 */
export const EMAIL_FAILED_AUDIT_LOG_VIEWERS = [
  'nomiadeveloper@gmail.com',
  'awanabuzar945@gmail.com',
] as const;

export const canViewEmailFailedAuditLogs = (email?: string | null): boolean => {
  if (!email?.trim()) {
    return false;
  }

  const normalisedEmail = email.trim().toLowerCase();

  return EMAIL_FAILED_AUDIT_LOG_VIEWERS.some((allowedEmail) => allowedEmail === normalisedEmail);
};
