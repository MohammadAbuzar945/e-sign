/**
 * Temporary demo visibility toggles.
 * Set a flag to `true` to re-enable that feature after your demo.
 */
import { isResellerFeatureAllowedEmail } from './esign-credit-packages';

export const DEMO_FEATURE_VISIBILITY = {
  RESELLER_USER_FACING: true,
  ADMIN_RESELLERS: true,
  ADMIN_BULK_RATES: true,
  ADMIN_PAYSTACK_WEBHOOKS: true,
  /** When true, invoice history is open to all owners. When false, allowlisted emails only. */
  INVOICE_HISTORY: false,
  OWN_PAYSTACK_PAYOUT: false,
} as const;

export type DemoFeatureFlag = keyof typeof DEMO_FEATURE_VISIBILITY;

export const isDemoFeatureVisible = (feature: DemoFeatureFlag): boolean =>
  DEMO_FEATURE_VISIBILITY[feature];

/**
 * Purchase invoice history / PDF download access.
 * Allowlisted emails always have access; everyone else only when INVOICE_HISTORY is enabled.
 */
export const canAccessInvoiceHistory = (email?: string | null) => {
  if (isDemoFeatureVisible('INVOICE_HISTORY')) {
    return true;
  }

  if (!email) {
    return false;
  }

  return isResellerFeatureAllowedEmail(email);
};
