import { describe, expect, it } from 'vitest';

import { resolveOrganisationBillingPath } from './organisation-billing-path';

describe('resolveOrganisationBillingPath', () => {
  it('returns affiliate signup billing when sticky billing is active', () => {
    expect(
      resolveOrganisationBillingPath({
        organisationUrl: 'org_daehrocszuiiiftr',
        billingAttribution: {
          associationSource: 'AFFILIATE_SIGNUP',
          stickyBillingActive: true,
          affiliateSlug: 'devvv',
          isResellerOrganisation: false,
        },
      }),
    ).toBe('/r/devvv');
  });

  it('returns price-plan for affiliate visit', () => {
    expect(
      resolveOrganisationBillingPath({
        organisationUrl: 'org_daehrocszuiiiftr',
        billingAttribution: {
          associationSource: 'AFFILIATE_VISIT',
          stickyBillingActive: true,
          affiliateSlug: 'devvv',
          isResellerOrganisation: false,
        },
      }),
    ).toBe('/o/org_daehrocszuiiiftr/price-plan');
  });

  it('returns price-plan for reseller organisations', () => {
    expect(
      resolveOrganisationBillingPath({
        organisationUrl: 'org_tlxruvlefzthnvwz',
        billingAttribution: {
          associationSource: 'AFFILIATE_SIGNUP',
          stickyBillingActive: true,
          affiliateSlug: 'devvv',
          isResellerOrganisation: true,
        },
      }),
    ).toBe('/o/org_tlxruvlefzthnvwz/price-plan');
  });
});
