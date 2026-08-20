/**
 * Credit usage CSV download is limited to a small set of internal users.
 * Access is granted when the user's email contains any of the keywords below
 * (case-insensitive).
 */
export const CREDIT_USAGE_DOWNLOAD_ALLOWED_EMAIL_KEYWORDS = [
  'abuzar',
  'nomiacreator',
  'nomiadeveloper',
] as const;

export const canDownloadCreditUsage = (email?: string | null): boolean => {
  if (!email) {
    return false;
  }

  const normalizedEmail = email.toLowerCase();

  return CREDIT_USAGE_DOWNLOAD_ALLOWED_EMAIL_KEYWORDS.some((keyword) =>
    normalizedEmail.includes(keyword),
  );
};
