import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@documenso/lib/errors/app-error';

import { initializeAffiliatePackagePurchase } from './initialize-affiliate-package-purchase';

const getOrganisationCreditsMock = vi.fn();
const initializeResellerPurchaseMock = vi.fn();
const createTransactionMock = vi.fn();
const associateOrganisationWithResellerMock = vi.fn();
const createPendingOrganisationCreditPurchaseMock = vi.fn();

vi.mock('@documenso/ee/server-only/limits/user-credits', () => ({
  getOrganisationCredits: (...args: unknown[]) => getOrganisationCreditsMock(...args),
}));

vi.mock('./initialize-reseller-purchase', () => ({
  initializeResellerPurchase: (...args: unknown[]) => initializeResellerPurchaseMock(...args),
}));

vi.mock('./reseller-association', () => ({
  associateOrganisationWithReseller: (...args: unknown[]) =>
    associateOrganisationWithResellerMock(...args),
}));

vi.mock('@documenso/lib/server-only/paystack', () => ({
  createTransaction: (...args: unknown[]) => createTransactionMock(...args),
}));

vi.mock('@documenso/lib/server-only/billing/record-organisation-credit-purchase', () => ({
  createPendingOrganisationCreditPurchase: (...args: unknown[]) =>
    createPendingOrganisationCreditPurchaseMock(...args),
}));

vi.mock('@documenso/prisma', () => ({
  prisma: {
    resellerProfile: {
      findUnique: vi.fn(),
    },
    organisation: {
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

import { prisma } from '@documenso/prisma';

const prismaMock = vi.mocked(prisma);

const baseProfile = {
  id: 'profile_1',
  affiliateSlug: 'acme',
  organisationId: 'reseller_org',
  allowNegativeCredits: false,
  payoutMode: 'NOMIA_SUBACCOUNT',
  paystackSubaccountCode: 'ACCT_test',
  paystackPublicKey: 'pk_test',
  paystackSecretKey: 'sk_test',
  subaccountStatus: 'ACTIVE',
  packages: [
    {
      id: 'pkg_1',
      catalogPackageId: 'payg-100',
      creditAmount: 100,
      priceInCents: 10000,
      currency: 'ZAR',
      isEnabled: true,
    },
  ],
  organisation: { id: 'reseller_org' },
};

describe('initializeAffiliatePackagePurchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    associateOrganisationWithResellerMock.mockResolvedValue({ associated: true });
    createPendingOrganisationCreditPurchaseMock.mockResolvedValue(undefined);
    prismaMock.organisation.findUniqueOrThrow.mockResolvedValue({ url: 'buyer-org' } as never);
  });

  it('uses full reseller purchase when stock is sufficient', async () => {
    prismaMock.resellerProfile.findUnique.mockResolvedValue(baseProfile as never);
    getOrganisationCreditsMock.mockResolvedValue(200);
    initializeResellerPurchaseMock.mockResolvedValue({
      authorizationUrl: 'https://paystack.test/full',
      reference: 'ref_full',
    });

    const result = await initializeAffiliatePackagePurchase({
      affiliateSlug: 'acme',
      packageId: 'pkg_1',
      purchaserOrganisationId: 'buyer_org',
      purchaserUserId: 1,
      purchaserEmail: 'buyer@test.com',
    });

    expect(initializeResellerPurchaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        packageId: 'pkg_1',
        affiliateSlug: 'acme',
      }),
    );
    expect(result.authorizationUrl).toBe('https://paystack.test/full');
  });

  it('uses partial reseller purchase when only some credits are available', async () => {
    prismaMock.resellerProfile.findUnique.mockResolvedValue(baseProfile as never);
    getOrganisationCreditsMock.mockResolvedValue(10);
    initializeResellerPurchaseMock.mockResolvedValue({
      authorizationUrl: 'https://paystack.test/partial',
      reference: 'ref_partial',
    });

    const result = await initializeAffiliatePackagePurchase({
      affiliateSlug: 'acme',
      packageId: 'pkg_1',
      purchaserOrganisationId: 'buyer_org',
      purchaserUserId: 1,
      purchaserEmail: 'buyer@test.com',
    });

    expect(initializeResellerPurchaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        creditAmountOverride: 10,
        amountInCentsOverride: 1000,
        callbackPath: expect.stringContaining('hybrid=nomia'),
      }),
    );
    expect(result.authorizationUrl).toBe('https://paystack.test/partial');
  });

  it('falls back to Nomia when reseller cannot fulfill the purchase', async () => {
    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      ...baseProfile,
      paystackSubaccountCode: null,
      subaccountStatus: 'PENDING',
    } as never);
    getOrganisationCreditsMock.mockResolvedValue(0);
    createTransactionMock.mockResolvedValue({
      status: true,
      data: {
        authorization_url: 'https://paystack.test/nomia',
        reference: 'ref_nomia',
      },
    });

    const result = await initializeAffiliatePackagePurchase({
      affiliateSlug: 'acme',
      packageId: 'pkg_1',
      purchaserOrganisationId: 'buyer_org',
      purchaserUserId: 1,
      purchaserEmail: 'buyer@test.com',
    });

    expect(initializeResellerPurchaseMock).not.toHaveBeenCalled();
    expect(createTransactionMock).toHaveBeenCalled();
    expect(result.authorizationUrl).toBe('https://paystack.test/nomia');
  });

  it('throws when package is missing', async () => {
    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      ...baseProfile,
      packages: [],
    } as never);

    await expect(
      initializeAffiliatePackagePurchase({
        affiliateSlug: 'acme',
        packageId: 'pkg_missing',
        purchaserOrganisationId: 'buyer_org',
        purchaserUserId: 1,
        purchaserEmail: 'buyer@test.com',
      }),
    ).rejects.toThrow(AppError);
  });
});
