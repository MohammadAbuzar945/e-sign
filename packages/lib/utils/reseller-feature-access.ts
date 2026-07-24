/**
 * @deprecated General reseller programme is no longer email-gated.
 * Use `assertResellerDemoExtrasAccess` from demo-feature-flags for restricted extras only.
 * Kept as a no-op so older call sites do not block the programme.
 */
export const RESELLER_FEATURE_ACCESS_DENIED_MESSAGE =
  'The reseller program is not available for your account.';

export const assertResellerFeatureAccess = (_email: string | null | undefined) => {
  // Intentionally empty — reseller programme is open; gate extras via
  // assertResellerDemoExtrasAccess / assertResellerCheckoutAccess instead.
};
