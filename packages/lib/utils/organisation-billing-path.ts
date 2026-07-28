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
  // Signup defaults ON for normal buyers; visit/purchase default OFF until opt-in.
  // Reseller organisations stay on Nomia unless they explicitly opt into sticky buy
  // (e.g. a client who became a reseller and still wants to buy from their parent).
  const isStickyOptIn = billingAttribution.isResellerOrganisation
    ? billingAttribution.stickyBillingOptIn === true
    : (billingAttribution.stickyBillingOptIn ??
      billingAttribution.associationSource === 'AFFILIATE_SIGNUP');

  const shouldUseAffiliateBilling =
    isStickyOptIn && Boolean(billingAttribution.affiliateSlug);

  if (shouldUseAffiliateBilling && billingAttribution.affiliateSlug) {
    return `/r/${billingAttribution.affiliateSlug}?orgUrl=${encodeURIComponent(organisationUrl)}`;
  }

  return defaultPath;
};
