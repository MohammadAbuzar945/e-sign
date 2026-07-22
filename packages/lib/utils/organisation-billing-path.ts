export type OrganisationBillingAssociationSource =
  | 'AFFILIATE_VISIT'
  | 'AFFILIATE_SIGNUP'
  | 'AFFILIATE_PURCHASE'
  | 'CUSTOMER_CONSENT'
  | null;

export type OrganisationBillingAttributionLike = {
  associationSource: OrganisationBillingAssociationSource;
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

  // Only AFFILIATE_SIGNUP customers use the reseller /r billing page.
  // Do not gate on stickyBillingActive — /r handles unavailable resellers.
  // AFFILIATE_VISIT / PURCHASE / CONSENT stay on Nomia price-plan.
  const shouldUseAffiliateSignupBilling =
    !billingAttribution.isResellerOrganisation &&
    billingAttribution.associationSource === 'AFFILIATE_SIGNUP' &&
    Boolean(billingAttribution.affiliateSlug);

  if (shouldUseAffiliateSignupBilling && billingAttribution.affiliateSlug) {
    return `/r/${billingAttribution.affiliateSlug}`;
  }

  return defaultPath;
};
