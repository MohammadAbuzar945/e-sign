import { describe, expect, it } from 'vitest';

import { resolveOrganisationBillingPath } from './organisation-billing-path';

describe('resolveOrganisationBillingPath', () => {
  it('returns affiliate signup billing when associated with a reseller', () => {
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

  it('returns affiliate signup billing even when sticky billing is not active yet', () => {
    expect(
      resolveOrganisationBillingPath({
        organisationUrl: 'org_oetkmdoeabdxciae',
        billingAttribution: {
          associationSource: 'AFFILIATE_SIGNUP',
          stickyBillingActive: false,
          affiliateSlug: 'acme-reseller',
          isResellerOrganisation: false,
        },
      }),
    ).toBe('/r/acme-reseller');
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
