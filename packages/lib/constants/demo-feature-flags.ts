/**
 * Temporary demo visibility toggles.
 * Set a flag to `true` to re-enable that feature after your demo.
 *
 * Full inventory + removal checklist:
 * docs/RESELLER-DEMO-RESTRICTIONS.md
 *
 * Later: ask to "remove all reseller demo restrictions" using that doc.
 */
import { NEXT_PUBLIC_WEBAPP_URL } from './app';
import { isResellerFeatureAllowedEmail } from './esign-credit-packages';
import { AppError, AppErrorCode } from '../errors/app-error';

export const DEMO_FEATURE_VISIBILITY = {
  RESELLER_USER_FACING: true,
  ADMIN_RESELLERS: true,
  ADMIN_BULK_RATES: true,
  ADMIN_PAYSTACK_WEBHOOKS: true,
  /**
   * When true, invoice history / PDF / sales history is open to all owners.
   * When false, only `canAccessResellerDemoExtras` emails get real history.
   */
  INVOICE_HISTORY: true,
  OWN_PAYSTACK_PAYOUT: false,
  /**
   * When true, checkout/buy works for everyone.
   * When false, only allowlisted demo extras emails can complete purchases.
   */
  RESELLER_CHECKOUT: true,
  /**
   * When true, admin demo extras (Paystack webhooks, negative credits,
   * delinquency tools, invoice emails) are open to any signed-in user.
   * When false, only allowlisted emails.
   * Note: bulk rates / bulk inventory are localhost-only via `canAccessResellerBulkTools`.
   */
  RESELLER_DEMO_EXTRAS: true,
  /**
   * When true, credits-used and signup-tenure eligibility checks are bypassed
   * for every signed-in user (testing only). Active application / existing profile
   * still block re-apply.
   */
  RESELLER_ELIGIBILITY_BYPASS: true,
} as const;

export type DemoFeatureFlag = keyof typeof DEMO_FEATURE_VISIBILITY;

export const isDemoFeatureVisible = (feature: DemoFeatureFlag): boolean =>
  DEMO_FEATURE_VISIBILITY[feature];

const isLocalHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase();

  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]' ||
    normalized === '::1'
  );
};

/**
 * True for local development so bulk rates / inventory stay available while testing.
 * Prefer `NEXT_PUBLIC_WEBAPP_URL` (e.g. http://localhost:3000), then NODE_ENV / browser host.
 */
export const isLocalWebappEnvironment = () => {
  try {
    if (isLocalHostname(new URL(NEXT_PUBLIC_WEBAPP_URL()).hostname)) {
      return true;
    }
  } catch {
    // fall through
  }

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  if (typeof window !== 'undefined' && isLocalHostname(window.location.hostname)) {
    return true;
  }

  return false;
};

/**
 * Admin bulk rates/purchases + reseller bulk inventory UI/API.
 * Localhost only — hidden on staging/production.
 */
export const canAccessResellerBulkTools = () => isLocalWebappEnvironment();

export const assertResellerBulkToolsAccess = () => {
  if (!canAccessResellerBulkTools()) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: RESELLER_DEMO_EXTRAS_DENIED_MESSAGE,
    });
  }
};

/**
 * Restricted demo extras (Paystack admin, accounts testing tools,
 * invoice emails when flags are off, etc.).
 *
 * General reseller programme (apply / settings / storefront) is NOT gated by this.
 * Bulk rates / inventory use `canAccessResellerBulkTools` instead.
 */
export const canAccessResellerDemoExtras = (email?: string | null) => {
  if (!email?.trim()) {
    return false;
  }

  if (isDemoFeatureVisible('RESELLER_DEMO_EXTRAS')) {
    return true;
  }

  return isResellerFeatureAllowedEmail(email);
};

export const RESELLER_DEMO_EXTRAS_DENIED_MESSAGE =
  'This reseller feature is not available for your account yet.';

export const assertResellerDemoExtrasAccess = (email: string | null | undefined) => {
  if (!canAccessResellerDemoExtras(email)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: RESELLER_DEMO_EXTRAS_DENIED_MESSAGE,
    });
  }
};

/**
 * Live checkout / buy buttons.
 * Open to everyone when RESELLER_CHECKOUT is true; otherwise allowlisted only.
 */
export const canAccessResellerCheckout = (email?: string | null) => {
  if (isDemoFeatureVisible('RESELLER_CHECKOUT')) {
    return true;
  }

  return canAccessResellerDemoExtras(email);
};

export const assertResellerCheckoutAccess = (email: string | null | undefined) => {
  if (!canAccessResellerCheckout(email)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: RESELLER_DEMO_EXTRAS_DENIED_MESSAGE,
    });
  }
};

/**
 * Purchase invoice history / PDF download access.
 * Allowlisted emails always have access; everyone else only when INVOICE_HISTORY is enabled.
 */
export const canAccessInvoiceHistory = (email?: string | null) => {
  if (isDemoFeatureVisible('INVOICE_HISTORY')) {
    return true;
  }

  return canAccessResellerDemoExtras(email);
};
