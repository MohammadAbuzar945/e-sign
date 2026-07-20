/**
 * Temporary demo visibility toggles.
 * Set a flag to `true` to re-enable that feature after your demo.
 */
export const DEMO_FEATURE_VISIBILITY = {
  RESELLER_USER_FACING: false,
  ADMIN_RESELLERS: true,
  ADMIN_BULK_RATES: false,
  ADMIN_PAYSTACK_WEBHOOKS: false,
} as const;

export type DemoFeatureFlag = keyof typeof DEMO_FEATURE_VISIBILITY;

export const isDemoFeatureVisible = (feature: DemoFeatureFlag): boolean =>
  DEMO_FEATURE_VISIBILITY[feature];
