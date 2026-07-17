import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@documenso/prisma';

import { updateResellerBankDetails } from './update-reseller-payout';

const registerResellerPaystackSubaccountMock = vi.fn();

vi.mock('./register-reseller-paystack-subaccount', () => ({
  registerResellerPaystackSubaccount: (...args: unknown[]) =>
    registerResellerPaystackSubaccountMock(...args),
}));

vi.mock('./reseller-secrets', () => ({
  encryptResellerSecret: (value: string) => `encrypted:${value}`,
}));

vi.mock('@documenso/prisma', () => ({
  prisma: {
    resellerProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const prismaMock = vi.mocked(prisma);

describe('updateResellerBankDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a Paystack subaccount when bank details are submitted', async () => {
    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      status: 'ACTIVE',
      affiliateSlug: 'acme',
      platformFeePercent: 0,
      paystackSubaccountCode: null,
      organisation: {
        name: 'Acme Org',
      },
    } as never);

    prismaMock.resellerProfile.update
      .mockResolvedValueOnce({
        id: 'profile_1',
        paystackSubaccountCode: null,
      } as never)
      .mockResolvedValueOnce({
        id: 'profile_1',
        paystackSubaccountCode: 'ACCT_new',
        subaccountStatus: 'PENDING',
      } as never);

    registerResellerPaystackSubaccountMock.mockResolvedValue({
      subaccount: {
        subaccount_code: 'ACCT_new',
        id: 99,
        is_verified: false,
      },
      subaccountStatus: 'PENDING',
      subaccountVerifiedAt: null,
    });

    const result = await updateResellerBankDetails({
      organisationId: 'org_1',
      bankCode: '632005',
      bankName: 'ABSA',
      bankAccountNumber: '0123456047',
      bankAccountName: 'Test Account',
      accountType: 'personal',
      documentType: 'identityNumber',
      documentNumber: '9001015800088',
      physicalAddress: '1 Main Street, Johannesburg, 2000',
      contactPhone: '+27111234567',
      contactEmail: 'billing@example.com',
      vatStatus: 'NOT_REGISTERED' as const,
    });

    expect(prismaMock.resellerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          physicalAddress: '1 Main Street, Johannesburg, 2000',
          contactPhone: '+27111234567',
          contactEmail: 'billing@example.com',
          vatStatus: 'NOT_REGISTERED',
          vatNumber: null,
          bankDetailsConfirmedAt: expect.any(Date),
        }),
      }),
    );
    expect(registerResellerPaystackSubaccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationName: 'Acme Org',
        affiliateSlug: 'acme',
        bankCode: '632005',
        accountNumber: '0123456047',
      }),
    );
    expect(result.paystackSubaccountCode).toBe('ACCT_new');
    expect(result.subaccountStatus).toBe('PENDING');
  });
});
