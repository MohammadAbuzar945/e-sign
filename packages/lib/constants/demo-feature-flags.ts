/**
 * Temporary demo visibility toggles.
 * Set a flag to `true` to re-enable that feature after your demo.
 *
 * Full inventory + removal checklist:
 * docs/RESELLER-DEMO-RESTRICTIONS.md
 *
 * Later: ask to "remove all reseller demo restrictions" using that doc.
 */
import { isResellerFeatureAllowedEmail } from './esign-credit-packages';
import { AppError, AppErrorCode } from '../errors/app-error';

export const DEMO_FEATURE_VISIBILITY = {
  RESELLER_USER_FACING: true,
  ADMIN_RESELLERS: true,
  ADMIN_BULK_RATES: true,
  ADMIN_PAYSTACK_WEBHOOKS: true,
  /**
   * When true, invoice history / PDF is open to all owners.
   * When false, only `canAccessResellerDemoExtras` emails get real history;
   * everyone else sees Coming soon on the history link.
   */
  INVOICE_HISTORY: false,
  OWN_PAYSTACK_PAYOUT: false,
  /**
   * When true, checkout/buy and bulk inventory work for everyone.
   * When false, only allowlisted demo extras emails can complete purchases.
   */
  RESELLER_CHECKOUT: false,
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
 * Restricted demo extras (bulk inventory UI, admin bulk rates/purchases,
 * Paystack admin, accounts testing tools, live checkout, invoice emails,
 * real purchase-history content).
 *
 * General reseller programme (apply / settings / storefront) is NOT gated by this.
 */
export const canAccessResellerDemoExtras = (email?: string | null) => {
  if (!email) {
    return false;
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
