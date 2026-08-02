import { describe, expect, it } from 'vitest';

import { resolveOrganisationBillingPath } from './organisation-billing-path';

describe('resolveOrganisationBillingPath', () => {
  it('returns affiliate billing when sticky opt-in is on', () => {
    expect(
      resolveOrganisationBillingPath({
        organisationUrl: 'org_daehrocszuiiiftr',
        billingAttribution: {
          associationSource: 'AFFILIATE_SIGNUP',
          stickyBillingActive: true,
          stickyBillingOptIn: true,
          affiliateSlug: 'devvv',
          isResellerOrganisation: false,
        },
      }),
    ).toBe('/r/devvv?orgUrl=org_daehrocszuiiiftr');
  });

  it('returns price-plan when sticky opt-in is off for signup association', () => {
    expect(
      resolveOrganisationBillingPath({
        organisationUrl: 'org_oetkmdoeabdxciae',
        billingAttribution: {
          associationSource: 'AFFILIATE_SIGNUP',
          stickyBillingActive: true,
          stickyBillingOptIn: false,
          affiliateSlug: 'acme-reseller',
          isResellerOrganisation: false,
        },
      }),
    ).toBe('/o/org_oetkmdoeabdxciae/price-plan');
  });

  it('falls back to affiliate billing for signup when stickyBillingOptIn is omitted', () => {
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
    ).toBe('/r/acme-reseller?orgUrl=org_oetkmdoeabdxciae');
  });

  it('returns affiliate billing when visit association opts in', () => {
    expect(
      resolveOrganisationBillingPath({
        organisationUrl: 'org_buyer',
        billingAttribution: {
          associationSource: 'AFFILIATE_VISIT',
          stickyBillingActive: true,
          stickyBillingOptIn: true,
          affiliateSlug: 'devvv',
          isResellerOrganisation: false,
        },
      }),
    ).toBe('/r/devvv?orgUrl=org_buyer');
  });

  it('returns price-plan for affiliate purchase without opt-in', () => {
    expect(
      resolveOrganisationBillingPath({
        organisationUrl: 'org_buyer',
        billingAttribution: {
          associationSource: 'AFFILIATE_PURCHASE',
          stickyBillingActive: false,
          stickyBillingOptIn: false,
          affiliateSlug: 'devvv',
          isResellerOrganisation: false,
        },
      }),
    ).toBe('/o/org_buyer/price-plan');
  });

  it('returns price-plan for affiliate visit without opt-in', () => {
    expect(
      resolveOrganisationBillingPath({
        organisationUrl: 'org_daehrocszuiiiftr',
        billingAttribution: {
          associationSource: 'AFFILIATE_VISIT',
          stickyBillingActive: true,
          stickyBillingOptIn: false,
          affiliateSlug: 'devvv',
          isResellerOrganisation: false,
        },
      }),
    ).toBe('/o/org_daehrocszuiiiftr/price-plan');
  });

  it('returns price-plan for reseller organisations until they explicitly opt in', () => {
    expect(
      resolveOrganisationBillingPath({
        organisationUrl: 'org_tlxruvlefzthnvwz',
        billingAttribution: {
          associationSource: 'AFFILIATE_SIGNUP',
          stickyBillingActive: true,
          stickyBillingOptIn: false,
          affiliateSlug: 'devvv',
          isResellerOrganisation: true,
        },
      }),
    ).toBe('/o/org_tlxruvlefzthnvwz/price-plan');
  });

  it('returns affiliate billing when a reseller organisation explicitly opts in', () => {
    expect(
      resolveOrganisationBillingPath({
        organisationUrl: 'org_tlxruvlefzthnvwz',
        billingAttribution: {
          associationSource: 'AFFILIATE_SIGNUP',
          stickyBillingActive: true,
          stickyBillingOptIn: true,
          affiliateSlug: 'devvv',
          isResellerOrganisation: true,
        },
      }),
    ).toBe('/r/devvv?orgUrl=org_tlxruvlefzthnvwz');
  });
});
