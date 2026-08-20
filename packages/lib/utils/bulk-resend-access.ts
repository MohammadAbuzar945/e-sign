/**
 * Bulk resend is currently limited to a small set of internal users while the
 * feature is being validated. Access is granted when the user's email contains
 * any of the keywords below (case-insensitive).
 */
export const BULK_RESEND_ALLOWED_EMAIL_KEYWORDS = [
  'abuzar',
  'nomiacreator',
  'nomiadeveloper',
] as const;

export const canUserBulkResend = (email?: string | null): boolean => {
  if (!email) {
    return false;
  }

  const normalizedEmail = email.toLowerCase();

  return BULK_RESEND_ALLOWED_EMAIL_KEYWORDS.some((keyword) =>
    normalizedEmail.includes(keyword),
  );
};
