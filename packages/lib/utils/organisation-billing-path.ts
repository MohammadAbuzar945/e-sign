export type OrganisationBillingAssociationSource =
  | 'AFFILIATE_VISIT'
  | 'AFFILIATE_SIGNUP'
  | 'AFFILIATE_PURCHASE'
  | 'CUSTOMER_CONSENT'
  | null;

export type OrganisationBillingAttributionLike = {
  associationSource: OrganisationBillingAssociationSource;
  stickyBillingActive: boolean;
  stickyBillingOptIn?: boolean;
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

  // Affiliate-linked billing follows the /r sticky opt-in toggle.
  // Signup defaults ON; visit/purchase default OFF until the buyer opts in.
  // Reseller organisations always use Nomia price-plan (never another reseller's /r).
  const isStickyOptIn =
    billingAttribution.stickyBillingOptIn ??
    billingAttribution.associationSource === 'AFFILIATE_SIGNUP';

  const shouldUseAffiliateBilling =
    !billingAttribution.isResellerOrganisation &&
    isStickyOptIn &&
    Boolean(billingAttribution.affiliateSlug);

  if (shouldUseAffiliateBilling && billingAttribution.affiliateSlug) {
    return `/r/${billingAttribution.affiliateSlug}`;
  }

  return defaultPath;
};
