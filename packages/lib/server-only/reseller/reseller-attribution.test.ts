import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    organisation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    resellerProfile: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
}));

vi.mock('@documenso/ee/server-only/limits/user-credits', () => ({
  getOrganisationCredits: vi.fn(),
}));

vi.mock('./reseller-delinquency', () => ({
  syncResellerDelinquencyState: vi.fn(),
}));

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import { prisma } from '@documenso/prisma';

import {
  associateAffiliateSignupOnEmailVerification,
  associateOrganisationWithReseller,
  extractAffiliateSlugFromPath,
  parseAffiliateSignupVerificationMetadata,
  resolveResellerDisplayName,
} from './reseller-association';
import { resolveOrganisationPaygBilling } from './resolve-organisation-payg-billing';

describe('reseller attribution helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts affiliate slug from returnTo paths', () => {
    expect(extractAffiliateSlugFromPath('/r/acme-corp')).toBe('acme-corp');
    expect(extractAffiliateSlugFromPath('/r/acme-corp?x=1')).toBe('acme-corp');
    expect(extractAffiliateSlugFromPath('/o/foo')).toBeNull();
  });

  it('parses affiliate signup metadata from verification tokens', () => {
    expect(parseAffiliateSignupVerificationMetadata({ affiliateSlug: 'acme' })).toEqual({
      affiliateSlug: 'acme',
    });
    expect(parseAffiliateSignupVerificationMetadata({})).toBeNull();
    expect(parseAffiliateSignupVerificationMetadata(null)).toBeNull();
  });

  it('associates organisation with reseller after affiliate signup verification', async () => {
    vi.mocked(prisma.organisation.findFirst).mockResolvedValue({
      id: 'org-1',
    } as never);

    vi.mocked(prisma.resellerProfile.findUnique).mockResolvedValue({
      id: 'rp-1',
      status: 'ACTIVE',
      organisationId: 'reseller-org',
      isDelinquent: false,
      affiliateSlug: 'acme',
    } as never);

    vi.mocked(prisma.organisation.findUnique).mockResolvedValue({
      id: 'org-1',
      associatedResellerProfileId: null,
      resellerRequiresReconsent: false,
      resellerProfile: null,
    } as never);

    vi.mocked(prisma.resellerProfile.findUniqueOrThrow).mockResolvedValue({
      isDelinquent: false,
    } as never);

    vi.mocked(prisma.organisation.update).mockResolvedValue({} as never);

    const result = await associateAffiliateSignupOnEmailVerification({
      userId: 1,
      affiliateSlug: 'acme',
    });

    expect(result.associated).toBe(true);
    expect(prisma.organisation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resellerAssociationSource: 'AFFILIATE_SIGNUP',
        }),
      }),
    );
  });

  it('resolves reseller display name from branding or org name', () => {
    expect(
      resolveResellerDisplayName({
        organisation: { name: 'Acme Org' },
        brandingCompanyDetails: 'Acme Trading\n123 Street',
      }),
    ).toBe('Acme Trading');

    expect(
      resolveResellerDisplayName({
        organisation: { name: 'Acme Org' },
        brandingCompanyDetails: null,
      }),
    ).toBe('Acme Org');
  });

  it('associates organisation with reseller on affiliate visit', async () => {
    vi.mocked(prisma.organisation.findUnique).mockResolvedValue({
      id: 'org-1',
      associatedResellerProfileId: null,
      resellerRequiresReconsent: false,
      resellerProfile: null,
    } as never);

    vi.mocked(prisma.resellerProfile.findUnique).mockResolvedValue({
      id: 'rp-1',
      status: 'ACTIVE',
      organisationId: 'reseller-org',
      isDelinquent: false,
      affiliateSlug: 'acme',
    } as never);

    vi.mocked(prisma.resellerProfile.findUniqueOrThrow).mockResolvedValue({
      isDelinquent: false,
    } as never);

    vi.mocked(prisma.organisation.update).mockResolvedValue({} as never);

    const result = await associateOrganisationWithReseller({
      organisationId: 'org-1',
      resellerProfileId: 'rp-1',
      source: 'AFFILIATE_VISIT',
    });

    expect(result.associated).toBe(true);
    expect(prisma.organisation.update).toHaveBeenCalled();
  });

  it('never overwrites AFFILIATE_SIGNUP when a purchase association is attempted', async () => {
    vi.mocked(prisma.organisation.findUnique).mockResolvedValue({
      id: 'org-1',
      associatedResellerProfileId: 'rp-1',
      resellerRequiresReconsent: false,
      resellerAssociationSource: 'AFFILIATE_SIGNUP',
      resellerProfile: null,
    } as never);

    vi.mocked(prisma.resellerProfile.findUnique).mockResolvedValue({
      id: 'rp-1',
      status: 'ACTIVE',
      organisationId: 'reseller-org',
      isDelinquent: false,
      affiliateSlug: 'acme',
    } as never);

    vi.mocked(prisma.resellerProfile.findUniqueOrThrow).mockResolvedValue({
      isDelinquent: false,
    } as never);

    const result = await associateOrganisationWithReseller({
      organisationId: 'org-1',
      resellerProfileId: 'rp-1',
      source: 'AFFILIATE_PURCHASE',
    });

    expect(result).toEqual({ associated: true, reason: 'ALREADY_SET' });
    expect(prisma.organisation.update).not.toHaveBeenCalled();
  });
});

describe('resolveOrganisationPaygBilling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes to Nomia when there is no association', async () => {
    vi.mocked(prisma.organisation.findUnique).mockResolvedValue({
      associatedResellerProfileId: null,
      resellerRequiresReconsent: false,
      associatedResellerProfile: null,
    } as never);

    const result = await resolveOrganisationPaygBilling({
      organisationId: 'org-1',
      catalogPackageId: 'payg-100',
    });

    expect(result.source).toBe('NOMIA');
    expect(result.reason).toBe('NO_ASSOCIATION');
  });

  it('routes full package to reseller when stock is enough', async () => {
    const profile = {
      id: 'rp-1',
      affiliateSlug: 'acme',
      status: 'ACTIVE',
      isDelinquent: false,
      allowNegativeCredits: false,
      organisationId: 'reseller-org',
      payoutMode: 'OWN_PAYSTACK',
      paystackPublicKey: 'pk',
      paystackSecretKey: 'sk',
      paystackSubaccountCode: null,
      subaccountStatus: null,
      brandingCompanyDetails: null,
      organisation: { name: 'Acme', id: 'reseller-org' },
      packages: [
        {
          id: 'pkg-1',
          catalogPackageId: 'payg-100',
          creditAmount: 100,
          priceInCents: 85000,
          currency: 'ZAR',
          isEnabled: true,
        },
      ],
    };

    vi.mocked(prisma.organisation.findUnique).mockResolvedValue({
      associatedResellerProfileId: 'rp-1',
      resellerRequiresReconsent: false,
      associatedResellerProfile: profile,
    } as never);

    vi.mocked(prisma.resellerProfile.findUniqueOrThrow).mockResolvedValue(profile as never);
    vi.mocked(getOrganisationCredits).mockResolvedValue(150);

    const result = await resolveOrganisationPaygBilling({
      organisationId: 'org-1',
      catalogPackageId: 'payg-100',
    });

    expect(result.source).toBe('RESELLER');
    expect(result.disclosure).toContain('You are purchasing credits from a reseller:');
    expect(result.resellerPackage?.id).toBe('pkg-1');
  });

  it('splits when reseller has partial stock', async () => {
    const profile = {
      id: 'rp-1',
      affiliateSlug: 'acme',
      status: 'ACTIVE',
      isDelinquent: false,
      allowNegativeCredits: false,
      organisationId: 'reseller-org',
      payoutMode: 'OWN_PAYSTACK',
      paystackPublicKey: 'pk',
      paystackSecretKey: 'sk',
      paystackSubaccountCode: null,
      subaccountStatus: null,
      brandingCompanyDetails: null,
      organisation: { name: 'Acme', id: 'reseller-org' },
      packages: [
        {
          id: 'pkg-1',
          catalogPackageId: 'payg-100',
          creditAmount: 100,
          priceInCents: 85000,
          currency: 'ZAR',
          isEnabled: true,
        },
      ],
    };

    vi.mocked(prisma.organisation.findUnique).mockResolvedValue({
      associatedResellerProfileId: 'rp-1',
      resellerRequiresReconsent: false,
      associatedResellerProfile: profile,
    } as never);

    vi.mocked(prisma.resellerProfile.findUniqueOrThrow).mockResolvedValue(profile as never);
    vi.mocked(getOrganisationCredits).mockResolvedValue(40);

    const result = await resolveOrganisationPaygBilling({
      organisationId: 'org-1',
      catalogPackageId: 'payg-100',
    });

    expect(result.source).toBe('HYBRID');
    expect(result.split?.resellerCredits).toBe(40);
    expect(result.split?.nomiaCredits).toBe(60);
  });

  it('routes to Nomia when reseller stock is zero', async () => {
    const profile = {
      id: 'rp-1',
      affiliateSlug: 'acme',
      status: 'ACTIVE',
      isDelinquent: false,
      allowNegativeCredits: false,
      organisationId: 'reseller-org',
      payoutMode: 'OWN_PAYSTACK',
      paystackPublicKey: 'pk',
      paystackSecretKey: 'sk',
      paystackSubaccountCode: null,
      subaccountStatus: null,
      brandingCompanyDetails: null,
      organisation: { name: 'Acme', id: 'reseller-org' },
      packages: [
        {
          id: 'pkg-1',
          catalogPackageId: 'payg-100',
          creditAmount: 100,
          priceInCents: 85000,
          currency: 'ZAR',
          isEnabled: true,
        },
      ],
    };

    vi.mocked(prisma.organisation.findUnique).mockResolvedValue({
      associatedResellerProfileId: 'rp-1',
      resellerRequiresReconsent: false,
      associatedResellerProfile: profile,
    } as never);

    vi.mocked(prisma.resellerProfile.findUniqueOrThrow).mockResolvedValue(profile as never);
    vi.mocked(getOrganisationCredits).mockResolvedValue(0);

    const result = await resolveOrganisationPaygBilling({
      organisationId: 'org-1',
      catalogPackageId: 'payg-100',
    });

    expect(result.source).toBe('NOMIA');
    expect(result.reason).toBe('ZERO_STOCK_NOMIA');
  });
});
