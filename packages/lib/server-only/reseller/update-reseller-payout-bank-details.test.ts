import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@documenso/prisma';

import { updateResellerBankDetails } from './update-reseller-payout';

const registerResellerPaystackSubaccountMock = vi.fn();

vi.mock('@documenso/lib/server-only/paystack', () => ({
  getPaystackSubaccount: vi.fn(),
  isPaystackSubaccountMissingError: vi.fn(),
}));

vi.mock('./register-reseller-paystack-subaccount', () => ({
  registerResellerPaystackSubaccount: (...args: unknown[]) =>
    registerResellerPaystackSubaccountMock(...args),
}));

vi.mock('./reseller-secrets', () => ({
  encryptResellerSecret: (value: string) => `encrypted:${value}`,
  decryptResellerSecret: (value: string) =>
    value.startsWith('encrypted:') ? value.slice('encrypted:'.length) : value,
}));

vi.mock('./reseller-vat-registration', () => ({
  recordResellerVatRegistrationChange: vi.fn().mockResolvedValue(null),
}));

vi.mock('@documenso/prisma', () => ({
  prisma: {
    resellerProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        resellerProfile: {
          update: (...args: unknown[]) => prisma.resellerProfile.update(...(args as [never])),
        },
      }),
    ),
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
        businessName: 'Test Account',
        affiliateSlug: 'acme',
        bankCode: '632005',
        accountNumber: '0123456047',
      }),
    );
    expect(result.paystackSubaccountCode).toBe('ACCT_new');
    expect(result.subaccountStatus).toBe('PENDING');
  });

  it('skips Paystack when only contact or VAT details change', async () => {
    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      status: 'ACTIVE',
      affiliateSlug: 'acme',
      platformFeePercent: 0,
      paystackSubaccountCode: 'ACCT_existing',
      bankCode: '632005',
      bankName: 'ABSA',
      bankAccountNumber: 'encrypted:0123456047',
      bankAccountName: 'Test Account',
      organisation: {
        name: 'Acme Org',
      },
    } as never);

    prismaMock.resellerProfile.update.mockResolvedValue({
      id: 'profile_1',
      paystackSubaccountCode: 'ACCT_existing',
      subaccountStatus: 'ACTIVE',
    } as never);

    const result = await updateResellerBankDetails({
      organisationId: 'org_1',
      bankCode: '632005',
      bankName: 'ABSA',
      bankAccountNumber: '0123456047',
      bankAccountName: 'Test Account',
      accountType: 'personal',
      documentType: 'identityNumber',
      documentNumber: '9001015800088',
      physicalAddress: '2 New Street, Cape Town, 8001',
      contactPhone: '+27821234567',
      contactEmail: 'new-billing@example.com',
      vatStatus: 'REGISTERED' as const,
      vatNumber: '4123456789',
    });

    expect(registerResellerPaystackSubaccountMock).not.toHaveBeenCalled();
    expect(prismaMock.resellerProfile.update).toHaveBeenCalledTimes(1);
    expect(result.paystackSubaccountCode).toBe('ACCT_existing');
  });

  it('updates Paystack when the bank account number changes', async () => {
    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      status: 'ACTIVE',
      affiliateSlug: 'acme',
      platformFeePercent: 0,
      paystackSubaccountCode: 'ACCT_existing',
      bankCode: '632005',
      bankName: 'ABSA',
      bankAccountNumber: 'encrypted:0123456047',
      bankAccountName: 'Test Account',
      organisation: {
        name: 'Acme Org',
      },
    } as never);

    prismaMock.resellerProfile.update
      .mockResolvedValueOnce({
        id: 'profile_1',
        paystackSubaccountCode: 'ACCT_existing',
      } as never)
      .mockResolvedValueOnce({
        id: 'profile_1',
        paystackSubaccountCode: 'ACCT_existing',
        subaccountStatus: 'PENDING',
      } as never);

    registerResellerPaystackSubaccountMock.mockResolvedValue({
      subaccount: {
        subaccount_code: 'ACCT_existing',
        id: 99,
        is_verified: false,
      },
      subaccountStatus: 'PENDING',
      subaccountVerifiedAt: null,
    });

    await updateResellerBankDetails({
      organisationId: 'org_1',
      bankCode: '632005',
      bankName: 'ABSA',
      bankAccountNumber: '9999999999',
      bankAccountName: 'Test Account',
      accountType: 'personal',
      documentType: 'identityNumber',
      documentNumber: '9001015800088',
      physicalAddress: '1 Main Street, Johannesburg, 2000',
      contactPhone: '+27111234567',
      contactEmail: 'billing@example.com',
      vatStatus: 'NOT_REGISTERED' as const,
    });

    expect(registerResellerPaystackSubaccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: '9999999999',
        existingSubaccountCode: 'ACCT_existing',
      }),
    );
  });

  it('creates a new Paystack subaccount when previous registration failed', async () => {
    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      status: 'ACTIVE',
      affiliateSlug: 'acme',
      platformFeePercent: 0,
      paystackSubaccountCode: 'ACCT_deleted',
      subaccountStatus: 'FAILED',
      bankCode: '632005',
      bankName: 'ABSA',
      bankAccountNumber: 'encrypted:0123456047',
      bankAccountName: 'Test Account',
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
        id: 100,
        is_verified: false,
      },
      subaccountStatus: 'PENDING',
      subaccountVerifiedAt: null,
    });

    await updateResellerBankDetails({
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

    expect(registerResellerPaystackSubaccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Test Account',
        accountNumber: '0123456047',
        existingSubaccountCode: null,
      }),
    );
  });
});
