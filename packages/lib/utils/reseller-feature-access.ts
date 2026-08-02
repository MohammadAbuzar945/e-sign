import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

/**
 * TEMPORARY email gate for the reseller programme.
 *
 * To reverse / open to everyone: set `RESELLER_EMAIL_GATE_ENABLED` to `false`.
 * No other call-site changes needed — UI and API already go through
 * `hasResellerFeatureAccess` / `assertResellerFeatureAccess`.
 */
export const RESELLER_EMAIL_GATE_ENABLED = true;

/** Exact emails allowed while the gate is on (lowercase). */
export const RESELLER_FEATURE_ALLOWED_EMAILS = [
  'nomiadeveloper@gmail.com',
  'nomiacreator@gmail.com',
] as const;

/** Email domains allowed while the gate is on (lowercase, no @). */
export const RESELLER_FEATURE_ALLOWED_DOMAINS = ['mdmacdonald.com' , 'nomiadocs.com'] as const;

/** If the email local/full address contains any of these (case-insensitive), allow. */
export const RESELLER_FEATURE_ALLOWED_EMAIL_SUBSTRINGS = ['abuzar' , 'nomia'] as const;

export const RESELLER_FEATURE_ACCESS_DENIED_MESSAGE =
  'The reseller program is not available for your account.';

export const isResellerFeatureAllowedEmail = (email: string) => {
  const normalised = email.trim().toLowerCase();

  if (!normalised) {
    return false;
  }

  if ((RESELLER_FEATURE_ALLOWED_EMAILS as readonly string[]).includes(normalised)) {
    return true;
  }

  const domain = normalised.split('@')[1] ?? '';

  if ((RESELLER_FEATURE_ALLOWED_DOMAINS as readonly string[]).includes(domain)) {
    return true;
  }

  return RESELLER_FEATURE_ALLOWED_EMAIL_SUBSTRINGS.some((substring) =>
    normalised.includes(substring.toLowerCase()),
  );
};

/**
 * Whether the signed-in user may see / use reseller programme surfaces.
 * When the gate is disabled, everyone is allowed.
 */
export const hasResellerFeatureAccess = (email: string | null | undefined) => {
  if (!RESELLER_EMAIL_GATE_ENABLED) {
    return true;
  }

  if (!email?.trim()) {
    return false;
  }

  return isResellerFeatureAllowedEmail(email);
};

export const assertResellerFeatureAccess = (email: string | null | undefined) => {
  if (!hasResellerFeatureAccess(email)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: RESELLER_FEATURE_ACCESS_DENIED_MESSAGE,
    });
  }
};
