export const AFFILIATE_SLUG_MIN_LENGTH = 3;
export const AFFILIATE_SLUG_MAX_LENGTH = 50;

export const RESERVED_AFFILIATE_SLUGS = new Set([
  'admin',
  'api',
  'signin',
  'signup',
  'login',
  'settings',
  'support',
  'www',
  'mail',
  'webhook',
  'paystack',
  'organisations',
  'organisation',
  'team',
  'teams',
  'documents',
  'share',
  'reseller',
  'resellers',
]);

export const normalizeAffiliateSlugInput = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

export type AffiliateSlugValidationResult =
  | { valid: true; slug: string }
  | { valid: false; message: string };

export const validateAffiliateSlug = (value: string): AffiliateSlugValidationResult => {
  const slug = normalizeAffiliateSlugInput(value);

  if (!slug) {
    return { valid: false, message: 'Affiliate URL is required.' };
  }

  if (slug.length < AFFILIATE_SLUG_MIN_LENGTH) {
    return {
      valid: false,
      message: `Affiliate URL must be at least ${AFFILIATE_SLUG_MIN_LENGTH} characters.`,
    };
  }

  if (slug.length > AFFILIATE_SLUG_MAX_LENGTH) {
    return {
      valid: false,
      message: `Affiliate URL must be ${AFFILIATE_SLUG_MAX_LENGTH} characters or fewer.`,
    };
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return {
      valid: false,
      message:
        'Affiliate URL can only contain lowercase letters, numbers, and hyphens. It must start and end with a letter or number.',
    };
  }

  if (RESERVED_AFFILIATE_SLUGS.has(slug)) {
    return {
      valid: false,
      message: 'This affiliate URL is reserved. Please choose another.',
    };
  }

  return { valid: true, slug };
};

export const getSuggestedAffiliateSlug = (orgUrl: string) => {
  const validation = validateAffiliateSlug(orgUrl);

  if (validation.valid) {
    return validation.slug;
  }

  return '';
};

export const buildAffiliateUrl = (slug: string, baseUrl: string) => {
  const base = baseUrl.replace(/\/$/, '');

  return `${base}/r/${slug}`;
};
