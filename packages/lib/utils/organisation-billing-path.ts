export type OrganisationBillingAttributionLike = {
  associationSource:
    | 'AFFILIATE_VISIT'
    | 'AFFILIATE_SIGNUP'
    | 'AFFILIATE_PURCHASE'
    | 'CUSTOMER_CONSENT'
    | null;
  stickyBillingActive: boolean;
  affiliateSlug: string | null;
  isResellerOrganisation: boolean;
};

export const resolveOrganisationBillingPath = ({
  organisationUrl,
  billingAttribution,
}: {
  organisationUrl: string;
  billingAttribution: OrganisationBillingAttributionLike | null | undefined;
}) => {
  const defaultPath = `/o/${organisationUrl}/price-plan`;

  if (!billingAttribution) {
    return defaultPath;
  }

  // Affiliate-signup customers always use the reseller /r billing page when associated.
  // Do not gate on stickyBillingActive (payout readiness) — /r handles unavailable resellers.
  const shouldUseAffiliateSignupBilling =
    !billingAttribution.isResellerOrganisation &&
    billingAttribution.associationSource === 'AFFILIATE_SIGNUP' &&
    Boolean(billingAttribution.affiliateSlug);

  if (shouldUseAffiliateSignupBilling && billingAttribution.affiliateSlug) {
    return `/r/${billingAttribution.affiliateSlug}`;
  }

  return defaultPath;
};
