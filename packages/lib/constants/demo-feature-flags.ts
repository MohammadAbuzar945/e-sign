/**
 * Temporary demo visibility toggles.
 * Set a flag to `true` to re-enable that feature after your demo.
 *
 * Full inventory + removal checklist:
 * docs/RESELLER-DEMO-RESTRICTIONS.md
 *
 * Later: ask to "remove all reseller demo restrictions" using that doc.
 */
import { AppError, AppErrorCode } from '../errors/app-error';

export const DEMO_FEATURE_VISIBILITY = {
  RESELLER_USER_FACING: true,
  ADMIN_RESELLERS: true,
  ADMIN_BULK_RATES: true,
  ADMIN_PAYSTACK_WEBHOOKS: true,
  /**
   * When true, invoice history / PDF / sales history is open to all owners.
   * When false, access is denied.
   */
  INVOICE_HISTORY: true,
  OWN_PAYSTACK_PAYOUT: false,
  /**
   * When true, checkout/buy works for everyone.
   * When false, access is denied.
   */
  RESELLER_CHECKOUT: true,
  /**
   * When true, admin demo extras (Paystack webhooks, negative credits,
   * delinquency tools, invoice emails) are open to any signed-in user.
   * When false, access is denied.
   * Bulk rates / bulk inventory use `ADMIN_BULK_RATES` via `canAccessResellerBulkTools`.
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

/**
 * Admin bulk rates/purchases + reseller bulk inventory UI/API.
 * Controlled by `ADMIN_BULK_RATES`.
 */
export const canAccessResellerBulkTools = () => isDemoFeatureVisible('ADMIN_BULK_RATES');

export const assertResellerBulkToolsAccess = () => {
  if (!canAccessResellerBulkTools()) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: RESELLER_DEMO_EXTRAS_DENIED_MESSAGE,
    });
  }
};

/**
 * Restricted demo extras (Paystack admin, accounts testing tools, etc.).
 *
 * General reseller programme (apply / settings / storefront) is NOT gated by this.
 * Bulk rates / inventory use `canAccessResellerBulkTools` instead.
 */
export const canAccessResellerDemoExtras = (email?: string | null) => {
  if (!email?.trim()) {
    return false;
  }

  return isDemoFeatureVisible('RESELLER_DEMO_EXTRAS');
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
 */
export const canAccessResellerCheckout = (_email?: string | null) =>
  isDemoFeatureVisible('RESELLER_CHECKOUT');

export const assertResellerCheckoutAccess = (email: string | null | undefined) => {
  if (!canAccessResellerCheckout(email)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: RESELLER_DEMO_EXTRAS_DENIED_MESSAGE,
    });
  }
};

/**
 * Purchase invoice history / PDF download access.
 */
export const canAccessInvoiceHistory = (_email?: string | null) =>
  isDemoFeatureVisible('INVOICE_HISTORY');

/**
 * Admin reseller Email / Notify broadcast — email allowlist only.
 */
const RESELLER_NOTIFY_ALLOWED_EMAILS = new Set(['awanabuzar945@gmail.com']);

export const canAccessResellerNotify = (email?: string | null) => {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  return RESELLER_NOTIFY_ALLOWED_EMAILS.has(normalizedEmail);
};

export const assertResellerNotifyAccess = (email: string | null | undefined) => {
  if (!canAccessResellerNotify(email)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: RESELLER_DEMO_EXTRAS_DENIED_MESSAGE,
    });
  }
};

